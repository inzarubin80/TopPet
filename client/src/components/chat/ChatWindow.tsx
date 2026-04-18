import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { RootState } from '../../store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ChatMessage, ContestID, ContestStatus } from '../../types/models';
import { MessageList } from './MessageList';
import { MessageInput, MessageSendPayload } from './MessageInput';
import { ConnectionStatus } from './ConnectionStatus';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { buildLoginUrl } from '../../utils/navigation';
import * as chatApi from '../../api/chatApi';
import { removeMessage, setMessageVote, setMessages } from '../../store/slices/chatSlice';
import { useDispatch } from 'react-redux';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import './ChatWindow.css';

const EMPTY_CHAT_MESSAGES: ChatMessage[] = [];

interface ChatWindowProps {
  contestId: ContestID;
  contestStatus: ContestStatus;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ contestId, contestStatus }) => {
  const [replyTo, setReplyTo] = React.useState<{ id: string; text: string } | null>(null);
  const isChatAvailable =
    contestStatus === 'publication' ||
    contestStatus === 'registration' ||
    contestStatus === 'voting' ||
    contestStatus === 'finished';
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useToast();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Only connect to WebSocket if authenticated and chat is available
  const wsContestId = isAuthenticated && isChatAvailable ? contestId : null;
  const { connectionState, sendMessage, reconnect, isConnected } = useWebSocket(
    wsContestId,
    null
  );

  // Get messages from Redux store directly (for both authenticated and unauthenticated users)
  // This ensures messages loaded via API are displayed even when WebSocket is not connected
  const messages = useSelector((state: RootState) =>
    contestId ? state.chat.messages[contestId] || EMPTY_CHAT_MESSAGES : EMPTY_CHAT_MESSAGES
  );

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        if (!isChatAvailable) {
          return;
        }
        const response = await chatApi.getChatMessages(contestId, 50, 0);
        dispatch(setMessages({ contestId, messages: response.items }));
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    loadHistory();
  }, [contestId, dispatch, isChatAvailable]);

  const handleSendMessage = React.useCallback(
    (payload: MessageSendPayload) => {
      if (!isConnected || !isAuthenticated) {
        return;
      }
      const t = payload.text.trim();
      if (t === '' && !payload.imageUrl) {
        return;
      }
      sendMessage(t, replyTo?.id, payload.imageUrl || undefined);
      setReplyTo(null);
    },
    [isConnected, isAuthenticated, sendMessage, replyTo?.id]
  );

  const handleUpdateMessage = async (messageId: string, text: string) => {
    try {
      await chatApi.updateChatMessage(messageId, text);
    } catch (error) {
      errorHandler.handleError(error, () => showError('Не удалось обновить сообщение'));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await chatApi.deleteChatMessage(messageId);
      dispatch(removeMessage({ contestId, messageId }));
    } catch (error) {
      errorHandler.handleError(error, () => showError('Не удалось удалить сообщение'));
    }
  };

  const handleVoteMessage = async (messageId: string, value: -1 | 1) => {
    const previousVote = (messages.find((message) => message.id === messageId)?.user_vote || 0) as -1 | 0 | 1;
    try {
      dispatch(setMessageVote({ contestId, messageId, value }));
      await chatApi.voteChatMessage(messageId, value);
    } catch (error) {
      dispatch(setMessageVote({ contestId, messageId, value: previousVote }));
      errorHandler.handleError(error, () => showError('Не удалось поставить оценку'));
    }
  };

  return (
    <div className="chat-window chat-window--natural-flow">
      <div className="chat-header">
        {isAuthenticated && (
          <ConnectionStatus state={connectionState} onReconnect={reconnect} />
        )}
      </div>
      <div className="chat-content">
        {isAuthenticated && connectionState === 'CONNECTING' && messages.length === 0 ? (
          <div className="chat-loading">
            <LoadingSpinner size="medium" />
          </div>
        ) : !isChatAvailable ? (
          <div className="chat-loading">
            Чат доступен на этапах публикации, регистрации, голосования и финала
          </div>
        ) : (
          <MessageList
            messages={messages}
            containedScroll={false}
            currentUserId={currentUserId}
            canVote={isAuthenticated}
            onUpdateMessage={handleUpdateMessage}
            onDeleteMessage={handleDeleteMessage}
            onReply={(message) => setReplyTo({ id: message.id, text: message.text })}
            onVote={handleVoteMessage}
          />
        )}
      </div>
      <div className="chat-footer">
        {isAuthenticated && isChatAvailable ? (
          <>
            {replyTo && (
              <div className="chat-reply-banner">
                <span className="chat-reply-banner-label">
                  Вы отвечаете…{' '}
                  <span className="chat-reply-banner-snippet">
                    {(replyTo.text || 'Вложение').slice(0, 100)}
                  </span>
                </span>
                <button type="button" className="chat-reply-banner-cancel" onClick={() => setReplyTo(null)}>
                  Отмена
                </button>
              </div>
            )}
            <MessageInput
              onSend={handleSendMessage}
              uploadImage={(file) => chatApi.uploadContestChatImage(contestId, file)}
              disabled={!isConnected}
              placeholder={isConnected ? 'Введите сообщение...' : 'Подключение...'}
            />
          </>
        ) : (
          <div className="chat-auth-required">
            {isChatAvailable ? (
              <div className="chat-auth-required-content">
                <span>Войдите, чтобы голосовать и отправлять сообщения</span>
                <Button
                  size="small"
                  fullWidth={true}
                  onClick={() => navigate(buildLoginUrl(location.pathname + location.search))}
                >
                  Войти
                </Button>
              </div>
            ) : (
              'Чат недоступен'
            )}
          </div>
        )}
      </div>
    </div>
  );
};
