// Route state 파서 — location.state는 브라우저 뒤로가기/새로고침/직접 URL 접근으로
// null이거나 임의의 값일 수 있다. 페이지는 이 파서를 거친 값만 사용하고,
// `useLocation().state as X` 형태의 직접 구조분해를 하지 않는다.
import type { HomeState, ProfileState, RecordState } from '@/types/navigation';
import type { RouteState } from '@/lib/contract';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const PATH_TO_PAGE: Record<string, RouteState['page']> = {
  '/': 'home',
  '/profile': 'profile',
  '/record': 'record',
  '/report': 'report',
  '/history': 'history',
  '/simulate': 'simulate',
  '/settings': 'settings',
};

// URL(경로+쿼리) → { page, params } — 0019 App.tsx 라우팅 계약(contract.ts)이 요구하는 파서.
// 실제 앱은 react-router의 <Routes>로 선언적 라우팅을 하므로 이 함수는 딥링크·외부 URL
// 진입점(예: 알림 링크) 파싱용으로 쓴다. 인식 못 하는 경로는 'home'으로 안전 하강한다.
export function parseRouteState(url: string): RouteState {
  let pathname = url;
  let search = '';
  try {
    const parsed = new URL(url, 'http://localhost');
    pathname = parsed.pathname;
    search = parsed.search;
  } catch {
    const queryIndex = url.indexOf('?');
    if (queryIndex >= 0) {
      pathname = url.slice(0, queryIndex);
      search = url.slice(queryIndex);
    }
  }

  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const page = PATH_TO_PAGE[normalizedPath] ?? 'home';

  const params: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    params[key] = value;
  });

  return Object.keys(params).length > 0 ? { page, params } : { page };
}

function formatMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function prevMonthKey(now: Date): string {
  return formatMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

export function parseHomeState(state: unknown): { savedMonth: string | null } {
  if (state && typeof state === 'object' && 'savedMonth' in state) {
    const savedMonth = (state as HomeState)?.savedMonth;
    if (typeof savedMonth === 'string' && MONTH_RE.test(savedMonth)) {
      return { savedMonth };
    }
  }
  return { savedMonth: null };
}

export function parseProfileState(state: unknown): { mode: 'onboarding' | 'edit' } {
  if (state && typeof state === 'object' && 'mode' in state) {
    const mode = (state as ProfileState)?.mode;
    if (mode === 'edit' || mode === 'onboarding') return { mode };
  }
  return { mode: 'onboarding' };
}

export interface ParsedRecordState {
  month: string;
  from: 'home' | 'history';
  futureRejected: boolean;
}

export function parseRecordState(state: unknown, now: Date = new Date()): ParsedRecordState {
  const defaultMonth = prevMonthKey(now);
  const defaults: ParsedRecordState = { month: defaultMonth, from: 'home', futureRejected: false };

  if (!state || typeof state !== 'object') return defaults;

  const raw = state as RecordState;
  const from = raw?.from;
  if (from !== 'home' && from !== 'history') return defaults;

  const month = raw?.month;
  if (typeof month !== 'string' || !MONTH_RE.test(month)) {
    return { month: defaultMonth, from, futureRejected: false };
  }

  const currentMonthKey = formatMonthKey(now);
  if (month > currentMonthKey) {
    return { month: defaultMonth, from, futureRejected: true };
  }

  return { month, from, futureRejected: false };
}

export function parseYearState(state: unknown): number {
  const fallback = new Date().getFullYear();
  if (state && typeof state === 'object' && 'year' in state) {
    const year = (state as { year?: unknown }).year;
    if (typeof year === 'number' && Number.isInteger(year)) return year;
    if (typeof year === 'string') {
      const parsed = Number(year);
      if (Number.isInteger(parsed)) return parsed;
    }
  }
  return fallback;
}
