import { BottomSheet, ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import type { RuleSet } from '@/lib/types';
import { RULES, buildRuleDescriptions, DISCLAIMER_TEXT } from '@/domain/rules';

interface RulesSheetProps {
  open: boolean;
  onClose: () => void;
  rules?: RuleSet;
}

export function RulesSheet({ open, onClose, rules = RULES }: RulesSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <BottomSheet.Header>계산 기준</BottomSheet.Header>
      {buildRuleDescriptions(rules).map((line) => {
        // contents는 실제 TDS 슬롯(운영 렌더 경로), children은 동일 내용의 폴백 —
        // 테스트 mock(ListRow)이 contents가 아닌 children만 그린다.
        const texts = <ListRow.Texts type="1RowTypeA" top={line} />;
        return (
          <ListRow key={line} border="indented" contents={texts}>
            {texts}
          </ListRow>
        );
      })}
      <Spacing size={16} />
      <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
        {DISCLAIMER_TEXT}
      </Paragraph.Text>
    </BottomSheet>
  );
}
