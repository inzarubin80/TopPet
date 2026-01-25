import React, { useRef, useState } from 'react';
import { ChatMessage } from '../../types/models';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: number;
  onUpdateMessage?: (messageId: string, text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

// Generate color based on user_id for consistent avatar colors
const getAvatarColor = (userId: number): string => {
  const colors = [
    '#2f6df6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];
  return colors[userId % colors.length];
};

// Get initials from user name
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  onUpdateMessage,
  onDeleteMessage,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 40;
    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom && distanceFromBottom > 100);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, now)) {
      return 'Сегодня';
    } else if (isSameDay(date, yesterday)) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
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

  // Group consecutive messages from the same user
  const groupMessages = (messages: ChatMessage[]): Array<{ message: ChatMessage; isFirstInGroup: boolean; isLastInGroup: boolean }> => {
    const grouped: Array<{ message: ChatMessage; isFirstInGroup: boolean; isLastInGroup: boolean }> = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const prevMessage = i > 0 ? messages[i - 1] : null;
      const nextMessage = i < messages.length - 1 ? messages[i + 1] : null;
      
      const isFirstInGroup = 
        message.is_system ||
        !prevMessage ||
        prevMessage.is_system ||
        prevMessage.user_id !== message.user_id ||
        (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) > 300000; // 5 minutes
      
      const isLastInGroup =
        message.is_system ||
        !nextMessage ||
        nextMessage.is_system ||
        nextMessage.user_id !== message.user_id ||
        (new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime()) > 300000; // 5 minutes
      
      grouped.push({ message, isFirstInGroup, isLastInGroup });
    }
    
    return grouped;
  };

  const groupedMessages = groupMessages(messages);

  return (
    <div className="message-list" ref={listRef} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="message-list-empty">Нет сообщений</div>
      ) : (
        groupedMessages.map(({ message, isFirstInGroup, isLastInGroup }, index) => {
          // Show date separator if this is the first message or if the previous message is from a different day
          const prevMessage = index > 0 ? groupedMessages[index - 1].message : null;
          const showDateSeparator = 
            !message.is_system && 
            (!prevMessage || 
             !isSameDay(new Date(message.created_at), new Date(prevMessage.created_at)) ||
             prevMessage.is_system);
          
          const isOwn = currentUserId === message.user_id;
          const userName = message.user_name || `Пользователь ${message.user_id}`;
          const avatarColor = getAvatarColor(message.user_id);
          const initials = getInitials(userName);

          return (
            <React.Fragment key={message.id}>
              {showDateSeparator && (
                <div className="message-date-separator">
                  <span>{formatDateSeparator(message.created_at)}</span>
                </div>
              )}
              <div
                className={`message-item-wrapper ${message.is_system ? 'message-system-wrapper' : ''} ${
                  isOwn ? 'message-own-wrapper' : ''
                } ${!isFirstInGroup ? 'message-grouped' : ''}`}
              >
              {!message.is_system && !isOwn && (
                <div
                  className={`message-avatar ${!isFirstInGroup ? 'message-avatar-hidden' : ''}`}
                  style={{ backgroundColor: avatarColor }}
                  title={userName}
                >
                  {initials}
                </div>
              )}
              <div
                className={`message-item ${message.is_system ? 'message-system' : ''} ${
                  isOwn ? 'message-own' : ''
                }`}
              >
                {!message.is_system && isFirstInGroup && (
                  <div className="message-header">
                    <span className="message-user">
                      {userName}
                    </span>
                    <span 
                      className="message-time" 
                      title={formatFullDate(message.created_at)}
                    >
                      {formatDate(message.created_at)}
                    </span>
                    {isOwn && (
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
                {!message.is_system && !isFirstInGroup && isOwn && (
                  <div className="message-menu-inline">
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
                      {isOwn && (
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
              {!message.is_system && isOwn && (
                <div
                  className={`message-avatar message-avatar-own ${!isFirstInGroup ? 'message-avatar-hidden' : ''}`}
                  style={{ backgroundColor: avatarColor }}
                  title={userName}
                >
                  {initials}
                </div>
              )}
            </div>
            </React.Fragment>
          );
        })
      )}
      <div ref={messagesEndRef} />
      {showScrollButton && (
        <button
          type="button"
          className="message-scroll-button"
          onClick={scrollToBottom}
          aria-label="Прокрутить вниз"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 14L12 19L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 5L12 10L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
};
