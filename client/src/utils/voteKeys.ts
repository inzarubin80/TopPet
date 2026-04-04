/** Ключ слота голоса в Redux: пустая строка — конкурс без номинаций / общий слот. */
export function nominationVoteKey(nominationId: string | null | undefined): string {
  const t = nominationId?.trim();
  return t ?? '';
}
