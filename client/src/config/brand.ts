/** Публичный бренд и базовый URL сайта (единая точка смены названия). */
export const BRAND_NAME = 'ShotContest';

/** Подзаголовки и краткие описания. */
export const BRAND_TAGLINE =
  'Платформа фотоконкурсов. Создавайте конкурсы, участвуйте, голосуйте за работы.';

/** Длинное описание для meta description (статический index.html и поисковики). */
export const BRAND_META_DESCRIPTION =
  'ShotContest — платформа фотоконкурсов. Создавайте конкурсы, участвуйте, голосуйте за работы участников.';

/** Канонический origin продакшен-сайта (без завершающего слэша). */
export const SITE_URL = 'https://www.shotcontest.ru';

/** Заголовок вкладки вида «Фрагмент — ShotContest». */
export function brandTabTitle(fragment: string): string {
  return `${fragment} — ${BRAND_NAME}`;
}
