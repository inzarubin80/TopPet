import React, { useEffect, useState } from 'react';
import { getProviders } from '../../api/authApi';
import { Provider } from '../../types/models';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import './AuthProviders.css';

interface AuthProvidersProps {
  onProviderClick?: (provider: string) => void;
}

export const AuthProviders: React.FC<AuthProvidersProps> = ({ onProviderClick }) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProviders();
        setProviders(data);
      } catch (err: any) {
        setError(err.message || 'Не удалось загрузить провайдеры авторизации');
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return base64;
  };

  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const digestArray = new Uint8Array(digest);
    const chars = Array.from(digestArray).map((byte) => String.fromCharCode(byte)).join('');
    return btoa(chars)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const handleProviderClick = async (provider: string) => {
    if (onProviderClick) {
      onProviderClick(provider);
      return;
    }

    try {
      setError(null);
      
      // VK doesn't support PKCE, so we skip it for VK
      const supportsPKCE = provider !== 'vk';
      
      let codeVerifier = '';
      let codeChallenge = '';
      
      if (supportsPKCE) {
        // Генерируем PKCE параметры
        codeVerifier = generateCodeVerifier();
        codeChallenge = await generateCodeChallenge(codeVerifier);
      }

      // Инициация OAuth flow
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
      const requestBody: any = {
        provider,
        action: 'login',
      };
      
      if (supportsPKCE) {
        requestBody.code_challenge = codeChallenge;
        requestBody.code_verifier = codeVerifier;
      }
      
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Не удалось инициировать авторизацию');
      }

      const data = await response.json();
      if (data.auth_url) {
        // Сохраняем code_verifier в sessionStorage для использования в callback (только для провайдеров с PKCE)
        if (supportsPKCE && codeVerifier) {
          sessionStorage.setItem(`oauth_code_verifier_${provider}`, codeVerifier);
        }
        // Редирект на страницу авторизации провайдера
        window.location.href = data.auth_url;
      } else {
        throw new Error('Сервер не вернул URL авторизации');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось инициировать авторизацию');
    }
  };

  if (loading) {
    return (
      <div className="auth-providers-loading">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (providers.length === 0) {
    return (
      <div className="auth-providers-empty">
        Нет доступных провайдеров авторизации
      </div>
    );
  }

  return (
    <div className="auth-providers">
      {providers.map((provider) => (
        <button
          key={provider.provider}
          onClick={() => handleProviderClick(provider.provider)}
          className="auth-provider-button"
          data-provider={provider.provider}
        >
          <span
            className="auth-provider-icon"
            dangerouslySetInnerHTML={{ __html: provider.icon_svg }}
          />
          <span className="auth-provider-name">Войти через {provider.name}</span>
        </button>
      ))}
    </div>
  );
};
