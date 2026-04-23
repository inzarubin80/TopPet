import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
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
} from '../store/slices/directMessagesSlice';
import { useToast } from '../contexts/ToastContext';
import type { UserSearchHit } from '../types/models';
import './MessagesPage.css';

const MessagesPage: React.FC = () => {
  const dispatch = useDispatch();
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
              />
            </button>
          ))}
        </div>
      </aside>
      <section className="messages-page-chat">
        {activeConversation ? (
          <>
            <div className="messages-page-chat-header">{activeConversation.peer_user_name}</div>
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
