import { Badge, Paragraph, Spacing } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import type { DiagnosisResult, DiagnosisStatus } from '@/lib/types';
import { estimatePremium } from '@/domain/diagnosis';
import { RULES, STATUS_LABEL } from '@/domain/rules';
import { formatWon } from '@/utils/format';

const STATUS_BADGE_COLOR: Record<DiagnosisStatus, 'green' | 'yellow' | 'red'> = {
  SAFE: 'green',
  WARNING: 'yellow',
  DROP: 'red',
};

interface CompareCardProps {
  title: '현재' | '시뮬레이션';
  result: DiagnosisResult | null;
}

export function CompareCard({ title, result }: CompareCardProps) {
  const status: DiagnosisStatus = result?.status ?? 'SAFE';
  const totalAnnual = result?.summary.totalAnnual ?? 0;
  const monthlyPremium = result ? estimatePremium(result.summary.totalAnnual, RULES).totalMonthly : 0;

  return (
    <Card testId="compare-card">
      <Paragraph.Text typography="t6" color="var(--adaptiveGrey600)">
        {title}
      </Paragraph.Text>
      <Spacing size={8} />
      <Badge size="medium" variant="weak" color={STATUS_BADGE_COLOR[status]}>
        {STATUS_LABEL[status]}
      </Badge>
      <Spacing size={8} />
      <div style={{ wordBreak: 'keep-all' }}>
        <Paragraph.Text typography="t3">{`연 ${formatWon(totalAnnual)}`}</Paragraph.Text>
      </div>
      <Spacing size={4} />
      <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
        {status === 'DROP'
          ? `월 예상 보험료 ${formatWon(monthlyPremium)}`
          : '보험료 0원 (피부양자 유지)'}
      </Paragraph.Text>
    </Card>
  );
}
