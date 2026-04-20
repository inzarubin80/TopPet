import type {
  ContestChatReplyPayload,
  ParticipantWorkChatPayload,
  SubmissionModerationPayload,
  UserNotification,
  WorkLikedPayload,
} from '../types/notifications';

/** Текст для списка, тоста и подсказок по kind + payload. */
export function getNotificationLineText(n: UserNotification): string {
  const p = n.payload as unknown as SubmissionModerationPayload;
  const entry = (p.entry_title || '').trim() || 'Ваша работа';
  const contest = (p.contest_title || '').trim() || 'конкурс';
  if (n.kind === 'submission_accepted') {
    return `Заявка «${entry}» принята в конкурсе «${contest}»`;
  }
  if (n.kind === 'submission_rejected') {
    return `Заявка «${entry}» отклонена в конкурсе «${contest}»`;
  }
  if (n.kind === 'participant_work_chat_message') {
    const w = n.payload as unknown as ParticipantWorkChatPayload;
    const who = (w.author_name || '').trim() || 'Участник';
    return `Новое сообщение в чате работы «${entry}» от ${who} (${contest})`;
  }
  if (n.kind === 'participant_work_chat_reply') {
    const w = n.payload as unknown as ParticipantWorkChatPayload;
    const who = (w.author_name || '').trim() || 'Участник';
    return `Ответ на ваш комментарий к работе «${entry}» от ${who} (${contest})`;
  }
  if (n.kind === 'contest_chat_reply') {
    const c = n.payload as unknown as ContestChatReplyPayload;
    const who = (c.author_name || '').trim() || 'Участник';
    return `Ответ на ваше сообщение в чате конкурса «${contest}» от ${who}`;
  }
  if (n.kind === 'work_liked') {
    const w = n.payload as unknown as WorkLikedPayload;
    const who = (w.author_name || '').trim() || 'Участник';
    return `${who} оценил(а) работу «${entry}» (${contest})`;
  }
  return 'Новое уведомление';
}
