import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { mockTds } from '@/__tests__/__helpers__/mocks';
import { CompareCard } from '@/components/simulate/CompareCard';
import type { AnnualSummary, DiagnosisResult, DiagnosisStatus } from '@/lib/types';

mockTds();

function makeSummary(totalAnnual: number): AnnualSummary {
  return {
    year: 2026,
    recordedMonths: 6,
    actualTotal: totalAnnual,
    salaryAnnual: totalAnnual,
    sideAnnual: 0,
    otherAnnual: 0,
    totalAnnual,
  };
}

function makeResult(status: DiagnosisStatus, totalAnnual: number): DiagnosisResult {
  return {
    year: 2026,
    status,
    reasons: status === 'DROP' ? ['TOTAL_INCOME'] : [],
    summary: makeSummary(totalAnnual),
    marginToDrop: status === 'DROP' ? 0 : 1_000_000,
    overAmount: status === 'DROP' ? totalAnnual - 20_000_000 : 0,
    totalRatioPercent: Math.floor((totalAnnual * 100) / 20_000_000),
  };
}

describe('CompareCard', () => {
  it('AC-1: DROP 결과면 상태·연 합계·월 예상 보험료가 보인다', () => {
    render(<CompareCard title="현재" result={makeResult('DROP', 20_400_000)} />);

    expect(screen.getByText('탈락 위험')).toBeInTheDocument();
    expect(screen.getByText('연 20,400,000원')).toBeInTheDocument();
    expect(screen.getByText('월 예상 보험료 138,290원')).toBeInTheDocument();
  });

  it('AC-2: SAFE 결과면 보험료 0원 문구가 보이고 월 예상 보험료 문구는 없다', () => {
    render(<CompareCard title="시뮬레이션" result={makeResult('SAFE', 10_000_000)} />);

    expect(screen.getByText('보험료 0원 (피부양자 유지)')).toBeInTheDocument();
    expect(screen.queryAllByText(/월 예상 보험료/)).toHaveLength(0);
  });

  it('AC-3: result가 null이면 안전과 연 0원이 보인다', () => {
    render(<CompareCard title="현재" result={null} />);

    expect(screen.getByText('안전')).toBeInTheDocument();
    expect(screen.getByText('연 0원')).toBeInTheDocument();
  });

  it('AC-4: 루트에 data-testid=compare-card가 있고 title 텍스트가 보인다', () => {
    render(<CompareCard title="현재" result={null} />);

    expect(screen.getByTestId('compare-card')).toBeInTheDocument();
    expect(screen.getByText('현재')).toBeInTheDocument();
  });
});
