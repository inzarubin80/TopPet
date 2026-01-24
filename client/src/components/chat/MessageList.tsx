import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../../types/models';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: number;
  onUpdateMessage?: (messageId: string, text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  onUpdateMessage,
  onDeleteMessage,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom < 40);
  };

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

  const handleStartEdit = (messageId: string, text: string) => {
    setEditingMessageId(messageId);
    setEditingText(text);
    setOpenMenuId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = (messageId: string) => {
    if (!editingText.trim()) {
      return;
    }
    onUpdateMessage?.(messageId, editingText.trim());
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleDelete = (messageId: string) => {
    onDeleteMessage?.(messageId);
    setOpenMenuId(null);
  };

  const toggleMenu = (messageId: string) => {
    setOpenMenuId((prev) => (prev === messageId ? null : messageId));
  };

  return (
    <div className="message-list" ref={listRef} onScroll={handleScroll}>
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
                <span className="message-user">
                  {message.user_name || `Пользователь ${message.user_id}`}
                </span>
                <span className="message-time">{formatDate(message.created_at)}</span>
                {currentUserId === message.user_id && (
                  <div className="message-menu">
                    <button
                      type="button"
                      className="message-menu-trigger"
                      onClick={() => toggleMenu(message.id)}
                      aria-label="Открыть меню"
                    >
                      ⋯
                    </button>
                    {openMenuId === message.id && (
                      <div className="message-menu-dropdown">
                        <button
                          type="button"
                          className="message-menu-item"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleStartEdit(message.id, message.text);
                          }}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          className="message-menu-item danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(message.id);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {editingMessageId === message.id ? (
              <div className="message-edit">
                <textarea
                  className="message-edit-input"
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  maxLength={2000}
                />
                <div className="message-edit-actions">
                  <button type="button" className="message-edit-btn" onClick={handleCancelEdit}>
                    Отмена
                  </button>
                  {currentUserId === message.user_id && (
                    <button
                      type="button"
                      className="message-edit-btn danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(message.id);
                      }}
                    >
                      Удалить
                    </button>
                  )}
                  <button type="button" className="message-edit-btn primary" onClick={() => handleSaveEdit(message.id)}>
                    Сохранить
                  </button>
                </div>
              </div>
            ) : (
              <div className="message-text">{message.text}</div>
            )}
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
