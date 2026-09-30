// 신고 처리 완료 시 선택하는 사유 — 관리자 UI 드롭다운과 알림 메시지에서 공용으로 사용
export const REPORT_RESOLUTION_REASONS = [
  { value: 'FIXED', label: '문제 내용을 수정했습니다' },
  { value: 'BLINDED', label: '문제를 비공개 처리했습니다' },
  { value: 'NO_ISSUE', label: '확인 결과 문제가 없습니다' },
  { value: 'OTHER', label: '기타' },
] as const;

export type ReportResolutionReason = (typeof REPORT_RESOLUTION_REASONS)[number]['value'];

export function reportResolutionLabel(value: string | null | undefined): string {
  return REPORT_RESOLUTION_REASONS.find((r) => r.value === value)?.label ?? '처리 완료';
}
