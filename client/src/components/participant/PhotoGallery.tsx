import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Photo } from '../../types/models';
import './PhotoGallery.css';

interface PhotoGalleryProps {
  photos: Photo[];
  /** Кнопки владельца поверх фото (правый верхний угол). */
  showOwnerActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  showOwnerActions = false,
  onEdit,
  onDelete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const SWIPE_THRESHOLD = 50;

  const handlePrev = useCallback(() => {
    if (photos.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleNext = useCallback(() => {
    if (photos.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (photos.length === 0) return;
      if (event.key === 'ArrowRight') {
        handleNext();
      } else if (event.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, handleNext, handlePrev]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (photos.length <= 1) return;
      const t = e.touches[0];
      if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
    },
    [photos.length]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (photos.length <= 1 || !touchStartRef.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const deltaX = t.clientX - touchStartRef.current.x;
      const deltaY = t.clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(deltaX) <= SWIPE_THRESHOLD) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      if (deltaX < 0) handleNext();
      else handlePrev();
    },
    [photos.length, handleNext, handlePrev]
  );

  if (photos.length === 0) {
    return <div className="photo-gallery-empty">Нет фотографий</div>;
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="photo-gallery">
      <div className="photo-gallery-item">
        <div
          className="photo-gallery-image-container"
          {...(photos.length > 1
            ? { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd }
            : {})}
        >
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="photo-gallery-nav photo-gallery-nav-prev"
                onClick={handlePrev}
                aria-label="Предыдущее фото"
              >
                ‹
              </button>
              <button
                type="button"
                className="photo-gallery-nav photo-gallery-nav-next"
                onClick={handleNext}
                aria-label="Следующее фото"
              >
                ›
              </button>
            </>
          )}
          {currentPhoto && (
            <img
              key={currentPhoto.id}
              src={currentPhoto.url}
              alt={`Фото ${currentIndex + 1}`}
              className="photo-gallery-image"
            />
          )}
          {photos.length > 1 && (
            <div className="photo-gallery-counter">
              {currentIndex + 1} / {photos.length}
            </div>
          )}
          {showOwnerActions && (onEdit || onDelete) ? (
            <div className="photo-gallery-owner-actions" role="toolbar" aria-label="Действия с заявкой">
              {onEdit ? (
                <button
                  type="button"
                  className="photo-gallery-action-btn"
                  onClick={onEdit}
                  title="Редактировать заявку"
                  aria-label="Редактировать заявку"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="photo-gallery-action-btn photo-gallery-action-btn--danger"
                  onClick={onDelete}
                  title="Удалить"
                  aria-label="Удалить"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
