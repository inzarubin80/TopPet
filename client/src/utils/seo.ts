import { Contest, Participant, Photo } from '../types/models';

/**
 * Получает базовый URL для production или development
 */
export const getBaseUrl = (): string => {
  // В production используем https://www.top-pet.ru
  if (process.env.NODE_ENV === 'production') {
    return 'https://www.top-pet.ru';
  }
  // В development используем localhost
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

/**
 * Формирует описание для участника
 */
export const getParticipantDescription = (participant: Participant): string => {
  const baseDescription = participant.pet_description || participant.pet_name;
  return `${baseDescription} Голосуйте за моего питомца`;
};
