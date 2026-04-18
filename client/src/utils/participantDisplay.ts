import type { Participant } from '../types/models';

/** Подпись автора работы для карточек и страницы участника. */
export function participantAuthorDisplayName(
  participant: Pick<Participant, 'author_name' | 'user_name' | 'user_id'>,
  options?: { isOwner?: boolean }
): string {
  const fromAuthor = (participant.author_name ?? '').trim();
  if (fromAuthor) {
    return fromAuthor;
  }
  if (options?.isOwner) {
    return 'Вы';
  }
  return (participant.user_name ?? '').trim() || `Пользователь ${participant.user_id}`;
}
