// 상세 리포트 — 연도 탭·빈 상태·리포트 본문(보상형 광고 게이트는 ReportUnlockManager가 전담)
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Tab, Paragraph, Spacing, Badge, Button, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { Amount } from '@/components/Amount';
import { MiniBar } from '@/components/MiniBar';
import { AdSlot } from '@/components/AdSlot';
import { EmptyState } from '@/components/StateView';
import { ReportUnlockManager } from '@/pages/ReportUnlockManager';
import { summarizeYear, diagnose, estimatePremium, findDropMonth } from '@/domain/diagnosis';
import { RULES, STATUS_LABEL, DISCLAIMER_TEXT } from '@/domain/rules';
import { formatWon, formatYearMonth, prevMonthKey } from '@/utils/format';
import { parseYearState } from '@/lib/routeState';
import { useAppData } from '@/state/AppDataContext';
import type { RouteState } from '@/types/navigation';
import type { DiagnosisStatus } from '@/lib/types';

const STATUS_BADGE_COLOR: Record<DiagnosisStatus, 'green' | 'yellow' | 'red'> = {
  SAFE: 'green',
  WARNING: 'yellow',
  DROP: 'red',
};

function fireTickHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

export default function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, records } = useAppData();

  const now = new Date();
  const currentYear = now.getFullYear();
  const YEARS = [currentYear, currentYear - 1];

  const parsedYear = parseYearState(location.state);
  const [selectedYear, setSelectedYear] = useState(() =>
    YEARS.includes(parsedYear) ? parsedYear : currentYear,
  );

  const hasBusinessRegistration = profile?.hasBusinessRegistration ?? false;
  const summary = summarizeYear(records, selectedYear);
  const diagnosis = summary
    ? diagnose(summary, { hasBusinessRegistration }, RULES)
    : null;
  const premium = summary ? estimatePremium(summary.totalAnnual, RULES) : null;
  const dropMonth = summary
    ? findDropMonth(records, selectedYear, { hasBusinessRegistration }, RULES)
    : null;

  function handleTabChange(year: number) {
    if (year === selectedYear) return;
    fireTickHaptic();
    setSelectedYear(year);
  }

  function goToRecord() {
    navigate('/record', { state: { month: prevMonthKey(now), from: 'home' } as RouteState['/record'] });
  }

  function goToSimulate() {
    navigate('/simulate', { state: { year: selectedYear } as RouteState['/simulate'] });
  }

  const sideLimit = hasBusinessRegistration
    ? RULES.sideIncomeLimitRegistered
    : RULES.sideIncomeLimitUnregistered;
  const sideLabel = hasBusinessRegistration ? '부업 소득 (사업자 등록)' : '부업 소득 (사업자 미등록)';
  const totalOver = diagnosis?.reasons.includes('TOTAL_INCOME') ?? false;
  const sideOver =
    (diagnosis?.reasons.includes('SIDE_INCOME_UNREGISTERED') ||
      diagnosis?.reasons.includes('SIDE_INCOME_REGISTERED')) ??
    false;

  const totalRatio = summary ? summary.totalAnnual / RULES.totalIncomeLimit : 0;
  const salaryPct = summary && summary.totalAnnual > 0 ? Math.round((summary.salaryAnnual / summary.totalAnnual) * 100) : 0;
  const sidePct = summary && summary.totalAnnual > 0 ? Math.round((summary.sideAnnual / summary.totalAnnual) * 100) : 0;
  const otherPct = summary && summary.totalAnnual > 0 ? Math.round((summary.otherAnnual / summary.totalAnnual) * 100) : 0;

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>분석 결과</Top.TitleParagraph>} />}>
      <Tab onChange={(index) => handleTabChange(YEARS[index])}>
        {YEARS.map((year) => (
          <Tab.Item key={year} selected={selectedYear === year} onClick={() => handleTabChange(year)}>
            {`${year}년`}
          </Tab.Item>
        ))}
      </Tab>

      <Spacing size={16} />

      {!summary || !diagnosis || !premium ? (
        <EmptyState
          testId="report-empty-state"
          icon={<Asset.ContentIcon name="iconWriteRegular" alt="입력" style={{ width: 48, height: 48 }} />}
          title="소득을 입력하면 리포트를 볼 수 있어요"
          action={
            <Button variant="weak" onClick={goToRecord}>
              소득 입력하기
            </Button>
          }
        />
      ) : (
        <ReportUnlockManager statusLabel={STATUS_LABEL[diagnosis.status]}>
          <SummaryHero
            testId="ratio-hero"
            label="기준 대비 합산 소득 비율"
            value={<Amount value={diagnosis.totalRatioPercent} unit="%" typography="t1" />}
            caption={`${summary.recordedMonths}개월 기록 기준`}
          />
          <Spacing size={8} />
          <Badge size="medium" variant="fill" color={STATUS_BADGE_COLOR[diagnosis.status]}>
            {STATUS_LABEL[diagnosis.status]}
          </Badge>
          <Spacing size={12} />
          <MiniBar testId="report-ratio-minibar" ratio={totalRatio} />

          <Spacing size={16} />
          <Card testId="criteria-card">
            <Paragraph.Text typography="st11">연간 합산 소득</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t5">
              {`${formatWon(summary.totalAnnual)} / 기준 ${formatWon(RULES.totalIncomeLimit)}`}
            </Paragraph.Text>
            <Spacing size={4} />
            <Badge size="small" variant={totalOver ? 'fill' : 'weak'} color={totalOver ? 'red' : 'green'}>
              {totalOver ? '초과' : '충족'}
            </Badge>
          </Card>
          <Spacing size={12} />
          <Card testId="criteria-card">
            <Paragraph.Text typography="st11">{sideLabel}</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t5">
              {`${formatWon(summary.sideAnnual)} / 기준 ${formatWon(sideLimit)}`}
            </Paragraph.Text>
            <Spacing size={4} />
            <Badge size="small" variant={sideOver ? 'fill' : 'weak'} color={sideOver ? 'red' : 'green'}>
              {sideOver ? '초과' : '충족'}
            </Badge>
          </Card>

          <Spacing size={16} />
          <Card testId="premium-card">
            <Paragraph.Text typography="st11">
              {diagnosis.status === 'DROP' ? '예상 월 보험료' : '탈락 시 예상 월 보험료(현재 소득 기준)'}
            </Paragraph.Text>
            <Spacing size={4} />
            <Amount testId="premium-card-value" value={premium.totalMonthly} unit="원" typography="t2" />
            <Spacing size={8} />
            <div>
              <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
                {`건강보험료 ${formatWon(premium.healthMonthly)}`}
              </Paragraph.Text>
            </div>
            <div>
              <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
                {`장기요양보험료 ${formatWon(premium.ltcMonthly)}`}
              </Paragraph.Text>
            </div>
            <div>
              <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
                {`연간 ${formatWon(premium.totalAnnual)}`}
              </Paragraph.Text>
            </div>
          </Card>

          <Spacing size={12} />
          <Card testId="drop-month-card">
            <Paragraph.Text typography="st11">탈락 예상 시점</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="t5">
              {dropMonth
                ? `${formatYearMonth(dropMonth)}에 기준을 넘을 것으로 예상돼요`
                : '올해 안에는 기준을 넘지 않을 것으로 보여요'}
            </Paragraph.Text>
          </Card>

          <Spacing size={12} />
          <Card testId="income-breakdown">
            <Paragraph.Text typography="st11">소득 구성</Paragraph.Text>
            <Spacing size={8} />
            <Paragraph.Text typography="t6">{`본업 ${salaryPct}%`}</Paragraph.Text>
            <MiniBar ratio={salaryPct / 100} />
            <Spacing size={8} />
            <Paragraph.Text typography="t6">{`부업 ${sidePct}%`}</Paragraph.Text>
            <MiniBar ratio={sidePct / 100} />
            <Spacing size={8} />
            <Paragraph.Text typography="t6">{`기타 ${otherPct}%`}</Paragraph.Text>
            <MiniBar ratio={otherPct / 100} />
          </Card>

          <Spacing size={20} />
          <Button variant="weak" display="block" onClick={goToSimulate}>
            시뮬레이션 해보기
          </Button>

          <Spacing size={24} />
          {import.meta.env.VITE_TOSS_AD_GROUP_ID ? (
            <div data-testid="report-ad-slot">
              <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
            </div>
          ) : null}

          <Spacing size={16} />
          <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
            {DISCLAIMER_TEXT}
          </Paragraph.Text>
        </ReportUnlockManager>
      )}

      <Spacing size={32} />
      <Spacing size={32} />
      <Spacing size={32} />
    </ScreenScaffold>
  );
}
