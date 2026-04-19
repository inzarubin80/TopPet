import type { SubmissionModerationPayload, UserNotification } from '../types/notifications';

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
  return 'Новое уведомление';
}
