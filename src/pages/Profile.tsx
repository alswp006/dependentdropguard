import { useState } from 'react';
import { Top, Paragraph, Spacing, ListRow, Asset, Toast } from '@toss/tds-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { Card } from '@/components/Card';
import { useAppData } from '@/state/AppDataContext';
import { parseProfileState } from '@/lib/routeState';
import { DISCLAIMER_TEXT } from '@/domain/rules';

const OPTIONS = [
  { value: true, label: '있어요', testId: 'biz-option-yes' },
  { value: false, label: '없어요', testId: 'biz-option-no' },
] as const;

export default function Profile() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, saveProfile } = useAppData();
  const { mode } = parseProfileState(location.state);

  const [selected, setSelected] = useState<boolean | null>(
    mode === 'edit' && profile ? profile.hasBusinessRegistration : null,
  );
  const [toastOpen, setToastOpen] = useState(false);

  const handleSave = () => {
    if (selected === null) return;
    const result = saveProfile({ hasBusinessRegistration: selected });
    if (!result.ok) {
      setToastOpen(true);
      return;
    }
    navigate(mode === 'onboarding' ? '/' : '/settings', { replace: true });
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>사업자등록 여부</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label={mode === 'onboarding' ? '시작하기' : '저장하기'}
          onClick={handleSave}
          disabled={selected === null}
        />
      }
    >
      <Paragraph.Text typography="t6" color="secondary">
        부업 사업자등록이 있나요?
      </Paragraph.Text>
      <Spacing size={8} />
      <Card>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          const texts = <ListRow.Texts type="1RowTypeA" top={opt.label} />;
          const check = isSelected ? <Asset.Icon name="iconCheckRegular" alt="선택됨" /> : null;
          return (
            <ListRow
              key={opt.testId}
              data-testid={opt.testId}
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(opt.value)}
              contents={texts}
              right={check}
            >
              {texts}
              {check}
            </ListRow>
          );
        })}
      </Card>
      <Spacing size={24} />
      <Paragraph.Text typography="t7" color="tertiary">
        {DISCLAIMER_TEXT}
      </Paragraph.Text>
      <Toast
        open={toastOpen}
        text="저장하지 못했어요. 다시 시도해주세요"
        position="top"
        onClose={() => setToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
