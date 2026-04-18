import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Photo } from '../../types/models';
import './PhotoGallery.css';

interface PhotoGalleryProps {
  photos: Photo[];
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos }) => {
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
        </div>
      </div>
    </div>
  );
};
