// 지역가입자 전환 시뮬레이션 — 저장 없이 즉시 재계산만 한다(읽기 전용: profile, records).
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Top, TextField, Paragraph, Spacing, ListRow, Chip, Switch } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AdSlot } from '@/components/AdSlot';
import { CompareCard } from '@/components/simulate/CompareCard';
import { summarizeYear, diagnose, maxSafeSideMonthly } from '@/domain/diagnosis';
import { computeSimulation } from '@/domain/simulation';
import { RULES } from '@/domain/rules';
import { validateAmount } from '@/lib/validation';
import { formatAmountInput, parseAmountInput, formatWon } from '@/utils/format';
import { parseYearState } from '@/lib/routeState';
import { useAppData } from '@/state/AppDataContext';

const SIDE_CHIPS: { label: string; delta: number }[] = [
  { label: '+50만원', delta: 500_000 },
  { label: '+100만원', delta: 1_000_000 },
  { label: '+200만원', delta: 2_000_000 },
];

// 빈 칸은 placeholder '0'과 같은 미입력 상태로 보고 에러로 취급하지 않는다.
function amountError(raw: string): string | null {
  if (raw.trim() === '') return null;
  return validateAmount(raw);
}

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

export default function Simulate() {
  const location = useLocation();
  const { profile, records } = useAppData();

  const year = parseYearState(location.state);
  const baseHasBiz = profile?.hasBusinessRegistration ?? false;

  const [salaryRaw, setSalaryRaw] = useState('');
  const [sideRaw, setSideRaw] = useState('');
  const [simBiz, setSimBiz] = useState(baseHasBiz);

  const lastValidSalary = useRef(0);
  const lastValidSide = useRef(0);

  const salaryErr = amountError(salaryRaw);
  const sideErr = amountError(sideRaw);

  // 10억원을 넘는 입력은 직전 유효값(lastValid)으로 계산한다.
  if (!salaryErr) lastValidSalary.current = parseAmountInput(salaryRaw) ?? 0;
  if (!sideErr) lastValidSide.current = parseAmountInput(sideRaw) ?? 0;
  const salaryMonthly = lastValidSalary.current;
  const sideMonthly = lastValidSide.current;

  const baseSummary = summarizeYear(records, year);
  const baseDiagnosis = baseSummary
    ? diagnose(baseSummary, { hasBusinessRegistration: baseHasBiz }, RULES)
    : null;

  const { sim, deltaSide, premiumAnnualDelta, netGain } = computeSimulation({
    baseSummary,
    baseHasBiz,
    salaryMonthly,
    sideMonthly,
    simHasBiz: simBiz,
    rules: RULES,
  });

  const otherAnnual = baseSummary?.otherAnnual ?? 0;
  const maxSide = maxSafeSideMonthly(salaryMonthly * 12, otherAnnual, simBiz, RULES);

  const maxSafeSideText = simBiz
    ? '사업자등록 시 부업 소득이 있으면 자격을 잃어요'
    : maxSide <= 0
      ? '본업·기타 소득만으로 기준을 넘어요'
      : `부업은 월 ${formatWon(maxSide)}까지 피부양자 유지가 가능해요`;

  const netGainText =
    deltaSide <= 0
      ? '부업 소득을 늘려 비교해보세요'
      : netGain >= 0
        ? `부업으로 연 ${formatWon(deltaSide)} 더 벌면 보험료 연 ${formatWon(premiumAnnualDelta)}을 내고 실제로 ${formatWon(netGain)}이 늘어요`
        : `부업으로 연 ${formatWon(deltaSide)} 더 벌어도 보험료 연 ${formatWon(premiumAnnualDelta)} 때문에 오히려 연 ${formatWon(Math.abs(netGain))} 손해예요`;

  function addSide(delta: number) {
    fireTickHaptic();
    const current = parseAmountInput(sideRaw) ?? 0;
    setSideRaw(formatAmountInput(String(current + delta)));
  }

  function toggleBiz() {
    fireTickHaptic();
    setSimBiz((prev) => !prev);
  }

  const bizTexts = <ListRow.Texts type="1RowTypeA" top="사업자등록 있음" />;
  const bizSwitch = <Switch data-testid="sim-biz-switch" checked={simBiz} onChange={toggleBiz} />;

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>시뮬레이션</Top.TitleParagraph>} />}>
      <TextField
        data-testid="sim-salary"
        variant="box"
        label="본업 월 소득"
        placeholder="0"
        inputMode="numeric"
        value={salaryRaw}
        onChange={(e) => setSalaryRaw(formatAmountInput(e.target.value))}
        hasError={Boolean(salaryErr)}
        help={salaryErr ?? undefined}
      />
      <Spacing size={12} />
      <TextField
        data-testid="sim-side"
        variant="box"
        label="부업 월 소득"
        placeholder="0"
        inputMode="numeric"
        value={sideRaw}
        onChange={(e) => setSideRaw(formatAmountInput(e.target.value))}
        hasError={Boolean(sideErr)}
        help={sideErr ?? undefined}
      />
      <Spacing size={12} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {SIDE_CHIPS.map((chip) => (
          <Chip key={chip.label} kind="action" variant="weak" onClick={() => addSide(chip.delta)}>
            {chip.label}
          </Chip>
        ))}
      </div>
      <Spacing size={12} />
      <ListRow contents={bizTexts} right={bizSwitch}>
        {bizTexts}
        {bizSwitch}
      </ListRow>
      <Spacing size={24} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <CompareCard title="현재" result={baseDiagnosis} />
        <CompareCard title="시뮬레이션" result={sim} />
      </div>
      <Spacing size={16} />
      <Paragraph.Text data-testid="max-safe-side" typography="t5">
        {maxSafeSideText}
      </Paragraph.Text>
      <Spacing size={8} />
      <Paragraph.Text data-testid="net-gain-value" typography="t6" color="var(--adaptiveGrey600)">
        {netGainText}
      </Paragraph.Text>
      <Spacing size={24} />
      {import.meta.env.VITE_TOSS_AD_GROUP_ID ? (
        <div data-testid="simulate-ad-slot">
          <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
        </div>
      ) : null}
      <Spacing size={32} />
      <Spacing size={32} />
      <Spacing size={32} />
    </ScreenScaffold>
  );
}
