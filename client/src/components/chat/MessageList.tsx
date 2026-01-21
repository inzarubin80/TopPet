import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../../types/models';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: number;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} ч назад`;

    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="message-list-empty">Нет сообщений</div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={`message-item ${message.is_system ? 'message-system' : ''} ${
              currentUserId === message.user_id ? 'message-own' : ''
            }`}
          >
            {!message.is_system && (
              <div className="message-header">
                <span className="message-user">Пользователь {message.user_id}</span>
                <span className="message-time">{formatDate(message.created_at)}</span>
              </div>
            )}
            <div className="message-text">{message.text}</div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
