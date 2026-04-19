import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { bootstrapNotifications } from '../store/slices/notificationsSlice';

/**
 * При возврате на вкладку — лёгкий refetch первой страницы и total_unread.
 */
export const useNotificationsVisibilityRefetch = (): void => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      void dispatch(bootstrapNotifications({ signal: ac.signal }));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      abortRef.current?.abort();
    };
  }, [dispatch, user]);
};
