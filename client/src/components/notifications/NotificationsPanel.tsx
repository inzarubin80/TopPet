import React, { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import {
  bootstrapNotifications,
  loadMoreNotifications,
  markAllNotificationsReadThunk,
  markNotificationReadThunk,
} from '../../store/slices/notificationsSlice';
import { getNotificationLineText } from '../../utils/notificationCopy';
import { getNotificationNavigatePath } from '../../utils/notificationNavigation';
import { formatRelativeTime } from '../../utils/relativeTime';
import { useToast } from '../../contexts/ToastContext';
import './NotificationsPanel.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const NotificationsPanel: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { showError } = useToast();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listScrollRef = useRef<HTMLUListElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const bootstrapAbortRef = useRef<AbortController | null>(null);

  const {
    items,
    totalUnread,
    listStatus,
    listError,
    hasMore,
    refreshInProgress,
  } = useSelector((s: RootState) => s.notifications);

  const loadFirst = useCallback(() => {
    bootstrapAbortRef.current?.abort();
    const ac = new AbortController();
    bootstrapAbortRef.current = ac;
    void dispatch(bootstrapNotifications({ signal: ac.signal }));
  }, [dispatch]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (items.length === 0 && listStatus === 'idle') {
      loadFirst();
    }
  }, [open, items.length, listStatus, loadFirst]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const el = sentinelRef.current;
    const scrollRoot = listScrollRef.current;
    if (!el || !scrollRoot || !hasMore || listStatus !== 'succeeded') {
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }
        loadAbortRef.current?.abort();
        const ac = new AbortController();
        loadAbortRef.current = ac;
        void dispatch(loadMoreNotifications({ signal: ac.signal }));
      },
      { root: scrollRoot, rootMargin: '80px', threshold: 0 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      loadAbortRef.current?.abort();
    };
  }, [open, hasMore, listStatus, dispatch, items.length]);

  const handleRetry = () => {
    loadFirst();
  };

  const handleMarkAll = async () => {
    try {
      await dispatch(markAllNotificationsReadThunk()).unwrap();
    } catch {
      showError('Не удалось пометить все прочитанными');
      void dispatch(bootstrapNotifications({}));
    }
  };

  const handleRowClick = async (id: string) => {
    const row = items.find((i) => i.id === id);
    if (!row) {
      return;
    }
    if (!row.read_at) {
      try {
        await dispatch(markNotificationReadThunk(id)).unwrap();
      } catch {
        showError('Не удалось сохранить прочитанность');
      }
    }
    const path = getNotificationNavigatePath(row);
    onClose();
    if (path) {
      navigate(path);
    }
  };

  const loadingInitial = listStatus === 'loading' && items.length === 0;
  const showEmpty = listStatus === 'succeeded' && items.length === 0 && !refreshInProgress;

  return (
    <div
      ref={panelRef}
      className="notifications-panel"
      role="dialog"
      aria-label="Уведомления"
      aria-modal="true"
    >
      <div className="notifications-panel-header">
        <h2 className="notifications-panel-title">Уведомления</h2>
        {totalUnread > 0 ? (
          <button type="button" className="notifications-panel-mark-all" onClick={() => void handleMarkAll()}>
            Прочитать все
          </button>
        ) : null}
      </div>

      {listError && listStatus === 'failed' ? (
        <div className="notifications-panel-error">
          <p>{listError}</p>
          <button type="button" className="notifications-panel-retry" onClick={handleRetry}>
            Повторить
          </button>
        </div>
      ) : null}

      {listError && listStatus === 'succeeded' ? (
        <p className="notifications-panel-inline-error" role="alert">
          {listError}
        </p>
      ) : null}

      {loadingInitial ? (
        <ul ref={listScrollRef} className="notifications-panel-list" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={`sk-${i}`} className="notifications-panel-skeleton">
              <span className="notifications-panel-skeleton-line" />
              <span className="notifications-panel-skeleton-meta" />
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <p className="notifications-panel-empty">Пока нет уведомлений</p>
      ) : null}

      {!loadingInitial && items.length > 0 ? (
        <ul ref={listScrollRef} className="notifications-panel-list">
          {items.map((n) => {
            const unread = !n.read_at;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notifications-panel-item${unread ? ' notifications-panel-item-unread' : ''}`}
                  onClick={() => void handleRowClick(n.id)}
                >
                  <span className="notifications-panel-item-text">{getNotificationLineText(n)}</span>
                  <span className="notifications-panel-item-time">{formatRelativeTime(n.created_at)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {listStatus === 'loadingMore' ? (
        <p className="notifications-panel-loading-more">Загрузка…</p>
      ) : null}

      {hasMore && items.length > 0 ? <div ref={sentinelRef} className="notifications-panel-sentinel" aria-hidden /> : null}

      {refreshInProgress ? <p className="notifications-panel-refresh-hint" aria-live="polite">Обновление…</p> : null}
    </div>
  );
};
