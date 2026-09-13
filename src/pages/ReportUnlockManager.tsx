// 상세 리포트 — 이번 달 열람 판정 + 보상형 광고 시청 플로우 + saveReportUnlock 저장.
// 렌더링 조립(카드·탭·빈 상태)은 Report.tsx가 전담하고, 이 컴포넌트는 children(리포트 본문)을
// 이번 달에 이미 열람했거나 광고 시청을 마쳤을 때만 노출한다.
import { useEffect, useState, type ReactNode } from 'react';
import { Badge, Paragraph, Spacing, Button } from '@toss/tds-mobile';
import { loadFullScreenAd, showFullScreenAd, generateHapticFeedback } from '@apps-in-toss/web-framework';
import { Card } from '@/components/Card';
import { toMonthKey } from '@/utils/format';
import { useAppData } from '@/state/AppDataContext';

const SLOT_ID = 'report-unlock';

const LOCKED_ITEMS = ['탈락 사유와 초과 금액', '예상 월 보험료', '탈락 예상 시점'];

const AD_LOAD_FAILED_TEXT = '광고를 불러오지 못했어요. 리포트를 바로 보여드릴게요';
const AD_DISMISSED_TEXT = '광고를 끝까지 보면 리포트가 열려요';

function fireSuccessHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'success' })).catch(() => {});
  } catch {
    // WebView 밖(로컬/검수 환경)에서는 throw — 조용히 무시
  }
}

export function ReportUnlockManager({
  statusLabel,
  children,
}: {
  /** 잠금 화면에 보여줄 현재 진단 상태 라벨 (예: '탈락 위험') */
  statusLabel: string;
  children?: ReactNode;
}) {
  const { reportUnlock, saveReportUnlock } = useAppData();
  const currentMonth = toMonthKey(new Date());
  const alreadyUnlocked = reportUnlock?.unlockedMonth === currentMonth;

  const [rewarded, setRewarded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const [dismissNotice, setDismissNotice] = useState<string | null>(null);

  useEffect(() => {
    if (alreadyUnlocked) return;
    try {
      loadFullScreenAd({
        slotId: SLOT_ID,
        onEvent: () => setAdLoaded(true),
        onError: () => setLoadFailed(true),
      } as Parameters<typeof loadFullScreenAd>[0]);
    } catch {
      setLoadFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyUnlocked]);

  function handleWatch() {
    if (isShowing) return;
    setIsShowing(true);
    setDismissNotice(null);

    try {
      showFullScreenAd({
        slotId: SLOT_ID,
        onEvent: (event: { type?: string }) => {
          setIsShowing(false);
          if (event?.type === 'rewarded') {
            saveReportUnlock(toMonthKey(new Date()));
            setRewarded(true);
          } else {
            setDismissNotice(AD_DISMISSED_TEXT);
          }
        },
        onError: () => {
          setIsShowing(false);
          setDismissNotice(AD_DISMISSED_TEXT);
        },
      } as Parameters<typeof showFullScreenAd>[0]);
    } catch {
      setIsShowing(false);
      setDismissNotice(AD_DISMISSED_TEXT);
    }
  }

  if (alreadyUnlocked || rewarded) {
    return <>{children}</>;
  }

  if (loadFailed) {
    return (
      <>
        <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
          {AD_LOAD_FAILED_TEXT}
        </Paragraph.Text>
        <Spacing size={12} />
        {children}
      </>
    );
  }

  return (
    <Card testId="report-gate">
      <Badge size="medium" variant="weak" color="blue">
        {statusLabel}
      </Badge>
      <Spacing size={8} />
      <Paragraph.Text typography="t5">짧은 광고를 보면 자세한 분석 결과를 볼 수 있어요</Paragraph.Text>
      <Spacing size={12} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LOCKED_ITEMS.map((item) => (
          <li key={item}>
            <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
              {item}
            </Paragraph.Text>
          </li>
        ))}
      </ul>
      {dismissNotice ? (
        <>
          <Spacing size={8} />
          <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
            {dismissNotice}
          </Paragraph.Text>
        </>
      ) : null}
      <Spacing size={16} />
      <Button
        variant="fill"
        display="block"
        onClick={() => {
          fireSuccessHaptic();
          handleWatch();
        }}
        disabled={isShowing || !adLoaded}
      >
        광고 보고 상세 리포트 열기
      </Button>
    </Card>
  );
}
