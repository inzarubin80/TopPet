import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { Photo } from '../../types/models';
import { fetchPhotoLike, likePhoto, unlikePhoto, setPhotoLike } from '../../store/slices/photoLikesSlice';
import { buildLoginUrl } from '../../utils/navigation';
import './PhotoGallery.css';

interface PhotoGalleryProps {
  photos: Photo[];
  participantId: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, participantId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const photoLikes = useSelector((state: RootState) => state.photoLikes.likes);
  const loadingLikes = useSelector((state: RootState) => state.photoLikes.loading);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const SWIPE_THRESHOLD = 50;

  // Initialize likes from photos data and fetch if missing
  useEffect(() => {
    if (photos.length > 0) {
      photos.forEach((photo) => {
        // Check if photo has like data from API (including null values)
        const hasLikeData = photo.is_liked !== undefined || photo.like_count !== undefined;
        
        if (hasLikeData) {
          // Always update from photo data to ensure fresh state after reload
          // Use ?? instead of || to properly handle null values
          // Check if data actually changed to avoid unnecessary updates
          const currentLike = photoLikes[photo.id];
          const newLikeCount = photo.like_count ?? 0;
          const newIsLiked = photo.is_liked ?? false;
          
          if (!currentLike || currentLike.like_count !== newLikeCount || currentLike.is_liked !== newIsLiked) {
            dispatch(setPhotoLike({
              photoId: photo.id,
              like_count: newLikeCount,
              is_liked: newIsLiked,
            }));
          }
        } else {
          // Fetch if no data available and not in store
          if (!photoLikes[photo.id]) {
            dispatch(fetchPhotoLike(photo.id));
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, photos]);

  const handlePrev = useCallback(() => {
    if (photos.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleNext = useCallback(() => {
    if (photos.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  // Keyboard navigation
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

  const handleLikeClick = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const returnUrl = location.pathname + location.search;
      navigate(buildLoginUrl(returnUrl));
      return;
    }
    const currentLike = photoLikes[photoId];
    if (currentLike?.is_liked) {
      dispatch(unlikePhoto(photoId));
    } else {
      dispatch(likePhoto(photoId));
    }
  };

  if (photos.length === 0) {
    return <div className="photo-gallery-empty">Нет фотографий</div>;
  }

  const currentPhoto = photos[currentIndex];
  const likeData = photoLikes[currentPhoto.id] || { 
    like_count: currentPhoto.like_count ?? 0, 
    is_liked: currentPhoto.is_liked ?? false 
  };
  const isLoading = loadingLikes[currentPhoto.id] || false;

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
        <div className="photo-gallery-actions">
          <button
            type="button"
            className={`photo-gallery-like-button ${likeData.is_liked ? 'photo-gallery-like-button-active' : ''} ${!isAuthenticated ? 'photo-gallery-like-button-unauthorized' : ''}`}
            onClick={(e) => currentPhoto && handleLikeClick(currentPhoto.id, e)}
            disabled={isLoading}
          >
            <span className="photo-gallery-like-icon">
              {likeData.is_liked ? '❤️' : '🤍'}
            </span>
            <span className="photo-gallery-like-count-text">
              {likeData.like_count > 0 ? likeData.like_count : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
