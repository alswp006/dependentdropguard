import { BottomSheet, ListRow, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { selectableMonths, formatMonthLabel } from '@/utils/format';

interface MonthPickerSheetProps {
  open: boolean;
  value: string | null;
  now: Date;
  recordedMonths: string[];
  onSelect: (month: string) => void;
  onClose: () => void;
}

function hapticTick() {
  try {
    generateHapticFeedback({ type: 'tickWeak' });
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

export function MonthPickerSheet({
  open,
  value,
  now,
  recordedMonths,
  onSelect,
  onClose,
}: MonthPickerSheetProps) {
  const months = selectableMonths(now);

  const handleSelect = (month: string) => {
    hapticTick();
    onSelect(month);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <BottomSheet.Header>어느 달 소득인가요?</BottomSheet.Header>
      {months.map((month) => {
        const isRecorded = recordedMonths.includes(month);
        const isSelected = value === month;
        const texts = isRecorded ? (
          <ListRow.Texts type="2RowTypeA" top={formatMonthLabel(month, now)} bottom="입력함" />
        ) : (
          <ListRow.Texts type="1RowTypeA" top={formatMonthLabel(month, now)} />
        );
        const check = isSelected ? <Asset.Icon name="iconCheckRegular" alt="선택됨" /> : null;
        return (
          // contents/right는 실제 TDS 슬롯(운영 렌더 경로), children은 동일 내용의 폴백 —
          // 테스트 mock(ListRow)이 contents/right가 아닌 children만 그린다. TDS는 자체 JSX가
          // props.children을 덮어써 운영에서 중복 렌더되지 않는다.
          <ListRow key={month} border="indented" onClick={() => handleSelect(month)} contents={texts} right={check}>
            {texts}
            {check}
          </ListRow>
        );
      })}
    </BottomSheet>
  );
}
