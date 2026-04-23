import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageInput, MessageSendPayload } from '../components/chat/MessageInput';
import { MessageList } from '../components/chat/MessageList';
import { MessengerUserPresentation } from '../components/common/MessengerUserPresentation';
import {
  listDirectConversations,
  listDirectMessages,
  ensureDirectConversation,
  sendDirectMessage,
  updateDirectMessage,
  deleteDirectMessage,
  deleteDirectConversation,
} from '../api/directMessagesApi';
import { searchUsers } from '../api/usersApi';
import { RootState } from '../store';
import {
  setActiveDirectConversation,
  setConversations,
  setMessages,
  upsertConversation,
  updateDirectMessageInConversation,
  removeDirectMessageFromConversation,
  removeConversation,
} from '../store/slices/directMessagesSlice';
import { useToast } from '../contexts/ToastContext';
import type { UserSearchHit } from '../types/models';
import './MessagesPage.css';

const MessagesPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { showError } = useToast();
  const currentUserId = useSelector((s: RootState) => s.auth.user?.id);
  const conversations = useSelector((s: RootState) => s.directMessages.conversations);
  const activeConversationId = useSelector((s: RootState) => s.directMessages.activeConversationId);
  const messagesByConversation = useSelector((s: RootState) => s.directMessages.messagesByConversation);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchHit[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchHit | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState(false);
  const hadPeerConversationRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingConversations(true);
        const response = await listDirectConversations();
        if (!cancelled) {
          dispatch(setConversations(response.items || []));
        }
      } catch {
        if (!cancelled) {
          showError('Не удалось загрузить список диалогов');
        }
      } finally {
        if (!cancelled) {
          setLoadingConversations(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [dispatch, showError]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const parsedUserId = Number(userId);
    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      return;
    }
    let cancelled = false;
    const ensure = async () => {
      try {
        const conversation = await ensureDirectConversation(parsedUserId);
        if (!cancelled) {
          dispatch(upsertConversation(conversation));
          dispatch(setActiveDirectConversation(conversation.id));
        }
      } catch {
        if (!cancelled) {
          showError('Не удалось открыть диалог');
        }
      }
    };
    void ensure();
    return () => {
      cancelled = true;
    };
  }, [dispatch, showError, userId]);

  useEffect(() => {
    hadPeerConversationRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!userId || loadingConversations) {
      return;
    }
    const pid = Number(userId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return;
    }
    const match = conversations.some((c) => c.peer_user_id === pid);
    if (match) {
      hadPeerConversationRef.current = true;
      return;
    }
    if (hadPeerConversationRef.current) {
      navigate('/messages', { replace: true });
      hadPeerConversationRef.current = false;
    }
  }, [conversations, userId, loadingConversations, navigate]);

  useEffect(() => {
    const q = searchValue.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        const users = await searchUsers(q, 10);
        if (!cancelled) {
          const filtered = users.filter((u) => u.id !== currentUserId);
          setSearchResults(filtered);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchValue, currentUserId]);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      dispatch(setActiveDirectConversation(conversations[0].id));
    }
  }, [activeConversationId, conversations, dispatch]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingMessages(true);
        const response = await listDirectMessages(activeConversationId);
        if (!cancelled) {
          dispatch(
            setMessages({
              conversationId: activeConversationId,
              items: response.items || [],
              total: response.total || 0,
            })
          );
        }
      } catch {
        if (!cancelled) {
          showError('Не удалось загрузить сообщения');
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, dispatch, showError]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations]
  );

  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] || [] : [];

  const messageRows = activeMessages.map((message) => ({
    id: message.id,
    user_id: message.sender_user_id,
    user_name: message.sender_user_name,
    user_avatar_url: message.sender_user_avatar_url,
    text: message.text,
    image_url: '',
    parent_id: undefined,
    score: 0,
    user_vote: 0,
    created_at: message.created_at,
  }));

  const handleSendMessage = async (payload: MessageSendPayload) => {
    if (!activeConversationId) {
      return;
    }
    const text = payload.text.trim();
    if (!text) {
      return;
    }
    try {
      await sendDirectMessage(activeConversationId, text);
    } catch {
      showError('Не удалось отправить сообщение');
    }
  };

  const handleUpdateMessage = async (messageId: string, text: string) => {
    if (!activeConversationId) {
      return;
    }
    try {
      const updated = await updateDirectMessage(activeConversationId, messageId, text.trim());
      dispatch(updateDirectMessageInConversation(updated));
    } catch {
      showError('Не удалось обновить сообщение');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversationId) {
      return;
    }
    try {
      await deleteDirectMessage(activeConversationId, messageId);
      dispatch(removeDirectMessageFromConversation({ conversationId: activeConversationId, messageId }));
    } catch {
      showError('Не удалось удалить сообщение');
    }
  };

  const handleDeleteChannel = async () => {
    if (!activeConversation || !activeConversationId) {
      return;
    }
    if (!window.confirm('Удалить диалог? Все сообщения будут удалены у обоих участников.')) {
      setChannelMenuOpen(false);
      return;
    }
    const convId = activeConversationId;
    const peerId = activeConversation.peer_user_id;
    try {
      setDeletingChannel(true);
      await deleteDirectConversation(convId);
      dispatch(removeConversation(convId));
      setChannelMenuOpen(false);
      if (userId && Number(userId) === peerId) {
        navigate('/messages', { replace: true });
      }
    } catch {
      showError('Не удалось удалить диалог');
    } finally {
      setDeletingChannel(false);
    }
  };

  useEffect(() => {
    if (!channelMenuOpen) {
      return;
    }
    const close = (e: MouseEvent) => {
      const el = document.querySelector('[data-messages-channel-menu="1"]');
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setChannelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [channelMenuOpen]);

  const handleCreateConversation = async () => {
    if (!selectedUser) {
      return;
    }
    try {
      setCreatingConversation(true);
      const conversation = await ensureDirectConversation(selectedUser.id);
      dispatch(upsertConversation(conversation));
      dispatch(setActiveDirectConversation(conversation.id));
      setSearchValue('');
      setSearchResults([]);
      setSelectedUser(null);
    } catch {
      showError('Не удалось создать диалог');
    } finally {
      setCreatingConversation(false);
    }
  };

  return (
    <div className="messages-page">
      <aside className="messages-page-sidebar">
        <h1>Сообщения</h1>
        <div className="messages-page-create">
          <label className="messages-page-create-label" htmlFor="messages-user-search">
            Новый диалог
          </label>
          <input
            id="messages-user-search"
            className="messages-page-search-input"
            value={searchValue}
            onChange={(event) => {
              const next = event.target.value;
              setSearchValue(next);
              setSelectedUser(null);
            }}
            placeholder="Имя, email или телефон"
          />
          {searchLoading ? <div className="messages-page-search-hint">Поиск...</div> : null}
          {!searchLoading && searchValue.trim().length >= 2 && searchResults.length === 0 ? (
            <div className="messages-page-search-hint">Пользователь не найден</div>
          ) : null}
          {searchResults.length > 0 ? (
            <div className="messages-page-search-results">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`messages-page-search-result ${
                    selectedUser?.id === user.id ? 'messages-page-search-result--active' : ''
                  }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <span>{user.name}</span>
                  {user.email ? <small>{user.email}</small> : null}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="messages-page-create-btn"
            disabled={!selectedUser || creatingConversation}
            onClick={handleCreateConversation}
          >
            {creatingConversation ? 'Создание...' : 'Создать диалог'}
          </button>
        </div>
        {loadingConversations ? <div className="messages-page-empty">Загрузка...</div> : null}
        {!loadingConversations && conversations.length === 0 ? (
          <div className="messages-page-empty">Диалогов пока нет</div>
        ) : null}
        <div className="messages-page-conversations">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`messages-page-conversation ${
                conversation.id === activeConversationId ? 'messages-page-conversation--active' : ''
              }`}
              onClick={() => dispatch(setActiveDirectConversation(conversation.id))}
            >
              <MessengerUserPresentation
                userId={conversation.peer_user_id}
                name={conversation.peer_user_name}
                avatarUrl={conversation.peer_user_avatar_url}
                subtitle={conversation.last_message_text || 'Нет сообщений'}
                size="sm"
                className="messages-page-conversation-user"
                showOnline={conversation.peer_user_online === true}
              />
            </button>
          ))}
        </div>
      </aside>
      <section className="messages-page-chat">
        {activeConversation ? (
          <>
            <div className="messages-page-chat-header">
              <span className="messages-page-chat-header-title">{activeConversation.peer_user_name}</span>
              <div className="messages-page-channel-menu" data-messages-channel-menu="1">
                <button
                  type="button"
                  className="messages-page-channel-menu-trigger"
                  onClick={() => setChannelMenuOpen((v) => !v)}
                  aria-expanded={channelMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Меню канала"
                  disabled={deletingChannel}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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
                </button>
                {channelMenuOpen ? (
                  <div className="messages-page-channel-menu-dropdown" role="menu">
                    <button
                      type="button"
                      className="messages-page-channel-menu-item messages-page-channel-menu-item--danger"
                      role="menuitem"
                      disabled={deletingChannel}
                      onClick={() => void handleDeleteChannel()}
                    >
                      {deletingChannel ? 'Удаление…' : 'Удалить'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="messages-page-chat-list">
              {loadingMessages ? (
                <div className="messages-page-empty">Загрузка сообщений...</div>
              ) : (
                <MessageList
                  messages={messageRows}
                  containedScroll={false}
                  currentUserId={currentUserId}
                  canVote={false}
                  canReply={false}
                  emptyLabel="Сообщений пока нет"
                  onUpdateMessage={handleUpdateMessage}
                  onDeleteMessage={handleDeleteMessage}
                />
              )}
            </div>
            <div className="messages-page-chat-input">
              <MessageInput onSend={handleSendMessage} placeholder="Написать сообщение..." />
            </div>
          </>
        ) : (
          <div className="messages-page-empty">Выберите диалог</div>
        )}
      </section>
    </div>
  );
};

export default MessagesPage;
