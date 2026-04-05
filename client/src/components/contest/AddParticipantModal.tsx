import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import {
  createParticipant,
  updateParticipant,
  uploadPhoto,
  uploadVideo,
  deletePhoto,
  deleteVideo,
  updatePhotoOrder,
  fetchParticipantsByContest,
  fetchMyParticipantsForContest,
} from '../../store/slices/participantsSlice';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { FileUpload } from '../common/FileUpload';
import { ContestID, Nomination, Participant, Photo, RegistrationField } from '../../types/models';
import type {
  ParticipantsListNominationFilter,
  ParticipantsListSubmissionFilter,
} from '../../api/participantsApi';
import { listRegistrationFields } from '../../api/registrationFieldsApi';
import { listNominations } from '../../api/nominationsApi';
import { buildLoginUrl } from '../../utils/navigation';
import './AddParticipantModal.css';

type LocalPhotoPick = { file: File; previewUrl: string };

function revokeLocalPhotoPicks(picks: LocalPhotoPick[]) {
  for (const p of picks) {
    URL.revokeObjectURL(p.previewUrl);
  }
}

function initRegistrationDraft(
  participant: Participant | null | undefined,
  fields: RegistrationField[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = participant?.registration_answers?.[f.id];
    if (v === undefined || v === null) {
      out[f.id] = f.field_type === 'boolean' ? 'false' : '';
    } else if (typeof v === 'boolean') {
      out[f.id] = v ? 'true' : 'false';
    } else {
      out[f.id] = String(v);
    }
  }
  return out;
}

function buildRegistrationAnswers(
  fields: RegistrationField[],
  draft: Record<string, string>
): { ok: true; answers: Record<string, string | number | boolean> } | { ok: false; message: string } {
  const answers: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    const raw = draft[f.id] ?? '';
    const trimmed = raw.trim();

    if (f.required) {
      if (f.field_type === 'boolean') {
        // всегда есть значение
      } else if (f.field_type === 'number') {
        if (trimmed === '') {
          return { ok: false, message: `Заполните поле «${f.label}»` };
        }
      } else if (f.field_type === 'enum') {
        if (!raw) {
          return { ok: false, message: `Выберите значение для «${f.label}»` };
        }
      } else if (!trimmed) {
        return { ok: false, message: `Заполните поле «${f.label}»` };
      }
    }

    switch (f.field_type) {
      case 'string': {
        if (!f.required && !trimmed) {
          break;
        }
        answers[f.id] = trimmed;
        break;
      }
      case 'number': {
        if (!f.required && trimmed === '') {
          break;
        }
        const n = Number(raw.replace(',', '.'));
        if (Number.isNaN(n)) {
          return { ok: false, message: `Поле «${f.label}»: введите число` };
        }
        answers[f.id] = n;
        break;
      }
      case 'boolean': {
        answers[f.id] = raw === 'true';
        break;
      }
      case 'enum': {
        if (!f.required && !raw) {
          break;
        }
        answers[f.id] = raw;
        break;
      }
      default:
        break;
    }
  }
  return { ok: true, answers };
}

interface AddParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId: ContestID;
  participant?: Participant | null;
  /** Только при создании: id номинации с кнопки «Участвовать» */
  nominationId?: string | null;
  nominationTitle?: string | null;
  /** Текущий фильтр списка на странице конкурса (после сохранения заявки) */
  participantsListNominationFilter?: ParticipantsListNominationFilter;
  participantsListSubmissionFilter?: ParticipantsListSubmissionFilter;
  participantsListVotedOnly?: boolean;
  participantsListJuryUnscoredOnly?: boolean;
  /** Пагинация списка на странице конкурса */
  participantsListLimit?: number;
  participantsListOffset?: number;
}

export const AddParticipantModal: React.FC<AddParticipantModalProps> = ({
  isOpen,
  onClose,
  contestId,
  participant,
  nominationId: nominationIdProp = null,
  nominationTitle = null,
  participantsListNominationFilter = 'all',
  participantsListSubmissionFilter = 'all',
  participantsListVotedOnly = false,
  participantsListJuryUnscoredOnly = false,
  participantsListLimit = 10000,
  participantsListOffset = 0,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const isEditMode = !!participant;
  
  const [petName, setPetName] = useState('');
  const [petDescription, setPetDescription] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<Set<string>>(new Set());
  const [selectedPhotos, setSelectedPhotos] = useState<LocalPhotoPick[]>([]);
  const selectedPhotosRef = useRef<LocalPhotoPick[]>([]);
  selectedPhotosRef.current = selectedPhotos;

  useEffect(() => {
    return () => {
      revokeLocalPhotoPicks(selectedPhotosRef.current);
    };
  }, []);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [existingVideo, setExistingVideo] = useState<string | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [registrationFields, setRegistrationFields] = useState<RegistrationField[] | null>(null);
  const [registrationAnswersDraft, setRegistrationAnswersDraft] = useState<Record<string, string>>({});
  const [nominationsForPhotos, setNominationsForPhotos] = useState<Nomination[] | null>(null);

  const wasOpenRef = useRef(false);

  const minPhotosRequired = useMemo(() => {
    const nid = participant?.nomination_id ?? nominationIdProp ?? null;
    if (!nid || !nominationsForPhotos?.length) {
      return 1;
    }
    const row = nominationsForPhotos.find((x) => x.id === nid);
    const n = row?.min_photo_count ?? 1;
    return Math.min(30, Math.max(1, n));
  }, [participant?.nomination_id, nominationIdProp, nominationsForPhotos]);

  const currentPhotoTotal = existingPhotos.length + selectedPhotos.length;

  useEffect(() => {
    if (!isOpen) {
      setNominationsForPhotos(null);
      return;
    }
    let cancelled = false;
    listNominations(contestId)
      .then((rows) => {
        if (!cancelled) {
          setNominationsForPhotos(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNominationsForPhotos([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, contestId]);

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
      setSelectedPhotos((prev) => {
        revokeLocalPhotoPicks(prev);
        return [];
      });
      setSelectedVideo(null);
      const videoUrl = participant.video?.url || null;
      setExistingVideo(videoUrl);
      setVideoToDelete(false);
      setError(null);
    } else if (isOpen && !participant) {
      // Reset for create mode
      setPetName('');
      setPetDescription('');
      setExistingPhotos([]);
      setPhotosToDelete(new Set());
      setSelectedPhotos((prev) => {
        revokeLocalPhotoPicks(prev);
        return [];
      });
      setSelectedVideo(null);
      setExistingVideo(null);
      setVideoToDelete(false);
      setError(null);
    }
  }, [isOpen, participant, isEditMode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    setRegistrationFields(null);
    (async () => {
      try {
        const rows = await listRegistrationFields(contestId);
        if (cancelled) {
          return;
        }
        setRegistrationFields(rows);
      } catch {
        if (!cancelled) {
          setRegistrationFields([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, contestId]);

  useEffect(() => {
    if (!isOpen || registrationFields === null) {
      return;
    }
    setRegistrationAnswersDraft(initRegistrationDraft(participant, registrationFields));
  }, [isOpen, participant, registrationFields]);

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

    setSelectedPhotos((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
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
    // Clear existing video when new video is selected (it will be replaced)
    if (isEditMode && existingVideo) {
      setExistingVideo(null);
    }
    setError(null);
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
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
    if (isEditMode && existingVideo) {
      setVideoToDelete(true);
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

    const fields = registrationFields ?? [];
    const built = buildRegistrationAnswers(fields, registrationAnswersDraft);
    if (!built.ok) {
      setError(built.message);
      return;
    }
    if (currentPhotoTotal < minPhotosRequired) {
      setError(
        `Добавьте не менее ${minPhotosRequired} фото (сейчас выбрано ${currentPhotoTotal}).`
      );
      return;
    }
    const registrationPayload =
      Object.keys(built.answers).length > 0 ? built.answers : undefined;

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
              ...(registrationPayload !== undefined ? { registration_answers: registrationPayload } : {}),
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

        // Delete video if marked for deletion
        if (videoToDelete) {
          setUploadingMedia(true);
          try {
            const deleteResult = await dispatch(deleteVideo({ participantId }));
            if (deleteVideo.rejected.match(deleteResult)) {
              console.error('Failed to delete video:', deleteResult.payload);
            }
          } catch (err) {
            console.error('Error deleting video:', err);
          }
        }

        const newPhotoIds: string[] = [];

        // Upload new photos
        if (selectedPhotos.length > 0) {
          setUploadingMedia(true);
          try {
            for (const pick of selectedPhotos) {
              const photoResult = await dispatch(uploadPhoto({ participantId, file: pick.file }));
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
            } else if (uploadVideo.fulfilled.match(videoResult)) {
              const newVideo = videoResult.payload as any;
              // Update existingVideo to new video URL and clear selectedVideo
              if (isEditMode && newVideo?.video?.url) {
                setExistingVideo(newVideo.video.url);
                setSelectedVideo(null);
              }
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
              ...(nominationIdProp ? { nomination_id: nominationIdProp } : {}),
              ...(registrationPayload !== undefined ? { registration_answers: registrationPayload } : {}),
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
            for (const pick of selectedPhotos) {
              const photoResult = await dispatch(uploadPhoto({ participantId, file: pick.file }));
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

      // Refresh participants list to get updated data
      await dispatch(
        fetchParticipantsByContest({
          contestId,
          nominationFilter: participantsListNominationFilter,
          submissionFilter: participantsListSubmissionFilter,
          votedOnly: participantsListVotedOnly,
          juryUnscoredOnly: participantsListJuryUnscoredOnly,
          limit: participantsListLimit,
          offset: participantsListOffset,
        })
      );
      void dispatch(fetchMyParticipantsForContest({ contestId }));

      revokeLocalPhotoPicks(selectedPhotosRef.current);
      setSelectedPhotos([]);

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
      setSelectedPhotos((prev) => {
        revokeLocalPhotoPicks(prev);
        return [];
      });
      setSelectedVideo(null);
      setExistingVideo(null);
      setVideoToDelete(false);
      setDraggedIndex(null);
      setRegistrationFields(null);
      setRegistrationAnswersDraft({});
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isEditMode
          ? 'Редактировать участника'
          : nominationTitle
            ? `Участвовать: ${nominationTitle}`
            : 'Добавить участника'
      }
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
            disabled={loading || uploadingMedia || !petName.trim() || registrationFields === null}
          >
            {loading || uploadingMedia ? <LoadingSpinner size="small" /> : (isEditMode ? 'Сохранить' : 'Добавить')}
          </Button>
        </div>
      }
    >
      <form id="add-participant-form" onSubmit={handleSubmit}>
        {!isEditMode && nominationTitle ? (
          <p className="add-participant-nomination-hint">
            Номинация: <strong>{nominationTitle}</strong>
          </p>
        ) : null}
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

        {registrationFields === null ? (
          <p className="add-participant-registration-loading">Загрузка полей заявки…</p>
        ) : registrationFields.length > 0 ? (
          <div className="add-participant-registration-fields">
            <p className="add-participant-registration-heading">Дополнительно в заявке</p>
            {registrationFields.map((field) => (
              <div key={field.id} className="add-participant-registration-row">
                {field.field_type === 'string' && (
                  <Input
                    label={field.label + (field.required ? ' *' : '')}
                    type="text"
                    value={registrationAnswersDraft[field.id] ?? ''}
                    onChange={(e) =>
                      setRegistrationAnswersDraft((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }))
                    }
                    disabled={loading || uploadingMedia}
                  />
                )}
                {field.field_type === 'number' && (
                  <Input
                    label={field.label + (field.required ? ' *' : '')}
                    type="text"
                    inputMode="decimal"
                    value={registrationAnswersDraft[field.id] ?? ''}
                    onChange={(e) =>
                      setRegistrationAnswersDraft((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }))
                    }
                    disabled={loading || uploadingMedia}
                  />
                )}
                {field.field_type === 'boolean' && (
                  <label className="add-participant-registration-boolean">
                    <input
                      type="checkbox"
                      checked={(registrationAnswersDraft[field.id] ?? 'false') === 'true'}
                      onChange={(e) =>
                        setRegistrationAnswersDraft((prev) => ({
                          ...prev,
                          [field.id]: e.target.checked ? 'true' : 'false',
                        }))
                      }
                      disabled={loading || uploadingMedia}
                    />
                    <span>{field.label}</span>
                    {field.required ? <span className="add-participant-registration-req"> *</span> : null}
                  </label>
                )}
                {field.field_type === 'enum' && (
                  <div className="add-participant-registration-enum">
                    <label className="add-participant-registration-enum-label" htmlFor={`reg-enum-${field.id}`}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    <select
                      id={`reg-enum-${field.id}`}
                      className="add-participant-registration-select"
                      value={registrationAnswersDraft[field.id] ?? ''}
                      onChange={(e) =>
                        setRegistrationAnswersDraft((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      disabled={loading || uploadingMedia}
                    >
                      {!field.required && <option value="">— не выбрано —</option>}
                      {(field.enum_options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div className="add-participant-media">
          <div className="add-participant-photos">
            <label className="add-participant-media-label">Фотографии</label>
            <p
              className={
                currentPhotoTotal < minPhotosRequired
                  ? 'add-participant-photos-count add-participant-photos-count--short'
                  : 'add-participant-photos-count'
              }
            >
              Минимум фото: <strong>{minPhotosRequired}</strong>, сейчас:{' '}
              <strong>{currentPhotoTotal}</strong>
            </p>

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
                {selectedPhotos.map((pick, index) => (
                  <div key={`${pick.previewUrl}-${index}`} className="add-participant-photo-item">
                    <img
                      src={pick.previewUrl}
                      alt=""
                      className="add-participant-photo-thumb"
                    />
                    <span className="add-participant-photo-name">{pick.file.name}</span>
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
