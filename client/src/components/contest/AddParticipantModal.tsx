import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import {
  createParticipant,
  updateParticipant,
  uploadPhoto,
  deletePhoto,
  updatePhotoOrder,
  fetchParticipantsByContest,
  fetchMyParticipantsForContest,
} from '../../store/slices/participantsSlice';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { FileUpload } from '../common/FileUpload';
import { Textarea } from '../common/Textarea';
import { ContestID, Nomination, Participant, Photo, RegistrationField } from '../../types/models';
import type {
  ParticipantsListNominationFilter,
  ParticipantsListSort,
  ParticipantsListSubmissionFilter,
} from '../../api/participantsApi';
import { listRegistrationFields, uploadRegistrationFieldImage } from '../../api/registrationFieldsApi';
import { listLegalDocuments } from '../../api/legalApi';
import { buildLoginUrl } from '../../utils/navigation';
import { resolvePublicAssetUrl } from '../../utils/seo';
import './AddParticipantModal.css';

type LocalPhotoPick = { file: File; previewUrl: string };
type RegistrationImagePick = { file: File; previewUrl: string };

function revokeLocalPhotoPicks(picks: LocalPhotoPick[]) {
  for (const p of picks) {
    URL.revokeObjectURL(p.previewUrl);
  }
}

function revokeRegistrationImagePicks(picks: Record<string, RegistrationImagePick>) {
  for (const p of Object.values(picks)) {
    URL.revokeObjectURL(p.previewUrl);
  }
}

const REGISTRATION_TEXTAREA_MAX_RUNES = 10000;
/** Fallback, если не удалось загрузить /api/legal/documents (синхронно с Server/internal/legal/embed/manifest.json). */
const PRIVACY_POLICY_VERSION_FALLBACK = '2026-04-14';
const USER_AGREEMENT_VERSION_FALLBACK = '2026-04-19';

/** Текст пояснения для участника или undefined, если строка пустая. */
function registrationFieldHelpText(raw: string | undefined): string | undefined {
  const t = (raw ?? '').trim();
  return t.length > 0 ? t : undefined;
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.hostname.length > 0;
  } catch {
    return false;
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
      } else if (f.field_type === 'image') {
        if (!trimmed) {
          return {
            ok: false,
            message: `Загрузите изображение для «${f.label}»`,
          };
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
      case 'textarea': {
        const t = raw.trim();
        if (!f.required && t === '') {
          break;
        }
        if (f.required && t === '') {
          return { ok: false, message: `Заполните поле «${f.label}»` };
        }
        if (Array.from(t).length > REGISTRATION_TEXTAREA_MAX_RUNES) {
          return {
            ok: false,
            message: `Поле «${f.label}»: не более ${REGISTRATION_TEXTAREA_MAX_RUNES} символов`,
          };
        }
        answers[f.id] = t;
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
      case 'image': {
        if (!f.required && !trimmed) {
          break;
        }
        if (!isValidHttpUrl(trimmed)) {
          return {
            ok: false,
            message: `Поле «${f.label}»: укажите корректную ссылку (http или https)`,
          };
        }
        answers[f.id] = trimmed;
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
  /** Номинации конкурса — для выбора при подаче/редактировании заявки */
  nominations?: Nomination[];
  /** Заявки текущего пользователя в этом конкурсе (для исключения занятых номинаций) */
  myContestParticipants?: Participant[];
  /** Текущий фильтр списка на странице конкурса (после сохранения заявки) */
  participantsListNominationFilter?: ParticipantsListNominationFilter;
  participantsListSubmissionFilter?: ParticipantsListSubmissionFilter;
  participantsListVotedOnly?: boolean;
  /** Пагинация списка на странице конкурса */
  participantsListLimit?: number;
  participantsListOffset?: number;
  participantsListSort?: ParticipantsListSort;
  /** Лимиты фото с конкурса (если не переданы — 1 и 30). */
  contestMinPhotoCount?: number;
  contestMaxPhotoCount?: number;
  /** Подсказка организатора к полю «Наименование». */
  entryTitleHint?: string;
}

export const AddParticipantModal: React.FC<AddParticipantModalProps> = ({
  isOpen,
  onClose,
  contestId,
  participant,
  nominations: nominationsProp,
  myContestParticipants = [],
  participantsListNominationFilter = 'all',
  participantsListSubmissionFilter = 'all',
  participantsListVotedOnly = false,
  participantsListLimit = 10000,
  participantsListOffset = 0,
  participantsListSort,
  contestMinPhotoCount,
  contestMaxPhotoCount,
  entryTitleHint,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isEditMode = !!participant;

  const nominationRows = useMemo(() => nominationsProp ?? [], [nominationsProp]);
  const selectableNominations = useMemo(() => {
    if (nominationRows.length === 0) return [];
    const uid = currentUser?.id;
    if (uid === undefined) return nominationRows;
    if (!participant) {
      return nominationRows.filter(
        (n) => !myContestParticipants.some((p) => p.user_id === uid && p.nomination_id === n.id)
      );
    }
    return nominationRows.filter((n) => {
      if (participant.nomination_id === n.id) return true;
      return !myContestParticipants.some(
        (p) => p.user_id === uid && p.nomination_id === n.id && p.id !== participant.id
      );
    });
  }, [nominationRows, myContestParticipants, currentUser?.id, participant]);

  const [selectedNominationId, setSelectedNominationId] = useState('');

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
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [publicationConsent, setPublicationConsent] = useState(false);
  const [legalDocVersions, setLegalDocVersions] = useState<{ privacy?: string; terms?: string }>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [registrationFields, setRegistrationFields] = useState<RegistrationField[] | null>(null);
  const [registrationAnswersDraft, setRegistrationAnswersDraft] = useState<Record<string, string>>({});
  const [registrationImagePicks, setRegistrationImagePicks] = useState<
    Record<string, RegistrationImagePick>
  >({});
  const registrationImagePicksRef = useRef<Record<string, RegistrationImagePick>>({});
  registrationImagePicksRef.current = registrationImagePicks;

  const wasOpenRef = useRef(false);

  useEffect(() => {
    return () => {
      revokeRegistrationImagePicks(registrationImagePicksRef.current);
    };
  }, []);

  const { minPhotosRequired, maxPhotosAllowed } = useMemo(() => {
    const min = Math.min(30, Math.max(1, contestMinPhotoCount ?? 1));
    const maxRaw = Math.min(30, Math.max(1, contestMaxPhotoCount ?? 30));
    const max = Math.max(min, maxRaw);
    return { minPhotosRequired: min, maxPhotosAllowed: max };
  }, [contestMinPhotoCount, contestMaxPhotoCount]);

  const currentPhotoTotal = existingPhotos.length + selectedPhotos.length;

  const entryNameHint = registrationFieldHelpText(entryTitleHint);

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
      setExistingPhotos(participant.photos ? [...participant.photos] : []);
      setPhotosToDelete(new Set());
      setSelectedPhotos((prev) => {
        revokeLocalPhotoPicks(prev);
        return [];
      });
      setError(null);
    } else if (isOpen && !participant) {
      // Reset for create mode
      setExistingPhotos([]);
      setPhotosToDelete(new Set());
      setSelectedPhotos((prev) => {
        revokeLocalPhotoPicks(prev);
        return [];
      });
      setError(null);
    }
  }, [isOpen, participant, isEditMode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (participant) {
      const t = (participant.entry_title ?? '').trim();
      setEntryTitle(t || participant.pet_name || '');
      setEntryDescription((participant.entry_description ?? '').trim());
      setAuthorName((participant.author_name ?? '').trim());
    } else {
      setEntryTitle('');
      setEntryDescription('');
      setAuthorName('');
    }
    setPrivacyConsent(!!participant);
    setPublicationConsent(!!participant);
  }, [isOpen, participant]);

  useEffect(() => {
    if (!isOpen || isEditMode) {
      return;
    }
    let cancelled = false;
    listLegalDocuments()
      .then((list) => {
        if (cancelled) return;
        const privacy = list.find((d) => d.id === 'privacy');
        const terms = list.find((d) => d.id === 'terms');
        setLegalDocVersions({
          privacy: privacy?.version,
          terms: terms?.version,
        });
      })
      .catch(() => {
        if (!cancelled) setLegalDocVersions({});
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isEditMode]);

  useEffect(() => {
    if (!isOpen) return;
    if (nominationRows.length === 0) {
      setSelectedNominationId('');
      return;
    }
    if (participant) {
      setSelectedNominationId(participant.nomination_id ?? '');
      return;
    }
    const first = selectableNominations[0];
    setSelectedNominationId(first ? first.id : '');
  }, [isOpen, participant, participant?.nomination_id, participant?.id, nominationRows.length, selectableNominations]);

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
    setRegistrationImagePicks((prev) => {
      revokeRegistrationImagePicks(prev);
      return {};
    });
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

    if (existingPhotos.length + selectedPhotos.length >= maxPhotosAllowed) {
      setError(`Можно не более ${maxPhotosAllowed} фото в заявке для этой номинации.`);
      return;
    }

    setSelectedPhotos((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
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

  const handleRegistrationImageFile = (fieldId: string, file: File | null) => {
    if (!file) {
      setRegistrationImagePicks((prev) => {
        const cur = prev[fieldId];
        if (cur) {
          URL.revokeObjectURL(cur.previewUrl);
        }
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Размер файла не должен превышать 10MB');
      return;
    }
    setRegistrationImagePicks((prev) => {
      const cur = prev[fieldId];
      if (cur) {
        URL.revokeObjectURL(cur.previewUrl);
      }
      return {
        ...prev,
        [fieldId]: { file, previewUrl: URL.createObjectURL(file) },
      };
    });
    setError(null);
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

    const trimmedTitle = entryTitle.trim();
    if (!trimmedTitle) {
      setError('Укажите наименование заявки');
      return;
    }
    const trimmedAuthor = authorName.trim();
    if (!trimmedAuthor) {
      setError('Укажите автора');
      return;
    }
    const trimmedDescription = entryDescription.trim();
    if (!trimmedDescription) {
      setError('Укажите описание');
      return;
    }
    if (Array.from(trimmedDescription).length > REGISTRATION_TEXTAREA_MAX_RUNES) {
      setError(`Описание: не более ${REGISTRATION_TEXTAREA_MAX_RUNES} символов`);
      return;
    }
    if (!isEditMode && !privacyConsent) {
      setError('Для отправки заявки необходимо согласие на обработку персональных данных');
      return;
    }
    if (!isEditMode && !publicationConsent) {
      setError('Для отправки заявки необходимо согласие на публикацию материалов');
      return;
    }

    const fields = registrationFields ?? [];
    if (currentPhotoTotal < minPhotosRequired) {
      setError(
        `Добавьте не менее ${minPhotosRequired} фото (сейчас выбрано ${currentPhotoTotal}).`
      );
      return;
    }
    if (currentPhotoTotal > maxPhotosAllowed) {
      setError(
        `В заявке не более ${maxPhotosAllowed} фото (сейчас выбрано ${currentPhotoTotal}).`
      );
      return;
    }
    try {
      setLoading(true);
      setError(null);

      if (nominationRows.length > 0) {
        if (!selectedNominationId.trim()) {
          setError('Выберите номинацию');
          setLoading(false);
          return;
        }
        if (!selectableNominations.some((n) => n.id === selectedNominationId)) {
          setError('Выбрана недоступная номинация');
          setLoading(false);
          return;
        }
      }

      let workingDraft = { ...registrationAnswersDraft };
      for (const f of fields) {
        if (f.field_type !== 'image') {
          continue;
        }
        const pick = registrationImagePicks[f.id];
        if (pick) {
          const url = await uploadRegistrationFieldImage(contestId, pick.file, f.id);
          workingDraft[f.id] = url;
        }
      }

      const built = buildRegistrationAnswers(fields, workingDraft);
      if (!built.ok) {
        setError(built.message);
        setLoading(false);
        return;
      }

      let participantId: string;

      if (isEditMode && participant) {
        // Update existing participant
        const result = await dispatch(
          updateParticipant({
            participantId: participant.id,
            data: {
              entry_title: trimmedTitle,
              entry_description: trimmedDescription,
              author_name: trimmedAuthor,
              registration_answers: built.answers,
              ...(nominationRows.length > 0 ? { nomination_id: selectedNominationId } : {}),
            },
          })
        );

        if (!updateParticipant.fulfilled.match(result)) {
          const errorMessage = result.payload as string || 'Не удалось сохранить заявку';
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

      } else {
        // Create new participant
        const result = await dispatch(
          createParticipant({
            contestId,
            data: {
              entry_title: trimmedTitle,
              entry_description: trimmedDescription,
              author_name: trimmedAuthor,
              ...(nominationRows.length > 0 ? { nomination_id: selectedNominationId } : {}),
              ...(Object.keys(built.answers).length > 0 ? { registration_answers: built.answers } : {}),
              privacy_consent: true,
              policy_version: legalDocVersions.privacy ?? PRIVACY_POLICY_VERSION_FALLBACK,
              publication_consent: true,
              publication_terms_version: legalDocVersions.terms ?? USER_AGREEMENT_VERSION_FALLBACK,
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
          limit: participantsListLimit,
          offset: participantsListOffset,
          sort: participantsListSort,
        })
      );
      void dispatch(fetchMyParticipantsForContest({ contestId }));

      revokeLocalPhotoPicks(selectedPhotosRef.current);
      setSelectedPhotos([]);
      revokeRegistrationImagePicks(registrationImagePicksRef.current);
      setRegistrationImagePicks({});

      // Close modal
      onClose();
      
      // Navigate to participant page if creating new, or stay on contest page if editing
      if (!isEditMode) {
        navigate(`/contests/${contestId}/participants/${participantId}`);
      }
    } catch (err: any) {
      setError(err.message || (isEditMode ? 'Не удалось сохранить заявку' : 'Не удалось добавить участника'));
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
      setExistingPhotos([]);
      setPhotosToDelete(new Set());
      setSelectedPhotos((prev) => {
        revokeLocalPhotoPicks(prev);
        return [];
      });
      setDraggedIndex(null);
      setRegistrationFields(null);
      setRegistrationAnswersDraft({});
      setRegistrationImagePicks((prev) => {
        revokeRegistrationImagePicks(prev);
        return {};
      });
      setEntryTitle('');
      setEntryDescription('');
      setPrivacyConsent(false);
      setError(null);
      setSelectedNominationId('');
      onClose();
    }
  };

  return (
    <Modal
      className="add-participant-modal-overlay"
      isOpen={isOpen}
      onClose={handleClose}
      showHeaderDivider={false}
      showFooterDivider={false}
      title={isEditMode ? 'Редактировать заявку участника' : 'Участвовать'}
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
            disabled={loading || uploadingMedia || registrationFields === null}
          >
            {loading || uploadingMedia ? <LoadingSpinner size="small" /> : (isEditMode ? 'Сохранить' : 'Участвовать')}
          </Button>
        </div>
      }
    >
      <form id="add-participant-form" onSubmit={handleSubmit}>
        {nominationRows.length > 0 ? (
          <div className="add-participant-nomination-field">
            <label className="add-participant-nomination-label" htmlFor="add-participant-nomination">
              Номинация *
            </label>
            <select
              id="add-participant-nomination"
              className="add-participant-nomination-select"
              value={selectedNominationId}
              onChange={(e) => setSelectedNominationId(e.target.value)}
              disabled={
                loading || uploadingMedia || registrationFields === null || selectableNominations.length === 0
              }
            >
              {selectableNominations.length === 0 ? (
                <option value="">—</option>
              ) : (
                selectableNominations.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))
              )}
            </select>
            {selectableNominations.length === 0 ? (
              <p className="add-participant-nomination-empty" role="status">
                Нет номинаций, в которых вы ещё не участвуете.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="add-participant-form-stack">
          <Input
            label="Наименование *"
            hint={entryNameHint}
            type="text"
            value={entryTitle}
            onChange={(e) => setEntryTitle(e.target.value)}
            disabled={loading || uploadingMedia || registrationFields === null}
            autoComplete="off"
          />
          <Input
            label="Автор *"
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            disabled={loading || uploadingMedia || registrationFields === null}
            autoComplete="name"
          />
          <Textarea
            label="Описание *"
            value={entryDescription}
            onChange={(e) => setEntryDescription(e.target.value)}
            disabled={loading || uploadingMedia || registrationFields === null}
            rows={4}
            autoComplete="off"
            className="add-participant-entry-description"
          />
          <div className="add-participant-photos">
            <label className="add-participant-media-label">Фотографии</label>
            <p
              className={
                currentPhotoTotal < minPhotosRequired || currentPhotoTotal > maxPhotosAllowed
                  ? 'add-participant-photos-count add-participant-photos-count--short'
                  : 'add-participant-photos-count'
              }
            >
              Минимум: <strong>{minPhotosRequired}</strong>, максимум:{' '}
              <strong>{maxPhotosAllowed}</strong>, сейчас: <strong>{currentPhotoTotal}</strong>
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
              disabled={loading || uploadingMedia || currentPhotoTotal >= maxPhotosAllowed}
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

        {registrationFields === null ? (
          <p className="add-participant-registration-loading">Загрузка полей заявки…</p>
        ) : registrationFields.length > 0 ? (
          <div className="add-participant-registration-fields">
            <p className="add-participant-registration-heading">Дополнительно в заявке</p>
            {registrationFields.map((field) => {
              const regHelp = registrationFieldHelpText(field.help_text);
              const regHelpId = regHelp ? `reg-field-help-${field.id}` : undefined;
              return (
              <div key={field.id} className="add-participant-registration-row">
                {field.field_type === 'string' && (
                  <Input
                    label={field.label + (field.required ? ' *' : '')}
                    hint={regHelp}
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
                    hint={regHelp}
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
                  <div className="add-participant-registration-boolean-block">
                    {regHelp ? (
                      <p id={regHelpId} className="add-participant-registration-hint">
                        {regHelp}
                      </p>
                    ) : null}
                    <label className="add-participant-registration-boolean">
                      <input
                        type="checkbox"
                        aria-describedby={regHelpId}
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
                  </div>
                )}
                {field.field_type === 'enum' && (
                  <div className="add-participant-registration-enum">
                    <label className="add-participant-registration-enum-label" htmlFor={`reg-enum-${field.id}`}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {regHelp ? (
                      <p id={regHelpId} className="add-participant-registration-hint">
                        {regHelp}
                      </p>
                    ) : null}
                    <select
                      id={`reg-enum-${field.id}`}
                      className="add-participant-registration-select"
                      aria-describedby={regHelpId}
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
                {field.field_type === 'textarea' && (
                  <Textarea
                    label={field.label + (field.required ? ' *' : '')}
                    hint={regHelp}
                    value={registrationAnswersDraft[field.id] ?? ''}
                    onChange={(e) =>
                      setRegistrationAnswersDraft((prev) => ({
                        ...prev,
                        [field.id]: e.target.value,
                      }))
                    }
                    disabled={loading || uploadingMedia}
                    rows={4}
                  />
                )}
                {field.field_type === 'image' && (
                  <div className="add-participant-registration-image">
                    <span className="add-participant-registration-image-label">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                    {regHelp ? (
                      <p id={regHelpId} className="add-participant-registration-hint">
                        {regHelp}
                      </p>
                    ) : null}
                    <div className="add-participant-registration-image-upload">
                      <FileUpload
                        accept="image/*"
                        disabled={loading || uploadingMedia}
                        label="Выбрать изображение"
                        describedBy={regHelpId}
                        onFileSelect={(file) => handleRegistrationImageFile(field.id, file)}
                      />
                    </div>
                    {registrationImagePicks[field.id] ? (
                      <div className="add-participant-registration-image-preview-wrap">
                        <img
                          src={registrationImagePicks[field.id].previewUrl}
                          alt=""
                          className="add-participant-registration-image-preview"
                        />
                        <Button
                          type="button"
                          variant="danger"
                          size="small"
                          disabled={loading || uploadingMedia}
                          onClick={() => handleRegistrationImageFile(field.id, null)}
                        >
                          Убрать файл
                        </Button>
                      </div>
                    ) : (registrationAnswersDraft[field.id] ?? '').trim() ? (
                      <div className="add-participant-registration-image-preview-wrap">
                        <img
                          src={resolvePublicAssetUrl((registrationAnswersDraft[field.id] ?? '').trim())}
                          alt=""
                          className="add-participant-registration-image-preview"
                        />
                      </div>
                    ) : null}
                    <p className="add-participant-registration-image-hint">
                      До 10&nbsp;МБ, форматы изображений (не SVG). Файл будет загружен при отправке заявки.
                    </p>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        ) : null}
        </div>

        {!isEditMode ? (
          <div className="add-participant-consent-stack">
            {!currentUser?.date_of_birth ? (
              <p className="add-participant-dob-hint" role="note">
                Для участия укажите{' '}
                <Link to="/profile">дату рождения в профиле</Link> — необходимо для подтверждения возраста 18+.
              </p>
            ) : null}
            <label className="add-participant-privacy-consent">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                disabled={loading || uploadingMedia}
              />
              <span>
                Я согласен(а) на обработку персональных данных и ознакомлен(а) с{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  Политикой обработки персональных данных
                </a>
                .
              </span>
            </label>
            <label className="add-participant-privacy-consent">
              <input
                type="checkbox"
                checked={publicationConsent}
                onChange={(e) => setPublicationConsent(e.target.checked)}
                disabled={loading || uploadingMedia}
              />
              <span>
                Я согласен(а) на публикацию моих материалов в рамках конкурса и ознакомлен(а) с{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  Пользовательским соглашением
                </a>
                .
              </span>
            </label>
          </div>
        ) : null}

        {error && <ErrorMessage message={error} />}
      </form>
    </Modal>
  );
};
