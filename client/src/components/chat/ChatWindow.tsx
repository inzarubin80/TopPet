import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ContestID } from '../../types/models';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ConnectionStatus } from './ConnectionStatus';
import { LoadingSpinner } from '../common/LoadingSpinner';
import * as chatApi from '../../api/chatApi';
import { setMessages } from '../../store/slices/chatSlice';
import { useDispatch } from 'react-redux';
import './ChatWindow.css';

interface ChatWindowProps {
  contestId: ContestID;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ contestId }) => {
  const dispatch = useDispatch();
  const { connectionState, messages, sendMessage, reconnect, isConnected } = useWebSocket(contestId);
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await chatApi.getChatMessages(contestId, 50, 0);
        dispatch(setMessages({ contestId, messages: response.items }));
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    loadHistory();
  }, [contestId, dispatch]);

  const handleSendMessage = (text: string) => {
    if (isConnected && isAuthenticated) {
      sendMessage(text);
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
        ) : (
          <MessageList messages={messages} currentUserId={currentUserId} />
        )}
      </div>
      <div className="chat-footer">
        {isAuthenticated ? (
          <MessageInput
            onSend={handleSendMessage}
            disabled={!isConnected}
            placeholder={isConnected ? 'Введите сообщение...' : 'Подключение...'}
          />
        ) : (
          <div className="chat-auth-required">Войдите, чтобы отправлять сообщения</div>
        )}
      </div>
    </div>
  );
};
