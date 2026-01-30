import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { AuthProviders } from '../components/auth/AuthProviders';
import { login } from '../store/slices/authSlice';
import { tokenStorage } from '../utils/tokenStorage';
import { getAndClearReturnUrl } from '../utils/navigation';
import { useToast } from '../contexts/ToastContext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { showError } = useToast();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    // Если пользователь уже авторизован, редиректим на главную
    // НО: не обрабатываем здесь, если мы на странице с OAuth callback параметрами
    // (это обрабатывается в отдельном useEffect ниже)
    // ИЛИ если мы уже не на странице /login (значит, уже произошла навигация)
    if (isAuthenticated) {
      const urlParams = new URLSearchParams(window.location.search);
      const hasOAuthParams = urlParams.has('access_token') || urlParams.has('error');
      const isOnLoginPage = window.location.pathname === '/login';
      
      // Пропускаем обработку, если есть OAuth параметры (их обработает другой useEffect)
      // ИЛИ если мы уже не на странице /login (значит, уже произошла навигация)
      if (hasOAuthParams || !isOnLoginPage) {
        return;
      }
      
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
      const errorMessage = `Ошибка авторизации: ${errorDescription || error}`;
      showError(errorMessage);
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
  }, [dispatch, navigate, showError]);

  return (
    <div className="login-page">
      <div className="login-page-content">
        <h1 className="login-page-title">TOP-PET</h1>
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
