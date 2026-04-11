import { Contest, Participant, Photo } from '../types/models';
import { BRAND_NAME, SITE_URL } from '../config/brand';

/** Совпадает с суффиксом og:description на сервере ([`meta_html.go`](Server/internal/app/http/meta_html.go)). */
const PARTICIPANT_META_CTA = ` Участвуйте в конкурсе на ${BRAND_NAME}!`;

/**
 * Получает базовый URL для production или development
 */
export const getBaseUrl = (): string => {
  if (process.env.NODE_ENV === 'production') {
    return SITE_URL;
  }
  return 'http://localhost:3000';
};

/**
 * Формирует абсолютный URL для страницы конкурса
 */
export const getContestUrl = (contestId: string): string => {
  return `${getBaseUrl()}/contests/${contestId}`;
};

/**
 * Формирует абсолютный URL для страницы участника
 */
export const getParticipantUrl = (contestId: string, participantId: string): string => {
  return `${getBaseUrl()}/contests/${contestId}/participants/${participantId}`;
};

/**
 * Получает изображение для метатегов
 * Если есть фото, возвращает его URL, иначе дефолтное изображение
 */
export const getMetaImage = (photo?: Photo | null): string => {
  if (photo?.url) {
    // Если URL уже абсолютный, возвращаем как есть
    if (photo.url.startsWith('http://') || photo.url.startsWith('https://')) {
      return photo.url;
    }
    // Иначе формируем абсолютный URL (если фото хранится на том же домене)
    // В данном случае фото хранится на S3/CDN, поэтому URL уже абсолютный
    return photo.url;
  }
  // Дефолтное изображение - используем иконку сайта
  return `${getBaseUrl()}/icon.svg`;
};

/** Абсолютный URL для обложки/логотипа конкурса (http(s) или путь от корня сайта). */
export const resolvePublicAssetUrl = (url: string): string => {
  const u = url.trim();
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${getBaseUrl()}${u}`;
  return `${getBaseUrl()}/${u}`;
};

/** Картинка для шаринга страницы конкурса: обложка конкурса или первое фото участника. */
export const getContestShareImage = (contest: Contest, firstPhoto: Photo | null): string => {
  const cover = contest.cover_url?.trim();
  if (cover) {
    return resolvePublicAssetUrl(cover);
  }
  return getMetaImage(firstPhoto);
};

/**
 * Получает первое фото из массива участников
 */
export const getFirstParticipantPhoto = (participants: Participant[]): Photo | null => {
  for (const participant of participants) {
    if (participant.photos && participant.photos.length > 0) {
      // Сортируем по position если есть, иначе берем первое
      const sortedPhotos = [...participant.photos].sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        return posA - posB;
      });
      return sortedPhotos[0];
    }
  }
  return null;
};

/**
 * Формирует описание для конкурса
 */
export const getContestDescription = (contest: Contest): string => {
  const baseDescription = contest.description || contest.title;
  return `${baseDescription} Добавляйте своих питомцев`;
};

function trimText(s?: string): string {
  return (s ?? '').trim();
}

/** Заголовок работы для страницы и meta: как `ServeParticipant` на сервере. */
export function getParticipantDisplayTitle(participant: Participant): string {
  let t = trimText(participant.entry_title);
  if (!t) t = trimText(participant.pet_name);
  if (!t) return 'Заявка участника';
  return t;
}

/**
 * Краткая подпись с именем питомца, если оно отличается от заголовка работы.
 */
export function getParticipantPetNameSubtitle(participant: Participant): string | undefined {
  const title = getParticipantDisplayTitle(participant);
  const pet = trimText(participant.pet_name);
  if (!pet || pet === title) return undefined;
  return pet;
}

/**
 * Описание для meta (og:description / twitter), в духе серверного `participantDescription`.
 */
export const getParticipantDescription = (participant: Participant): string => {
  const entryTitle = getParticipantDisplayTitle(participant);
  let body = trimText(participant.entry_description);
  if (!body) body = trimText(participant.pet_description);
  if (!body) {
    return `Заявка «${entryTitle}» на ${BRAND_NAME}.`;
  }
  const oneLine = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return oneLine + PARTICIPANT_META_CTA;
};
