// 표시 포맷 유틸 — 날짜 관련 함수는 모두 now: Date를 인자로 받는다 (테스트 고정 가능)

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatMonthLabel(month: string, now: Date): string {
  const [yearStr, monthStr] = month.split('-');
  const monthNum = Number(monthStr);
  if (Number(yearStr) === now.getFullYear()) {
    return `${monthNum}월`;
  }
  return `${yearStr}년 ${monthNum}월`;
}

export function formatYearMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  return `${yearStr}년 ${Number(monthStr)}월`;
}

export function prevMonthKey(now: Date): string {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return toMonthKey(prev);
}

export function isValidMonthKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

export function selectableMonths(now: Date): string[] {
  const months: string[] = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(toMonthKey(d));
  }
  return months;
}

export function formatAmountInput(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits === '') return '';
  return Number(digits).toLocaleString('ko-KR');
}

export function parseAmountInput(input: string): number | null {
  const digits = input.replace(/\D/g, '');
  if (digits === '') return null;
  return Number(digits);
}
