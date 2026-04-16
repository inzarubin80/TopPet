import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { AppDispatch, RootState, store } from './store';
import { AppRoutes } from './routes';
import { fetchCurrentUser } from './store/slices/authSlice';
import { tokenStorage } from './utils/tokenStorage';
import { ToastProvider } from './contexts/ToastContext';
import { YandexMetrika } from './components/analytics/YandexMetrika';
import { logger } from './utils/logger';
import { COOKIE_CONSENT_ACCEPTED_EVENT, hasCookieConsent } from './utils/cookieConsent';
import './App.css';

const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Load user info if we have a token but user is not loaded
    const token = tokenStorage.getAccessToken();
    if (token && !user) {
      // Try to load user - this will work if token is valid
      dispatch(fetchCurrentUser()).catch((err) => {
        // If loading fails (e.g., token expired), clear tokens
        logger.warn('[AppContent] Failed to load user, clearing tokens', err);
        tokenStorage.clearTokens();
        dispatch({ type: 'auth/logout' });
      });
    }
  }, [dispatch, user]); // Only depend on user, not on isAuthenticated/accessToken to avoid loops

  return <AppRoutes />;
};

function App() {
  const [cookieConsentAccepted, setCookieConsentAccepted] = useState<boolean>(() => hasCookieConsent());

  useEffect(() => {
    const update = () => setCookieConsentAccepted(hasCookieConsent());

    window.addEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, update);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_ACCEPTED_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return (
    <HelmetProvider>
      <Provider store={store}>
        <ToastProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {cookieConsentAccepted ? <YandexMetrika /> : null}
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </Provider>
    </HelmetProvider>
  );
}

export default App;
