// Route state type contracts — re-exported from lib/types
// Each route's location.state shape is defined here

export type HomeState = { savedMonth: string } | null;
export type ProfileState = { mode: 'onboarding' | 'edit' } | null;
export type RecordState = { month: string; from: 'home' | 'history' } | null;
export type HistoryState = { savedMonth: string } | null;
export type ReportState = { year: number } | null;
export type SimulateState = { year: number } | null;

// RouteState: Maps each route path to its state type
export type RouteState = {
  '/': HomeState;
  '/profile': ProfileState;
  '/record': RecordState;
  '/history': HistoryState;
  '/report': ReportState;
  '/simulate': SimulateState;
  '/settings': undefined;
};
