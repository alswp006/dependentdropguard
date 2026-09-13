import { Asset, Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { Card } from '@/components/Card';
import type { AppSettings, MonthlyIncomeRecord } from '@/lib/types';
import { formatMonthLabel, prevMonthKey } from '@/utils/format';

function hapticTick() {
  try {
    generateHapticFeedback({ type: 'tickWeak' });
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

/** 리마인더 대상 월(prevMonthKey)이 미입력이고 닫지 않았을 때만 true. */
export function shouldShowReminder(
  settings: AppSettings,
  records: MonthlyIncomeRecord[],
  now: Date,
): boolean {
  if (!settings.reminderEnabled) return false;
  const target = prevMonthKey(now);
  if (settings.dismissedReminderMonth === target) return false;
  return !records.some((record) => record.month === target);
}

interface ReminderBannerProps {
  /** 리마인더 대상 월('YYYY-MM') — prevMonthKey(now) */
  month: string;
  now: Date;
  onRecord: () => void;
  onDismiss: () => void;
}

export function ReminderBanner({ month, now, onRecord, onDismiss }: ReminderBannerProps) {
  const handleRecord = () => {
    hapticTick();
    onRecord();
  };

  const handleDismiss = () => {
    hapticTick();
    onDismiss();
  };

  return (
    <Card testId="reminder-banner">
      <Asset.ContentIcon
        name="iconCalendarRegular"
        alt="달력"
        style={{ width: 24, height: 24 }}
      />
      <Spacing size={8} />
      <Paragraph.Text typography="t5">
        {`${formatMonthLabel(month, now)} 소득을 아직 입력하지 않았어요`}
      </Paragraph.Text>
      <Spacing size={12} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="medium" variant="weak" onClick={handleDismiss}>
          닫기
        </Button>
        <Button size="medium" variant="fill" onClick={handleRecord}>
          입력하기
        </Button>
      </div>
    </Card>
  );
}
