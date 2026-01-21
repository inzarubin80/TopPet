import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { AuthProviders } from '../components/auth/AuthProviders';
import { login } from '../store/slices/authSlice';
import { tokenStorage } from '../utils/tokenStorage';
import { getAndClearReturnUrl } from '../utils/navigation';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    // Если пользователь уже авторизован, редиректим на главную
    if (isAuthenticated) {
      const returnUrl = getAndClearReturnUrl();
      navigate(returnUrl || '/');
    }
  }, [isAuthenticated, navigate]);

  // Проверяем, не пришли ли мы с OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const userId = urlParams.get('user_id');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      alert(`Ошибка авторизации: ${errorDescription || error}`);
      // Очищаем URL от параметров ошибки
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (accessToken && refreshToken && userId) {
      // OAuth callback успешен - сохраняем токены
      tokenStorage.saveTokens(accessToken, refreshToken);
      dispatch(login({
        token: accessToken,
        refresh_token: refreshToken,
        user_id: parseInt(userId, 10),
      }));

      // Очищаем URL и редиректим
      const returnUrl = getAndClearReturnUrl();
      const cleanUrl = returnUrl || '/';
      window.history.replaceState({}, '', cleanUrl);
      navigate(cleanUrl);
    }
  }, [dispatch, navigate]);

  return (
    <div className="login-page">
      <div className="login-page-content">
        <h1 className="login-page-title">Конкурсы красоты животных</h1>
        <p className="login-page-subtitle">
          Войдите, чтобы создавать конкурсы, добавлять участников и голосовать
        </p>
        <div className="login-page-providers">
          <AuthProviders />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
