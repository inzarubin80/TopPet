import React, { useRef, useState } from 'react';
import { ChatMessage } from '../../types/models';
import { buildThreadList } from '../../utils/messageTree';
import { getMessengerAvatarColor, getMessengerInitials } from '../../utils/messengerAvatar';
import { resolvePublicAssetUrl } from '../../utils/seo';
import '../common/MessengerActionBar.css';
import './MessageList.css';

/** Чат или комментарии к работе — общий список для MessageList. */
export type MessageListRow = Pick<
  ChatMessage,
  | 'id'
  | 'user_id'
  | 'user_name'
  | 'user_avatar_url'
  | 'text'
  | 'image_url'
  | 'parent_id'
  | 'score'
  | 'user_vote'
  | 'created_at'
> & { is_system?: boolean };

const MessageAuthorAvatar: React.FC<{
  userId: number;
  userName: string;
  userAvatarUrl?: string;
}> = ({ userId, userName, userAvatarUrl }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const raw = userAvatarUrl?.trim();
  const resolved = raw ? resolvePublicAssetUrl(raw) : '';
  const avatarColor = getMessengerAvatarColor(userId);
  const initials = getMessengerInitials(userName);

  if (resolved && !imgFailed) {
    return (
      <div className="message-avatar message-avatar--photo" title={userName}>
        <img
          className="message-avatar-img"
          src={resolved}
          alt=""
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="message-avatar" style={{ backgroundColor: avatarColor }} title={userName}>
      {initials}
    </div>
  );
};

interface MessageListProps {
  messages: MessageListRow[];
  /** false — список растёт по высоте, без внутренней прокрутки (чат конкурса). По умолчанию true — скролл внутри области (комментарии). */
  containedScroll?: boolean;
  currentUserId?: number;
  /** When false, +/- are disabled (e.g. not signed in). */
  canVote?: boolean;
  /** Когда false — кнопка «Ответить» неактивна (например, нет прав на комментарии). */
  canReply?: boolean;
  /** Пустой список: подпись (по умолчанию как в чате). */
  emptyLabel?: string;
  /** Редактирование: по умолчанию только своё сообщение. */
  canEditMessage?: (message: MessageListRow) => boolean;
  /** Удаление: по умолчанию только своё сообщение. */
  canDeleteMessage?: (message: MessageListRow) => boolean;
  onUpdateMessage?: (messageId: string, text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onReply?: (message: MessageListRow) => void;
  onVote?: (messageId: string, value: -1 | 1) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  containedScroll = true,
  currentUserId,
  canVote = true,
  canReply = true,
  emptyLabel = 'Нет сообщений',
  canEditMessage,
  canDeleteMessage,
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
    if (!containedScroll) return;
    if (isAtBottom && listRef.current) {
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isAtBottom, containedScroll]);

  const handleScroll = () => {
    if (!containedScroll) return;
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 40;
    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom && distanceFromBottom > 100);
  };

  const scrollToBottom = () => {
    if (!containedScroll || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
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

  React.useEffect(() => {
    if (!openMenuId) return;
    const close = (e: MouseEvent) => {
      const el = document.querySelector(`[data-message-menu="${openMenuId}"]`);
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenuId]);

  const threadedMessages = buildThreadList(messages);
  const byId = new Map(messages.map((msg) => [msg.id, msg]));

  return (
    <div
      className={`message-list${containedScroll ? '' : ' message-list--natural-flow'}`}
      ref={containedScroll ? listRef : undefined}
      onScroll={containedScroll ? handleScroll : undefined}
    >
      {messages.length === 0 ? (
        <div className="message-list-empty">{emptyLabel}</div>
      ) : (
        threadedMessages.map(({ item: message, depth }, index) => {
          const safeDepth = Math.min(depth, 5);
          // Show date separator if this is the first message or if the previous message is from a different day
          const prevMessage = index > 0 ? threadedMessages[index - 1].item : null;
          const showDateSeparator =
            message.is_system !== true &&
            (!prevMessage ||
              !isSameDay(new Date(message.created_at), new Date(prevMessage.created_at)) ||
              prevMessage.is_system === true);
          
          const isOwn = currentUserId === message.user_id;
          const allowEdit = canEditMessage ? canEditMessage(message) : isOwn;
          const allowDelete = canDeleteMessage ? canDeleteMessage(message) : isOwn;
          const showMessageMenu = allowEdit || allowDelete;
          const userName = message.user_name || `Пользователь ${message.user_id}`;
          const parentMessage = message.parent_id ? byId.get(message.parent_id) : undefined;
          const replyToName = parentMessage
            ? (parentMessage.user_name || `Пользователь ${parentMessage.user_id}`)
            : null;
          return (
            <React.Fragment key={message.id}>
              {showDateSeparator && (
                <div className="message-date-separator">
                  <span>{formatDateSeparator(message.created_at)}</span>
                </div>
              )}
              <div
                className={`message-item-wrapper ${message.is_system === true ? 'message-system-wrapper' : ''}`}
                style={{ marginLeft: `${safeDepth * 14}px` }}
              >
              {message.is_system !== true && (
                <MessageAuthorAvatar
                  userId={message.user_id}
                  userName={userName}
                  userAvatarUrl={message.user_avatar_url}
                />
              )}
              <div
                className={`message-item ${message.is_system === true ? 'message-system' : ''}`}
              >
                {message.is_system !== true && (
                  <div className="message-header">
                    <div className="message-header-titles">
                      <span className="message-user">{userName}</span>
                      {replyToName ? (
                        <span className="message-reply-target">↪ {replyToName}</span>
                      ) : null}
                    </div>
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
                      {allowDelete ? (
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
                      ) : null}
                      <button type="button" className="message-edit-btn primary" onClick={() => handleSaveEdit(message.id)}>
                        Сохранить
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.image_url ? (
                      <a
                        href={resolvePublicAssetUrl(message.image_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="message-inline-image-link"
                      >
                        <img
                          className="message-inline-image"
                          src={resolvePublicAssetUrl(message.image_url)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      </a>
                    ) : null}
                    {message.text ? <div className="message-text">{message.text}</div> : null}
                    {message.is_system !== true && (
                      <div className="message-footer-row">
                        <div className="messenger-action-bar">
                          <button
                            type="button"
                            className={`messenger-action-btn messenger-action-up ${
                              message.user_vote === 1 ? 'active-positive' : ''
                            }`}
                            disabled={!canVote || !onVote}
                            onClick={() => onVote?.(message.id, 1)}
                            aria-label="Плюс"
                          >
                            {message.score > 0 ? `+ ${message.score}` : '+'}
                          </button>
                          <button
                            type="button"
                            className={`messenger-action-btn messenger-action-down ${
                              message.user_vote === -1 ? 'active-negative' : ''
                            }`}
                            disabled={!canVote || !onVote}
                            onClick={() => onVote?.(message.id, -1)}
                            aria-label="Минус"
                          >
                            {message.score < 0 ? `− ${Math.abs(message.score)}` : '−'}
                          </button>
                          <button
                            type="button"
                            className="messenger-action-btn messenger-action-reply"
                            disabled={!canReply}
                            onClick={() => onReply?.(message)}
                          >
                            Ответить
                          </button>
                          {showMessageMenu ? (
                            <div
                              className="message-menu message-menu-in-action-bar"
                              data-message-menu={message.id}
                            >
                              <button
                                type="button"
                                className="message-menu-trigger--gear"
                                onClick={() => toggleMenu(message.id)}
                                aria-label="Действия с сообщением"
                                aria-expanded={openMenuId === message.id}
                              >
                                <svg
                                  className="message-menu-trigger-gear"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  aria-hidden
                                >
                                  <path
                                    d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <svg
                                  className="message-menu-trigger-caret"
                                  width="8"
                                  height="5"
                                  viewBox="0 0 8 5"
                                  aria-hidden
                                >
                                  <path d="M0 0h8L4 5z" fill="currentColor" />
                                </svg>
                              </button>
                              {openMenuId === message.id && (
                                <div className="message-menu-dropdown">
                                  {allowEdit ? (
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
                                  ) : null}
                                  {allowDelete ? (
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
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ) : null}
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
      {containedScroll && showScrollButton && (
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
