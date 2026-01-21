import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchParticipant } from '../store/slices/participantsSlice';
import { fetchComments } from '../store/slices/commentsSlice';
import { VoteButton } from '../components/contest/VoteButton';
import { PhotoUpload } from '../components/participant/PhotoUpload';
import { VideoUpload } from '../components/participant/VideoUpload';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
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
  );
  const { loading } = useSelector((state: RootState) => state.participants);
  const { currentContest } = useSelector((state: RootState) => state.contests);
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isOwner = participant && currentUserId && participant.user_id === currentUserId;

  useEffect(() => {
    if (contestId && participantId) {
      dispatch(fetchParticipant({ contestId, participantId }));
      dispatch(fetchComments({ participantId, limit: 50, offset: 0 }));
    }
  }, [dispatch, contestId, participantId]);

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
        <Button variant="secondary" onClick={() => navigate(`/contests/${contestId}`)}>
          Назад
        </Button>
        <h1>{participant.pet_name}</h1>
      </div>

      <div className="participant-page-content">
        <div className="participant-page-media">
          {isOwner && (
            <div className="participant-page-media-upload">
              <PhotoUpload participantId={participant.id} />
              <VideoUpload participantId={participant.id} />
            </div>
          )}
          {participant.photos && participant.photos.length > 0 && (
            <div className="participant-page-photos">
              {participant.photos.map((photo) => (
                <img key={photo.id} src={photo.url} alt={participant.pet_name} />
              ))}
            </div>
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
          <div className="participant-page-description">
            <h2>Описание</h2>
            <p>{participant.pet_description || 'Нет описания'}</p>
          </div>

          <div className="participant-page-votes">
            <p>Голосов: {participant.total_votes || 0}</p>
            {currentContest && (
              <VoteButton
                contestId={currentContest.id}
                participantId={participant.id}
                contestStatus={currentContest.status}
              />
            )}
          </div>

          <div className="participant-page-comments">
            <h2>Комментарии</h2>
            {comments.length === 0 ? (
              <p>Нет комментариев</p>
            ) : (
              <div className="participant-page-comments-list">
                {comments.map((comment) => (
                  <div key={comment.id} className="participant-page-comment">
                    <div className="comment-header">
                      <span>Пользователь {comment.user_id}</span>
                      <span>{new Date(comment.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <p>{comment.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantPage;
