import type { UserNotification } from '../types/notifications';
import type { SubmissionModerationPayload } from '../types/notifications';

/**
 * Путь для react-router по текущему контракту.
 * Возвращает null, если навигация не определена.
 */
export function getNotificationNavigatePath(n: UserNotification): string | null {
  if (n.kind === 'submission_accepted' || n.kind === 'submission_rejected') {
    const p = n.payload as unknown as SubmissionModerationPayload;
    const cid = String(p.contest_id || '').trim();
    const pid = String(p.participant_id || '').trim();
    if (cid && pid) {
      return `/contests/${encodeURIComponent(cid)}/participants/${encodeURIComponent(pid)}`;
    }
  }
  return null;
}
