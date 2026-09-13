// 설정 — 사업자 행·계산 기준 시트·리마인더 스위치·전체 삭제·면책 문구
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Switch, AlertDialog, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { RulesSheet } from '@/components/settings/RulesSheet';
import { DISCLAIMER_TEXT } from '@/domain/rules';
import { useAppData } from '@/state/AppDataContext';
import type { RouteState } from '@/types/navigation';

function fireTickWeakHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

export default function Settings() {
  const navigate = useNavigate();
  const { profile, settings, saveSettings, clearAll } = useAppData();

  const [rulesOpen, setRulesOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const bizLabel =
    profile === null ? '미설정' : profile.hasBusinessRegistration ? '있음' : '없음';

  const bizTexts = <ListRow.Texts type="1RowTypeA" top="사업자등록 여부" />;
  const bizValue = (
    <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
      {bizLabel}
    </Paragraph.Text>
  );
  const rulesTexts = <ListRow.Texts type="1RowTypeA" top="계산 기준 보기" />;
  const reminderTexts = (
    <ListRow.Texts
      type="2RowTypeA"
      top="월간 입력 리마인더"
      bottom="지난달 소득을 입력하지 않으면 홈에서 알려드려요"
    />
  );
  const reminderSwitch = (
    <Switch data-testid="reminder-switch" checked={settings.reminderEnabled} onChange={toggleReminder} />
  );
  const resetTexts = <ListRow.Texts type="1RowTypeA" top="모든 데이터 삭제" />;

  function goProfileEdit() {
    fireTickWeakHaptic();
    navigate('/profile', { state: { mode: 'edit' } as RouteState['/profile'] });
  }

  function openRules() {
    fireTickWeakHaptic();
    setRulesOpen(true);
  }

  function toggleReminder() {
    fireTickWeakHaptic();
    const result = saveSettings({ reminderEnabled: !settings.reminderEnabled });
    if (!result.ok) setToastMessage('저장하지 못했어요');
  }

  function openReset() {
    fireTickWeakHaptic();
    setResetOpen(true);
  }

  function closeReset() {
    setResetOpen(false);
  }

  function confirmReset() {
    setResetOpen(false);
    const result = clearAll();
    setToastMessage(result.ok ? '모든 데이터를 삭제했어요' : '삭제하지 못했어요');
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />}>
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
        판정 정보
      </Paragraph.Text>
      <Spacing size={8} />
      <ListRow data-testid="row-biz" onClick={goProfileEdit} contents={bizTexts} right={bizValue}>
        {bizTexts}
        {bizValue}
      </ListRow>
      <ListRow data-testid="row-rules" onClick={openRules} contents={rulesTexts}>
        {rulesTexts}
      </ListRow>

      <Spacing size={24} />
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
        알림
      </Paragraph.Text>
      <Spacing size={8} />
      <ListRow contents={reminderTexts} right={reminderSwitch}>
        {reminderTexts}
        {reminderSwitch}
      </ListRow>

      <Spacing size={24} />
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
        데이터
      </Paragraph.Text>
      <Spacing size={8} />
      <ListRow data-testid="row-reset" onClick={openReset} contents={resetTexts}>
        {resetTexts}
      </ListRow>

      <Spacing size={24} />
      <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
        {DISCLAIMER_TEXT}
      </Paragraph.Text>

      <Spacing size={32} />
      <Spacing size={32} />
      <Spacing size={32} />

      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <AlertDialog
        open={resetOpen}
        title="모든 데이터를 삭제할까요?"
        description="입력한 소득 기록과 설정이 모두 지워지고 되돌릴 수 없어요"
        onClose={closeReset}
        alertButton={<AlertDialog.AlertButton onClick={confirmReset}>삭제</AlertDialog.AlertButton>}
      />

      <Toast
        open={toastMessage !== null}
        text={toastMessage ?? ''}
        position="top"
        onClose={() => setToastMessage(null)}
      />
    </ScreenScaffold>
  );
}
