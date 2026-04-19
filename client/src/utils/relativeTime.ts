/** Короткое относительное время для UI (ru). */
export function formatRelativeTime(iso: string): string {
  if (!iso) {
    return '';
  }
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    return '';
  }
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) {
    return 'только что';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} мин`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return `${diffH} ч`;
  }
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) {
    return `${diffD} д`;
  }
  return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
