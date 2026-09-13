import { Outlet } from 'react-router-dom';
import { FloatingTabBar, type TabItem } from './FloatingTabBar';

export const TAB_ITEMS: TabItem[] = [
  { label: '홈', path: '/' },
  { label: '기록', path: '/history' },
  { label: '시뮬레이션', path: '/simulate' },
  { label: '설정', path: '/settings' },
];

/**
 * 탭-루트 화면(홈/기록/시뮬레이션/설정) 공통 레이아웃.
 * 하단 고정 탭바가 본문 마지막 콘텐츠를 가리지 않도록 탭바 높이만큼 여백을 둔다.
 */
export function TabLayout() {
  return (
    <>
      <Outlet />
      <div
        aria-hidden="true"
        style={{ height: 'calc(64px + var(--toss-safe-area-bottom, env(safe-area-inset-bottom)))' }}
      />
      <FloatingTabBar items={TAB_ITEMS} />
    </>
  );
}
