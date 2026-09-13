import { Fragment } from 'react';
import { AlertDialog } from '@toss/tds-mobile';
import type { DiagnosisStatus, DropReason } from '@/lib/types';
import { STATUS_LABEL, REASON_TEXT } from '@/domain/rules';

interface StatusChangeDialogProps {
  open: boolean;
  prev: DiagnosisStatus;
  next: DiagnosisStatus;
  reasons: DropReason[];
  onClose: () => void;
  onViewReport: () => void;
}

export function StatusChangeDialog({
  open,
  prev,
  next,
  reasons,
  onClose,
  onViewReport,
}: StatusChangeDialogProps) {
  return (
    <AlertDialog
      open={open}
      title={
        <>
          {"피부양자 상태가 '"}
          <span>{STATUS_LABEL[prev]}</span>
          {"'에서 '"}
          <span>{STATUS_LABEL[next]}</span>
          {"'(으)로 바뀌었어요"}
        </>
      }
      description={
        <>
          {reasons.map((reason, index) => (
            <Fragment key={reason}>
              {index > 0 && <br />}
              <span>{REASON_TEXT[reason]}</span>
            </Fragment>
          ))}
        </>
      }
      onClose={onClose}
      alertButton={
        <>
          <AlertDialog.AlertButton onClick={onClose}>닫기</AlertDialog.AlertButton>
          <AlertDialog.AlertButton onClick={onViewReport}>리포트 보기</AlertDialog.AlertButton>
        </>
      }
    />
  );
}
