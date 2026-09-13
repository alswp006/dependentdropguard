import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Top, Paragraph, Spacing, ListRow, Button, Tab, Toast, AlertDialog, Asset } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Sparkline } from '@/components/Sparkline';
import { AdSlot } from '@/components/AdSlot';
import { EmptyState } from '@/components/StateView';
import { summarizeYear } from '@/domain/diagnosis';
import { formatWon, formatMonthLabel, prevMonthKey } from '@/utils/format';
import { parseHomeState } from '@/lib/routeState';
import { useAppData } from '@/state/AppDataContext';
import type { RouteState } from '@/types/navigation';

function fireTickWeakHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

export default function History() {
  const navigate = useNavigate();
  const location = useLocation();
  const { records, deleteRecord } = useAppData();

  const now = new Date();
  const currentYear = now.getFullYear();
  const YEARS = [currentYear, currentYear - 1];

  const historyState = parseHomeState(location.state);
  const [selectedYear, setSelectedYear] = useState(() =>
    historyState.savedMonth && YEARS.includes(Number(historyState.savedMonth.slice(0, 4)))
      ? Number(historyState.savedMonth.slice(0, 4))
      : currentYear,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(() =>
    historyState.savedMonth ? `${formatMonthLabel(historyState.savedMonth, now)} 소득을 저장했어요` : null,
  );
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const yearRecords = records.filter((r) => r.month.startsWith(`${selectedYear}-`));
  const actualTotal = summarizeYear(records, selectedYear)?.actualTotal ?? 0;
  const sparklineData = yearRecords.map((r) => r.salaryIncome + r.sideIncome + r.otherIncome);

  function goToRecord(month: string) {
    navigate('/record', { state: { month, from: 'history' } as RouteState['/record'] });
  }

  function handleTabChange(index: number) {
    const year = YEARS[index];
    if (year === undefined || year === selectedYear) return;
    fireTickWeakHaptic();
    setSelectedYear(year);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const result = deleteRecord(deleteTarget);
    setDeleteTarget(null);
    setToastMessage(result.ok ? '기록을 삭제했어요' : '삭제하지 못했어요');
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>기록</Top.TitleParagraph>} />}>
      <Spacing size={16} />

      <Tab onChange={handleTabChange}>
        {YEARS.map((year, index) => (
          <Tab.Item key={year} selected={selectedYear === year} onClick={() => handleTabChange(index)}>
            {`${year}년`}
          </Tab.Item>
        ))}
      </Tab>

      <Spacing size={16} />

      {yearRecords.length === 0 ? (
        <EmptyState
          testId="history-empty-state"
          icon={<Asset.ContentIcon name="iconWriteRegular" alt="입력" style={{ width: 48, height: 48 }} />}
          title="아직 입력한 소득이 없어요"
          action={
            <Button variant="weak" onClick={() => goToRecord(prevMonthKey(now))}>
              소득 입력하기
            </Button>
          }
        />
      ) : (
        <>
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            누적 실제 소득
          </Paragraph.Text>
          <Paragraph.Text typography="t3" style={{ wordBreak: 'keep-all' }}>
            {formatWon(actualTotal)}
          </Paragraph.Text>

          <Spacing size={12} />

          {yearRecords.length >= 2 ? <Sparkline testId="history-sparkline" data={sparklineData} /> : null}

          <Spacing size={16} />

          {yearRecords.map((record) => {
            const monthTotal = record.salaryIncome + record.sideIncome + record.otherIncome;
            const monthLabel = formatMonthLabel(record.month, now);
            const texts = (
              <ListRow.Texts
                type="2RowTypeA"
                top={monthLabel}
                bottom={`본업 ${formatWon(record.salaryIncome)} · 부업 ${formatWon(record.sideIncome)}`}
              />
            );
            const right = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Paragraph.Text typography="t6">{formatWon(monthTotal)}</Paragraph.Text>
                <Button
                  size="small"
                  variant="weak"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(record.month);
                  }}
                >
                  삭제
                </Button>
              </div>
            );
            return (
              <div key={record.month} data-testid={`history-row-${record.month}`}>
                <ListRow onClick={() => goToRecord(record.month)} contents={texts} right={right}>
                  {texts}
                  {right}
                </ListRow>
              </div>
            );
          })}
        </>
      )}

      <Spacing size={24} />

      {import.meta.env.VITE_TOSS_AD_GROUP_ID ? (
        <div data-testid="history-ad-slot">
          <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
        </div>
      ) : null}

      <Spacing size={32} />
      <Spacing size={32} />
      <Spacing size={32} />

      <AlertDialog
        open={deleteTarget !== null}
        title={deleteTarget ? `${formatMonthLabel(deleteTarget, now)} 기록을 삭제할까요?` : ''}
        onClose={() => setDeleteTarget(null)}
        alertButton={<AlertDialog.AlertButton onClick={handleDeleteConfirm}>삭제</AlertDialog.AlertButton>}
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
