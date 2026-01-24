import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { createParticipant, updateParticipant, uploadPhoto, uploadVideo, deletePhoto, updatePhotoOrder, fetchParticipantsByContest } from '../../store/slices/participantsSlice';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { FileUpload } from '../common/FileUpload';
import { ContestID, Participant, Photo } from '../../types/models';
import { buildLoginUrl } from '../../utils/navigation';
import './AddParticipantModal.css';

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId: ContestID;
  participant?: Participant | null;
}

export const AddParticipantModal: React.FC<AddParticipantModalProps> = ({
  isOpen,
  onClose,
  contestId,
  participant,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const isEditMode = !!participant;
  
  const [petName, setPetName] = useState('');
  const [petDescription, setPetDescription] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<Set<string>>(new Set());
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [existingVideo, setExistingVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const wasOpenRef = useRef(false);

  // Redirect to login only when modal opens without auth
  useEffect(() => {
    if (isOpen && !wasOpenRef.current && !isAuthenticated) {
      console.log('[AddParticipantModal] Closing due to missing auth', {
        contestId,
        isOpen,
        isAuthenticated,
      });
      onClose();
      const returnUrl = `/contests/${contestId}`;
      navigate(buildLoginUrl(returnUrl));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, isAuthenticated, navigate, contestId, onClose]);

  // Load participant data when in edit mode
  useEffect(() => {
    if (isOpen && participant) {
      setPetName(participant.pet_name || '');
      setPetDescription(participant.pet_description || '');
      setExistingPhotos(participant.photos ? [...participant.photos] : []);
      setPhotosToDelete(new Set());
      setSelectedPhotos([]);
      setSelectedVideo(null);
      setExistingVideo(participant.video?.url || null);
      setError(null);
    } else if (isOpen && !participant) {
      // Reset for create mode
      setPetName('');
      setPetDescription('');
      setExistingPhotos([]);
      setPhotosToDelete(new Set());
      setSelectedPhotos([]);
      setSelectedVideo(null);
      setExistingVideo(null);
      setError(null);
    }
  }, [isOpen, participant]);

  const handlePhotoSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Размер файла не должен превышать 10MB');
      return;
    }

    setSelectedPhotos((prev) => [...prev, file]);
    setError(null);
  };

  const handleVideoSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Пожалуйста, выберите видео');
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Размер файла не должен превышать 100MB');
      return;
    }

    setSelectedVideo(file);
    setError(null);
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (photoId: string) => {
    setPhotosToDelete((prev) => {
      const next = new Set(prev);
      next.add(photoId);
      return next;
    });
    setExistingPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  };

  const removeVideo = () => {
    setSelectedVideo(null);
    if (isEditMode) {
      setExistingVideo(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      return;
    }

    setExistingPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    // Double check authentication before submitting
    if (!isAuthenticated) {
      onClose();
      const returnUrl = `/contests/${contestId}`;
      navigate(buildLoginUrl(returnUrl));
      return;
    }
    e.preventDefault();
    if (!petName.trim()) {
      setError('Имя животного обязательно');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let participantId: string;

      if (isEditMode && participant) {
        // Update existing participant
        const result = await dispatch(
          updateParticipant({
            participantId: participant.id,
            data: {
              pet_name: petName.trim(),
              pet_description: petDescription.trim(),
            },
          })
        );

        if (!updateParticipant.fulfilled.match(result)) {
          const errorMessage = result.payload as string || 'Не удалось обновить участника';
          setError(errorMessage);
          setLoading(false);
          return;
        }

        participantId = participant.id;

        // Delete photos marked for deletion
        if (photosToDelete.size > 0) {
          setUploadingMedia(true);
          try {
            for (const photoId of Array.from(photosToDelete)) {
              const deleteResult = await dispatch(deletePhoto({ participantId, photoId }));
              if (deletePhoto.rejected.match(deleteResult)) {
                console.error('Failed to delete photo:', deleteResult.payload);
              }
            }
          } catch (err) {
            console.error('Error deleting photos:', err);
          }
        }

        const newPhotoIds: string[] = [];

        // Upload new photos
        if (selectedPhotos.length > 0) {
          setUploadingMedia(true);
          try {
            for (const photo of selectedPhotos) {
              const photoResult = await dispatch(uploadPhoto({ participantId, file: photo }));
              if (uploadPhoto.rejected.match(photoResult)) {
                console.error('Failed to upload photo:', photoResult.payload);
              } else {
                newPhotoIds.push(photoResult.payload.photo.id);
              }
            }
          } catch (err) {
            console.error('Error uploading photos:', err);
          }
        }

        // Update photo order (existing + new)
        const orderedPhotoIds = [
          ...existingPhotos.map((photo) => photo.id),
          ...newPhotoIds,
        ];
        if (orderedPhotoIds.length > 0) {
          const orderResult = await dispatch(updatePhotoOrder({ participantId, photoIds: orderedPhotoIds }));
          if (updatePhotoOrder.rejected.match(orderResult)) {
            console.error('Failed to update photo order:', orderResult.payload);
          }
        }

        // Upload new video if selected
        if (selectedVideo) {
          setUploadingMedia(true);
          try {
            const videoResult = await dispatch(uploadVideo({ participantId, file: selectedVideo }));
            if (uploadVideo.rejected.match(videoResult)) {
              console.error('Failed to upload video:', videoResult.payload);
            }
          } catch (err) {
            console.error('Error uploading video:', err);
          }
        }
      } else {
        // Create new participant
        const result = await dispatch(
          createParticipant({
            contestId,
            data: {
              pet_name: petName.trim(),
              pet_description: petDescription.trim(),
            },
          })
        );

        if (!createParticipant.fulfilled.match(result)) {
          const errorMessage = result.payload as string || 'Не удалось добавить участника';
          setError(errorMessage);
          setLoading(false);
          return;
        }

        participantId = result.payload.id;

        // Upload photos if any
        if (selectedPhotos.length > 0) {
          setUploadingMedia(true);
          try {
            for (const photo of selectedPhotos) {
              const photoResult = await dispatch(uploadPhoto({ participantId, file: photo }));
              if (uploadPhoto.rejected.match(photoResult)) {
                console.error('Failed to upload photo:', photoResult.payload);
              }
            }
          } catch (err) {
            console.error('Error uploading photos:', err);
          }
        }

        // Upload video if selected
        if (selectedVideo) {
          setUploadingMedia(true);
          try {
            const videoResult = await dispatch(uploadVideo({ participantId, file: selectedVideo }));
            if (uploadVideo.rejected.match(videoResult)) {
              console.error('Failed to upload video:', videoResult.payload);
            }
          } catch (err) {
            console.error('Error uploading video:', err);
          }
        }
      }

      setUploadingMedia(false);
      setLoading(false);

      // Refresh participants list
      await dispatch(fetchParticipantsByContest(contestId));

      // Close modal
      onClose();
      
      // Navigate to participant page if creating new, or stay on contest page if editing
      if (!isEditMode) {
        navigate(`/contests/${contestId}/participants/${participantId}`);
      }
    } catch (err: any) {
      setError(err.message || (isEditMode ? 'Не удалось обновить участника' : 'Не удалось добавить участника'));
      setLoading(false);
      setUploadingMedia(false);
    }
  };

  const handleClose = () => {
    if (!loading && !uploadingMedia) {
      console.log('[AddParticipantModal] handleClose', {
        contestId,
        isEditMode,
        loading,
        uploadingMedia,
      });
      setPetName('');
      setPetDescription('');
      setExistingPhotos([]);
      setPhotosToDelete(new Set());
      setSelectedPhotos([]);
      setSelectedVideo(null);
      setExistingVideo(null);
      setDraggedIndex(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Редактировать участника' : 'Добавить участника'}
      footer={
        <div className="add-participant-modal-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            form="add-participant-form"
            disabled={loading || uploadingMedia || !petName.trim()}
          >
            {loading || uploadingMedia ? <LoadingSpinner size="small" /> : (isEditMode ? 'Сохранить' : 'Добавить')}
          </Button>
        </div>
      }
    >
      <form id="add-participant-form" onSubmit={handleSubmit}>
        <Input
          label="Имя животного"
          type="text"
          value={petName}
          onChange={(e) => setPetName(e.target.value)}
          placeholder="Введите имя вашего питомца"
          required
          disabled={loading}
        />
        <Textarea
          label="Описание"
          value={petDescription}
          onChange={(e) => setPetDescription(e.target.value)}
          placeholder="Расскажите о вашем питомце..."
          disabled={loading || uploadingMedia}
        />

        <div className="add-participant-media">
          <div className="add-participant-photos">
            <label className="add-participant-media-label">Фотографии</label>
            
            {/* Existing photos (edit mode) */}
            {isEditMode && existingPhotos.length > 0 && (
              <div className="add-participant-existing-photos">
                <label className="add-participant-existing-photos-label">Существующие фото:</label>
                <div className="add-participant-existing-photos-list">
                  {existingPhotos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="add-participant-existing-photo-item"
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      style={{
                        opacity: draggedIndex === index ? 0.5 : 1,
                        cursor: 'move',
                      }}
                    >
                      <img
                        src={photo.thumb_url || photo.url}
                        alt={`${index + 1}`}
                        className="add-participant-existing-photo-preview"
                      />
                      <button
                        type="button"
                        className="add-participant-existing-photo-remove"
                        onClick={() => removeExistingPhoto(photo.id)}
                        disabled={loading || uploadingMedia}
                        title="Удалить фото"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <p className="add-participant-media-hint">Перетащите фото для изменения порядка</p>
              </div>
            )}

            {/* Add new photos */}
            <FileUpload
              accept="image/*"
              onFileSelect={handlePhotoSelect}
              disabled={loading || uploadingMedia}
              label={isEditMode ? 'Добавить еще фото' : 'Добавить фото'}
              multiple={true}
            />
            
            {/* New photos to upload */}
            {selectedPhotos.length > 0 && (
              <div className="add-participant-photos-list">
                <label className="add-participant-new-photos-label">Новые фото для загрузки:</label>
                {selectedPhotos.map((photo, index) => (
                  <div key={index} className="add-participant-photo-item">
                    <span className="add-participant-photo-name">{photo.name}</span>
                    <button
                      type="button"
                      className="add-participant-photo-remove"
                      onClick={() => removePhoto(index)}
                      disabled={loading || uploadingMedia}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="add-participant-media-hint">Можно загрузить несколько фотографий (макс. 10MB каждая)</p>
          </div>

          <div className="add-participant-video">
            <label className="add-participant-media-label">Видео</label>
            
            {/* Existing video (edit mode) */}
            {isEditMode && existingVideo && !selectedVideo && (
              <div className="add-participant-existing-video">
                <label className="add-participant-existing-video-label">Текущее видео:</label>
                <div className="add-participant-existing-video-item">
                  <video
                    src={existingVideo}
                    controls
                    className="add-participant-existing-video-preview"
                  />
                  <button
                    type="button"
                    className="add-participant-existing-video-remove"
                    onClick={removeVideo}
                    disabled={loading || uploadingMedia}
                    title="Удалить видео"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Upload new video */}
            {!existingVideo && !selectedVideo ? (
              <FileUpload
                accept="video/*"
                onFileSelect={handleVideoSelect}
                disabled={loading || uploadingMedia}
                label={isEditMode ? 'Заменить видео' : 'Добавить видео'}
              />
            ) : selectedVideo ? (
              <div className="add-participant-video-item">
                <span className="add-participant-video-name">{selectedVideo.name}</span>
                <button
                  type="button"
                  className="add-participant-video-remove"
                  onClick={removeVideo}
                  disabled={loading || uploadingMedia}
                >
                  ×
                </button>
              </div>
            ) : null}
            <p className="add-participant-media-hint">Можно загрузить одно видео (макс. 100MB)</p>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  );
};
