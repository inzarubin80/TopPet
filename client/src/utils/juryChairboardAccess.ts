import type { Contest, ContestStatus } from '../types/models';
import { getEffectiveContestStatus } from './contestEffectiveStatus';

/** Как `juryScoresContestAllowsRead` на сервере. */
export function juryScoresContestAllowsRead(status: ContestStatus): boolean {
  return status === 'registration' || status === 'voting' || status === 'finished';
}

/**
 * Можно ли запросить GET …/jury-chairboard для эффективной фазы (как `juryChairboardContestAllowsRead` на сервере).
 */
export function juryChairboardContestAllowsReadForStatus(status: ContestStatus): boolean {
  if (juryScoresContestAllowsRead(status)) {
    return true;
  }
  return status === 'draft' || status === 'publication';
}

export function juryChairboardContestAllowsRead(contest: Contest, now?: Date): boolean {
  return juryChairboardContestAllowsReadForStatus(getEffectiveContestStatus(contest, now));
}

const STATUS_LABEL_RU: Record<ContestStatus, string> = {
  draft: 'черновик',
  publication: 'публикация',
  registration: 'приём заявок',
  voting: 'голосование',
  finished: 'завершён',
};

/** Текст, если по фазе конкурса сервер не отдаёт свод председателя (редко — при нестандартном статусе). */
export function getJuryChairboardPhaseBlockedMessage(contest: Contest, now?: Date): string | null {
  if (juryChairboardContestAllowsRead(contest, now)) {
    return null;
  }
  const phase = getEffectiveContestStatus(contest, now);
  const label = STATUS_LABEL_RU[phase] ?? phase;
  return `Свод председателя жюри сейчас недоступен: эффективная фаза конкурса «${label}». Обычно данные открыты в черновике, публикации, приёме заявок, голосовании и после завершения. Обновите страницу, если недавно менялось расписание.`;
}

/** Сообщение при 403 от API, когда клиент ожидал успех (рассинхрон фазы или прав). */
export function juryChairboardForbiddenHintMessage(): string {
  return 'Доступ к своду запрещён: сменилась фаза конкурса, нет прав председателя/организатора или отключено голосование жюри. Обновите страницу.';
}
