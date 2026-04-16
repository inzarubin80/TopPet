import React, { useRef, useState } from 'react';
import { ChatMessage } from '../../types/models';
import { buildThreadList } from '../../utils/messageTree';
import { getMessengerAvatarColor, getMessengerInitials } from '../../utils/messengerAvatar';
import '../common/MessengerActionBar.css';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: number;
  /** When false, +/- are disabled (e.g. not signed in). */
  canVote?: boolean;
  onUpdateMessage?: (messageId: string, text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onReply?: (message: ChatMessage) => void;
  onVote?: (messageId: string, value: -1 | 1) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  canVote = true,
  onUpdateMessage,
  onDeleteMessage,
  onReply,
  onVote,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAtBottom && listRef.current) {
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
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
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
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

  const threadedMessages = buildThreadList(messages);
  const byId = new Map(messages.map((msg) => [msg.id, msg]));

  return (
    <div className="message-list" ref={listRef} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="message-list-empty">Нет сообщений</div>
      ) : (
        threadedMessages.map(({ item: message, depth }, index) => {
          const safeDepth = Math.min(depth, 5);
          // Show date separator if this is the first message or if the previous message is from a different day
          const prevMessage = index > 0 ? threadedMessages[index - 1].item : null;
          const showDateSeparator = 
            !message.is_system && 
            (!prevMessage || 
             !isSameDay(new Date(message.created_at), new Date(prevMessage.created_at)) ||
             prevMessage.is_system);
          
          const isOwn = currentUserId === message.user_id;
          const userName = message.user_name || `Пользователь ${message.user_id}`;
          const parentMessage = message.parent_id ? byId.get(message.parent_id) : undefined;
          const replyToName = parentMessage
            ? (parentMessage.user_name || `Пользователь ${parentMessage.user_id}`)
            : null;
          const avatarColor = getMessengerAvatarColor(message.user_id);
          const initials = getMessengerInitials(userName);

          return (
            <React.Fragment key={message.id}>
              {showDateSeparator && (
                <div className="message-date-separator">
                  <span>{formatDateSeparator(message.created_at)}</span>
                </div>
              )}
              <div
                className={`message-item-wrapper ${message.is_system ? 'message-system-wrapper' : ''}`}
                style={{ marginLeft: `${safeDepth * 14}px` }}
              >
              {!message.is_system && (
                <div
                  className="message-avatar"
                  style={{ backgroundColor: avatarColor }}
                  title={userName}
                >
                  {initials}
                </div>
              )}
              <div
                className={`message-item ${message.is_system ? 'message-system' : ''}`}
              >
                {!message.is_system && (
                  <div className="message-header">
                    <div className="message-header-titles">
                      <span className="message-user">{userName}</span>
                      {replyToName ? (
                        <span className="message-reply-target">↪ {replyToName}</span>
                      ) : null}
                    </div>
                    {isOwn && (
                      <div className="message-actions">
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
                  <>
                    <div className="message-text">{message.text}</div>
                    {!message.is_system && (
                      <div className="message-footer-row">
                        <div className="messenger-action-bar">
                          <button
                            type="button"
                            className={`messenger-action-btn ${message.user_vote === 1 ? 'active-positive' : ''}`}
                            disabled={!canVote || !onVote}
                            onClick={() => onVote?.(message.id, 1)}
                            aria-label="Плюс"
                          >
                            {message.score > 0 ? `+ ${message.score}` : '+'}
                          </button>
                          <button
                            type="button"
                            className={`messenger-action-btn ${message.user_vote === -1 ? 'active-negative' : ''}`}
                            disabled={!canVote || !onVote}
                            onClick={() => onVote?.(message.id, -1)}
                            aria-label="Минус"
                          >
                            {message.score < 0 ? `- ${Math.abs(message.score)}` : '-'}
                          </button>
                          <button
                            type="button"
                            className="messenger-action-btn messenger-action-reply"
                            onClick={() => onReply?.(message)}
                          >
                            Ответить
                          </button>
                        </div>
                        <span
                          className="message-time"
                          title={formatFullDate(message.created_at)}
                        >
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
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
