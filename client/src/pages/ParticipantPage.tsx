import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchParticipant, fetchParticipantsByContest } from '../store/slices/participantsSlice';
import { fetchComments, createComment, updateComment, deleteComment } from '../store/slices/commentsSlice';
import { fetchContest } from '../store/slices/contestsSlice';
import { Comment as ParticipantComment } from '../types/models';
import { VoteButton } from '../components/contest/VoteButton';
import { EditParticipantModal } from '../components/contest/EditParticipantModal';
import { DeleteParticipantModal } from '../components/contest/DeleteParticipantModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { PhotoGallery } from '../components/participant/PhotoGallery';
import { useWebSocket } from '../hooks/useWebSocket';
import './ParticipantPage.css';

const ParticipantPage: React.FC = () => {
  const { id: contestId, participantId } = useParams<{ id: string; participantId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const participant = useSelector((state: RootState) =>
    participantId ? state.participants.items[participantId] : undefined
  );
  const comments = useSelector((state: RootState) =>
    participantId ? state.comments.items[participantId] || [] : []
  ) as ParticipantComment[];
  const { loading } = useSelector((state: RootState) => state.participants);
  const { currentContest, loading: contestLoading } = useSelector((state: RootState) => state.contests);
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isOwner = participant && currentUserId && participant.user_id === currentUserId;
  const canEdit = !!(isOwner && currentContest && (currentContest.status === 'draft' || currentContest.status === 'registration'));
  const canComment = !!(currentContest && (currentContest.status === 'registration' || currentContest.status === 'voting'));
  const isContestOwner = currentContest && currentUserId && currentContest.created_by_user_id === currentUserId;
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null);

  useWebSocket(contestId ?? null, participantId ?? null);

  useEffect(() => {
    if (contestId && participantId) {
      dispatch(fetchContest(contestId));
      dispatch(fetchParticipant({ contestId, participantId }));
      dispatch(fetchComments({ participantId, limit: 50, offset: 0 }));
    }
  }, [dispatch, contestId, participantId]);


  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId || !newCommentText.trim() || !canComment) {
      return;
    }
    const result = await dispatch(
      createComment({
        participantId,
        data: { text: newCommentText.trim() },
      })
    );
    if (createComment.fulfilled.match(result)) {
      setNewCommentText('');
    }
  };

  const handleStartEdit = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setEditingText(text);
    setOpenMenuCommentId(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingText.trim() || !canComment) {
      return;
    }
    const result = await dispatch(updateComment({ commentId, data: { text: editingText.trim() } }));
    if (updateComment.fulfilled.match(result)) {
      setEditingCommentId(null);
      setEditingText('');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!canComment) {
      return;
    }
    await dispatch(deleteComment(commentId));
    setOpenMenuCommentId(null);
  };

  const toggleCommentMenu = (commentId: string) => {
    setOpenMenuCommentId((prev) => (prev === commentId ? null : commentId));
  };

  // Debug logging
  useEffect(() => {
    console.log('[ParticipantPage] Debug:', {
      isOwner,
      currentUserId,
      participantUserId: participant?.user_id,
      currentContest,
      contestStatus: currentContest?.status,
      canEdit,
      contestLoading,
    });
  }, [isOwner, currentUserId, participant, currentContest, canEdit, contestLoading]);

  if (loading || !participant) {
    return (
      <div className="participant-page-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="participant-page">
      <div className="participant-page-header">
        <button
          type="button"
          className="participant-page-back-button"
          onClick={() => navigate(`/contests/${contestId}`)}
          aria-label="Назад"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>{participant.pet_name}</h1>
        {isOwner && currentContest && canEdit && (
          <div className="participant-page-actions">
            <Button
              variant="secondary"
              onClick={() => setIsEditModalOpen(true)}
            >
              Редактировать
            </Button>
            <Button
              variant="danger"
              onClick={() => setIsDeleteModalOpen(true)}
            >
              Удалить
            </Button>
          </div>
        )}
      </div>

      <div className="participant-page-content">
        <div className="participant-page-media">
          {participant.photos && participant.photos.length > 0 && (
            <PhotoGallery photos={participant.photos} participantId={participant.id} />
          )}
          {participant.video && (
            <div className="participant-page-video">
              <video controls src={participant.video.url} />
            </div>
          )}
          {!participant.photos?.length && !participant.video && !isOwner && (
            <div className="participant-page-media-empty">Нет медиа</div>
          )}
        </div>

        <div className="participant-page-info">
          {currentContest && (
            <div className="participant-page-vote-button-wrapper">
              <VoteButton
                contestId={currentContest.id}
                participantId={participant.id}
                contestStatus={currentContest.status}
                isOwner={!!isOwner}
              />
            </div>
          )}

          <div className="participant-page-description">
            <h2>Описание</h2>
            <p>{participant.pet_description || 'Нет описания'}</p>
          </div>

          <div className="participant-page-votes">
            <p className="participant-page-votes-text">Голосов: {participant.total_votes || 0}</p>
          </div>

          <div className="participant-page-comments">
            <h2>Комментарии</h2>
            {currentUserId ? (
              canComment ? (
              <form className="participant-page-comment-form" onSubmit={handleCreateComment}>
                <textarea
                  className="participant-page-comment-input"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Напишите комментарий..."
                  maxLength={2000}
                />
                <div className="participant-page-comment-actions">
                  <Button type="submit" size="small" disabled={!newCommentText.trim()}>
                    Отправить
                  </Button>
                </div>
              </form>
              ) : (
                <div className="participant-page-comment-auth">
                  Комментарии доступны на этапах регистрации и голосования
                </div>
              )
            ) : (
              <div className="participant-page-comment-auth">Войдите, чтобы оставить комментарий</div>
            )}
            {comments.length === 0 ? (
              <p>Нет комментариев</p>
            ) : (
              <div className="participant-page-comments-list">
                {comments.map((comment) => (
                  <div key={comment.id} className="participant-page-comment">
                    <div className="comment-header">
                      <span>{comment.user_name || `Пользователь ${comment.user_id}`}</span>
                      <span>{new Date(comment.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="participant-page-comment-edit">
                        <textarea
                          className="participant-page-comment-input"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          maxLength={2000}
                        />
                        <div className="participant-page-comment-actions">
                          <Button
                            type="button"
                            size="small"
                            variant="secondary"
                            onClick={handleCancelEdit}
                          >
                            Отмена
                          </Button>
                          <Button type="button" size="small" onClick={() => handleUpdateComment(comment.id)}>
                            Сохранить
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p>{comment.text}</p>
                    )}
                    {editingCommentId !== comment.id && canComment && (currentUserId === comment.user_id || isContestOwner) && (
                      <div className="participant-page-comment-menu">
                        <button
                          type="button"
                          className="comment-menu-trigger"
                          onClick={() => toggleCommentMenu(comment.id)}
                          aria-label="Открыть меню"
                        >
                          ⋯
                        </button>
                        {openMenuCommentId === comment.id && (
                          <div className="comment-menu">
                            {currentUserId === comment.user_id && (
                              <button
                                type="button"
                                className="comment-menu-item"
                                onClick={() => handleStartEdit(comment.id, comment.text)}
                              >
                                Редактировать
                              </button>
                            )}
                            {(currentUserId === comment.user_id || isContestOwner) && (
                              <button
                                type="button"
                                className="comment-menu-item danger"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {participant && (
        <>
          <EditParticipantModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            participant={participant}
          />
          <DeleteParticipantModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            participant={participant}
            onDeleted={() => {
              // Refresh participants list and navigate back to contest
              if (contestId) {
                dispatch(fetchParticipantsByContest(contestId));
                navigate(`/contests/${contestId}`);
              }
            }}
          />
        </>
      )}
    </div>
  );
};

export default ParticipantPage;
