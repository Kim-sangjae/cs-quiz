import { prisma } from './prisma';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAIL'
  | 'QUESTION_SUBMIT'
  | 'QUESTION_APPROVE'
  | 'QUESTION_REJECT'
  | 'QUESTION_BLIND'
  | 'QUESTION_UNBLIND'
  | 'QUESTION_DELETE'
  | 'QUESTION_EDIT'
  | 'REPORT_BLIND'
  | 'REPORT_DISMISS'
  | 'USER_ROLE_CHANGE'
  | 'USER_DEACTIVATE'
  | 'USER_REACTIVATE'
  | 'USER_DELETE'
  | 'NICKNAME_CHANGE'
  | 'INQUIRY_REPLY'
  | 'INQUIRY_STATUS_CHANGE';

interface WriteLogParams {
  actorId?: string;
  actorRole?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}

export function writeLog({ actorId, actorRole, action, targetType, targetId, payload }: WriteLogParams): void {
  prisma.auditLog.create({
    data: {
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
    },
  }).catch(() => {});
}
