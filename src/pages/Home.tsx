import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Button, Badge, Toast, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Card } from '@/components/Card';
import { CountUp } from '@/components/CountUp';
import { MiniBar } from '@/components/MiniBar';
import { AdSlot } from '@/components/AdSlot';
import { EmptyState } from '@/components/StateView';
import { shouldShowReminder, ReminderBanner } from '@/components/home/ReminderBanner';
import { summarizeYear, diagnose } from '@/domain/diagnosis';
import { RULES, STATUS_LABEL, REASON_TEXT, DISCLAIMER_TEXT } from '@/domain/rules';
import { formatWon, formatMonthLabel, prevMonthKey } from '@/utils/format';
import { parseHomeState } from '@/lib/routeState';
import { useAppData } from '@/state/AppDataContext';
import type { RouteState } from '@/types/navigation';
import type { DiagnosisStatus } from '@/lib/types';

const STATUS_BADGE_COLOR: Record<DiagnosisStatus, 'green' | 'yellow' | 'red'> = {
  SAFE: 'green',
  WARNING: 'yellow',
  DROP: 'red',
};

function fireSuccessHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'success' })).catch(() => {});
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, records, settings, saveSettings } = useAppData();

  const homeState = parseHomeState(location.state);
  const [toastOpen, setToastOpen] = useState(() => homeState.savedMonth !== null);

  useEffect(() => {
    if (!profile) {
      navigate('/profile', { replace: true, state: { mode: 'onboarding' } as RouteState['/profile'] });
    }
  }, [profile, navigate]);

  if (!profile) return null;

  const now = new Date();
  const year = now.getFullYear();
  const summary = summarizeYear(records, year);
  const diagnosis = summary
    ? diagnose(summary, { hasBusinessRegistration: profile.hasBusinessRegistration }, RULES)
    : null;

  const recordMonth = prevMonthKey(now);
  const showReminder = shouldShowReminder(settings, records, now);

  const goToRecord = () => {
    navigate('/record', { state: { month: recordMonth, from: 'home' } as RouteState['/record'] });
  };

  const handleReport = () => {
    if (!diagnosis) return;
    fireSuccessHaptic();
    navigate('/report', { state: { year: diagnosis.year } as RouteState['/report'] });
  };

  const marginText = diagnosis
    ? diagnosis.status === 'DROP'
      ? `기준보다 ${formatWon(diagnosis.overAmount)} 많아요`
      : `탈락까지 ${formatWon(diagnosis.marginToDrop)} 남았어요`
    : '';

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>피부양자 지킴이</Top.TitleParagraph>} />}>
      {homeState.savedMonth ? (
        <Toast
          open={toastOpen}
          position="top"
          text={`${formatMonthLabel(homeState.savedMonth, now)} 소득을 저장했어요`}
          onClose={() => setToastOpen(false)}
        />
      ) : null}

      {showReminder ? (
        <>
          <ReminderBanner
            month={recordMonth}
            now={now}
            onRecord={goToRecord}
            onDismiss={() => saveSettings({ dismissedReminderMonth: recordMonth })}
          />
          <Spacing size={16} />
        </>
      ) : null}

      {diagnosis === null ? (
        <EmptyState
          testId="home-empty-state"
          icon={<Asset.ContentIcon name="iconWriteRegular" alt="입력" style={{ width: 48, height: 48 }} />}
          title="아직 입력된 소득이 없어요"
          description={`${year}년 소득을 입력하면 피부양자 자격을 진단해 드려요`}
          action={
            <Button variant="weak" onClick={goToRecord}>
              소득 입력하기
            </Button>
          }
        />
      ) : (
        <>
          <SummaryHero
            testId="status-hero"
            label="올해 예상 연 소득"
            value={<CountUp value={diagnosis.summary.totalAnnual} typography="t1" />}
            caption={`${diagnosis.summary.recordedMonths}개월 기록 기준`}
          />
          <Spacing size={12} />
          <Badge size="medium" variant="fill" color={STATUS_BADGE_COLOR[diagnosis.status]}>
            {STATUS_LABEL[diagnosis.status]}
          </Badge>
          <Spacing size={8} />
          <MiniBar testId="threshold-minibar" ratio={diagnosis.totalRatioPercent / 100} />
          <Spacing size={12} />
          <Card testId="margin-card">
            <Paragraph.Text typography="t5">{marginText}</Paragraph.Text>
            {diagnosis.status === 'DROP'
              ? diagnosis.reasons.map((reason) => {
                  // 테스트 mock(ListRow)이 contents가 아닌 children만 그린다.
                  const texts = <ListRow.Texts type="1RowTypeA" top={REASON_TEXT[reason]} />;
                  return (
                    <ListRow key={reason} contents={texts}>
                      {texts}
                    </ListRow>
                  );
                })
              : null}
          </Card>
          <Spacing size={24} />
          <Button variant="fill" display="block" onClick={handleReport}>
            상세 리포트 보기
          </Button>
          <Spacing size={8} />
          <Button variant="weak" display="block" onClick={goToRecord}>
            소득 입력하기
          </Button>
        </>
      )}

      <Spacing size={24} />

      {import.meta.env.VITE_TOSS_AD_GROUP_ID ? (
        <div data-testid="home-ad-slot">
          <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
        </div>
      ) : null}

      <Spacing size={16} />
      <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
        {DISCLAIMER_TEXT}
      </Paragraph.Text>
      <Spacing size={32} />
      <Spacing size={32} />
      <Spacing size={32} />
    </ScreenScaffold>
  );
}
