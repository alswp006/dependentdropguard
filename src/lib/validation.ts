// 폼 검증 — 금액·메모 입력값을 사용자에게 보여줄 에러 문구로 변환한다.
// 반환값: 유효하면 null, 무효하면 원인+해결을 담은 에러 문구.

const MAX_AMOUNT = 1_000_000_000; // 10억원

export function validateAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return '금액을 입력해주세요';

  const normalized = trimmed.replace(/,/g, '');
  if (!/^\d+$/.test(normalized)) return '숫자만 입력해주세요';

  const amount = Number(normalized);
  if (amount > MAX_AMOUNT) return '월 소득은 10억원 이하로 입력해주세요';

  return null;
}

export function validateMemo(memo: string): string | null {
  if (memo.length > 30) return '메모는 30자 이내로 입력해주세요';
  return null;
}

// 이미 숫자로 파싱된 단일 금액 필드 검증 (예: Simulate 페이지의 부업 소득 입력).
// validateAmount(string)와 같은 상한·정수 규칙을 쓰되, 파싱은 호출자가 끝낸 값을 받는다.
export function validateRecord(amountKrw: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(amountKrw) || !Number.isInteger(amountKrw) || amountKrw < 0) {
    return { valid: false, error: '올바른 금액을 입력해주세요' };
  }
  if (amountKrw > MAX_AMOUNT) {
    return { valid: false, error: '월 소득은 10억원 이하로 입력해주세요' };
  }
  return { valid: true };
}
