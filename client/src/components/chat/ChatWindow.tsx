import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ContestID, ContestStatus } from '../../types/models';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ConnectionStatus } from './ConnectionStatus';
import { LoadingSpinner } from '../common/LoadingSpinner';
import * as chatApi from '../../api/chatApi';
import { removeMessage, setMessages } from '../../store/slices/chatSlice';
import { useDispatch } from 'react-redux';
import './ChatWindow.css';

interface ChatWindowProps {
  contestId: ContestID;
  contestStatus: ContestStatus;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ contestId, contestStatus }) => {
  const isChatAvailable =
    contestStatus === 'registration' || contestStatus === 'voting' || contestStatus === 'finished';
  const dispatch = useDispatch();
  const { connectionState, messages, sendMessage, reconnect, isConnected } = useWebSocket(
    isChatAvailable ? contestId : null,
    null
  );
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

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

  const handleSendMessage = (text: string) => {
    if (isConnected && isAuthenticated) {
      sendMessage(text);
    }
  };

  const handleUpdateMessage = async (messageId: string, text: string) => {
    try {
      await chatApi.updateChatMessage(messageId, text);
    } catch (error) {
      console.error('Failed to update chat message:', error);
      alert('Не удалось обновить сообщение');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await chatApi.deleteChatMessage(messageId);
      dispatch(removeMessage({ contestId, messageId }));
    } catch (error) {
      console.error('Failed to delete chat message:', error);
      alert('Не удалось удалить сообщение');
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>Чат конкурса</h3>
        <ConnectionStatus state={connectionState} onReconnect={reconnect} />
      </div>
      <div className="chat-content">
        {connectionState === 'CONNECTING' && messages.length === 0 ? (
          <div className="chat-loading">
            <LoadingSpinner size="medium" />
          </div>
        ) : !isChatAvailable ? (
          <div className="chat-loading">Чат доступен на этапах регистрации, голосования и финала</div>
        ) : (
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            onUpdateMessage={handleUpdateMessage}
            onDeleteMessage={handleDeleteMessage}
          />
        )}
      </div>
      <div className="chat-footer">
        {isAuthenticated && isChatAvailable ? (
          <MessageInput
            onSend={handleSendMessage}
            disabled={!isConnected}
            placeholder={isConnected ? 'Введите сообщение...' : 'Подключение...'}
          />
        ) : (
          <div className="chat-auth-required">
            {isChatAvailable ? 'Войдите, чтобы отправлять сообщения' : 'Чат недоступен'}
          </div>
        )}
      </div>
    </div>
  );
};
