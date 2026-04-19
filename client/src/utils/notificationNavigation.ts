import type { ContestChatReplyPayload, SubmissionModerationPayload, UserNotification } from '../types/notifications';

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
  if (n.kind === 'participant_work_chat_message' || n.kind === 'participant_work_chat_reply') {
    const p = n.payload as unknown as SubmissionModerationPayload;
    const cid = String(p.contest_id || '').trim();
    const pid = String(p.participant_id || '').trim();
    if (cid && pid) {
      return `/contests/${encodeURIComponent(cid)}/participants/${encodeURIComponent(pid)}#participant-comments`;
    }
  }
  if (n.kind === 'contest_chat_reply') {
    const p = n.payload as unknown as ContestChatReplyPayload;
    const cid = String(p.contest_id || '').trim();
    if (cid) {
      return `/contests/${encodeURIComponent(cid)}#chat`;
    }
  }
  return null;
}
