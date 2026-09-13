import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, TextField, Paragraph, Spacing, ListRow, Toast } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { MonthPickerSheet } from '@/components/record/MonthPickerSheet';
import { StatusChangeDialog } from '@/components/record/StatusChangeDialog';
import { useAppData } from '@/state/AppDataContext';
import { parseRecordState } from '@/lib/routeState';
import { summarizeYear, diagnose, isWorsened } from '@/domain/diagnosis';
import { RULES, DISCLAIMER_TEXT } from '@/domain/rules';
import { validateAmount } from '@/lib/validation';
import { formatAmountInput, parseAmountInput, formatMonthLabel } from '@/utils/format';
import { getRecords } from '@/storage/records';
import type { RouteState } from '@/types/navigation';
import type { DiagnosisStatus, DropReason, MonthlyIncomeRecord } from '@/lib/types';

type FieldKey = 'salaryIncome' | 'sideIncome' | 'otherIncome';

const FIELDS: { key: FieldKey; label: string; placeholder: string }[] = [
  { key: 'salaryIncome', label: '본업 소득', placeholder: '본업 소득' },
  { key: 'sideIncome', label: '부업·프리랜서 소득', placeholder: '부업 소득' },
  { key: 'otherIncome', label: '기타 소득', placeholder: '기타 소득' },
];

interface PendingStatusChange {
  prev: DiagnosisStatus;
  next: DiagnosisStatus;
  reasons: DropReason[];
  year: number;
}

function toAmounts(record: MonthlyIncomeRecord | null): Record<FieldKey, string> {
  return {
    salaryIncome: record ? formatAmountInput(String(record.salaryIncome)) : '',
    sideIncome: record ? formatAmountInput(String(record.sideIncome)) : '',
    otherIncome: record ? formatAmountInput(String(record.otherIncome)) : '',
  };
}

// 빈 칸은 placeholder '0'과 같은 미입력 상태로 보고 에러로 취급하지 않는다.
function amountError(raw: string): string | null {
  if (raw.trim() === '') return null;
  return validateAmount(raw);
}

function amountValue(raw: string): number {
  return parseAmountInput(raw) ?? 0;
}

export default function Record() {
  const navigate = useNavigate();
  const location = useLocation();
  const { records, profile, upsertRecord } = useAppData();

  const now = new Date();
  const parsed = parseRecordState(location.state, now);

  const [month, setMonth] = useState(() => parsed.month);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(
    parsed.futureRejected ? '미래 달은 아직 기록할 수 없어서 8월로 보여드려요' : null,
  );
  const [statusChange, setStatusChange] = useState<PendingStatusChange | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const existingRecord = records.find((r) => r.month === month) ?? null;
  const [amounts, setAmounts] = useState<Record<FieldKey, string>>(() => toAmounts(existingRecord));
  const [memo, setMemo] = useState(() => existingRecord?.memo ?? '');

  const salaryError = amountError(amounts.salaryIncome);
  const sideError = amountError(amounts.sideIncome);
  const otherError = amountError(amounts.otherIncome);
  const fieldErrors: Record<FieldKey, string | null> = {
    salaryIncome: salaryError,
    sideIncome: sideError,
    otherIncome: otherError,
  };
  const hasError = Boolean(salaryError || sideError || otherError);

  function handleAmountChange(key: FieldKey, raw: string) {
    setAmounts((prev) => ({ ...prev, [key]: formatAmountInput(raw) }));
  }

  function handleMonthSelect(nextMonth: string) {
    setMonth(nextMonth);
    const record = records.find((r) => r.month === nextMonth) ?? null;
    setAmounts(toAmounts(record));
    setMemo(record?.memo ?? '');
  }

  function handleSave() {
    if (savingRef.current) return;
    if (hasError) return;

    savingRef.current = true;
    setIsSaving(true);

    const year = Number(month.slice(0, 4));
    const hasBiz = { hasBusinessRegistration: profile?.hasBusinessRegistration ?? false };
    const beforeYearRecords = records.filter((r) => r.month.startsWith(`${year}-`));
    const beforeSummary = beforeYearRecords.length > 0 ? summarizeYear(beforeYearRecords, year) : null;
    const prevStatus = beforeSummary ? diagnose(beforeSummary, hasBiz, RULES).status : null;

    const result = upsertRecord({
      month,
      salaryIncome: amountValue(amounts.salaryIncome),
      sideIncome: amountValue(amounts.sideIncome),
      otherIncome: amountValue(amounts.otherIncome),
      memo,
    });

    if (!result.ok) {
      savingRef.current = false;
      setIsSaving(false);
      setToastMessage('저장에 실패했어요. 잠시 후 다시 시도해주세요');
      return;
    }

    const afterYearRecords = getRecords().filter((r) => r.month.startsWith(`${year}-`));
    const afterSummary = summarizeYear(afterYearRecords, year);
    const nextDiagnosis = afterSummary ? diagnose(afterSummary, hasBiz, RULES) : null;

    if (prevStatus !== null && nextDiagnosis && isWorsened(prevStatus, nextDiagnosis.status)) {
      setStatusChange({ prev: prevStatus, next: nextDiagnosis.status, reasons: nextDiagnosis.reasons, year });
      return;
    }

    const savedState = { savedMonth: month } satisfies RouteState['/'];
    navigate(parsed.from === 'history' ? '/history' : '/', { replace: true, state: savedState });
  }

  function handleStatusDialogClose() {
    setStatusChange(null);
    const savedState = { savedMonth: month } satisfies RouteState['/'];
    navigate(parsed.from === 'history' ? '/history' : '/', { replace: true, state: savedState });
  }

  function handleViewReport() {
    if (!statusChange) return;
    const reportState = { year: statusChange.year } satisfies RouteState['/report'];
    navigate('/report', { state: reportState });
  }

  const monthLabel = formatMonthLabel(month, now);
  const monthTexts = <ListRow.Texts type="1RowTypeA" top="입력할 달" />;
  const monthValue = (
    <span data-testid="record-month">
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
        {monthLabel}
      </Paragraph.Text>
    </span>
  );

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>월 소득 입력</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter label="기록 저장" onClick={handleSave} disabled={hasError || isSaving} loading={isSaving} />
      }
    >
      <Spacing size={16} />

      <ListRow onClick={() => setPickerOpen(true)} contents={monthTexts} right={monthValue}>
        {monthTexts}
        {monthValue}
      </ListRow>

      <Spacing size={16} />

      {FIELDS.map(({ key, label, placeholder }, index) => (
        <div key={key}>
          {index > 0 && <Spacing size={12} />}
          <TextField
            variant="box"
            label={label}
            placeholder={placeholder}
            inputMode="numeric"
            value={amounts[key]}
            onChange={(e) => handleAmountChange(key, e.target.value)}
            hasError={Boolean(fieldErrors[key])}
            help={fieldErrors[key] ?? undefined}
          />
        </div>
      ))}

      <Spacing size={12} />

      <TextField
        variant="box"
        label="메모"
        placeholder="메모 (선택)"
        maxLength={30}
        value={memo}
        onChange={(e) => setMemo(e.target.value.slice(0, 30))}
        help={`${memo.length}/30`}
      />

      <Spacing size={24} />

      <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
        {DISCLAIMER_TEXT}
      </Paragraph.Text>

      <Spacing size={24} />

      <MonthPickerSheet
        open={pickerOpen}
        value={month}
        now={now}
        recordedMonths={records.map((r) => r.month)}
        onSelect={handleMonthSelect}
        onClose={() => setPickerOpen(false)}
      />

      {statusChange && (
        <StatusChangeDialog
          open
          prev={statusChange.prev}
          next={statusChange.next}
          reasons={statusChange.reasons}
          onClose={handleStatusDialogClose}
          onViewReport={handleViewReport}
        />
      )}

      <Toast
        open={Boolean(toastMessage)}
        text={toastMessage ?? ''}
        position="top"
        onClose={() => setToastMessage(null)}
      />
    </ScreenScaffold>
  );
}
