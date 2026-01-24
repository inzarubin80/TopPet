import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState, store } from './store';
import { AppRoutes } from './routes';
import { fetchCurrentUser } from './store/slices/authSlice';
import { tokenStorage } from './utils/tokenStorage';
import './App.css';

const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, user, accessToken } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Load user info if we have a token but user is not loaded
    const token = tokenStorage.getAccessToken();
    if (token && !user) {
      // Try to load user - this will work if token is valid
      dispatch(fetchCurrentUser()).catch((err) => {
        // If loading fails (e.g., token expired), clear tokens
        console.log('[AppContent] Failed to load user, clearing tokens:', err);
        tokenStorage.clearTokens();
        dispatch({ type: 'auth/logout' });
      });
    }
  }, [dispatch, user]); // Only depend on user, not on isAuthenticated/accessToken to avoid loops

  return <AppRoutes />;
};

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
