import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const YANDEX_METRIKA_SCRIPT_BASE = 'https://mc.yandex.ru/metrika/tag.js';

export const YandexMetrika: React.FC = () => {
  const location = useLocation();
  const [scriptReady, setScriptReady] = useState(false);

  const counterIdStr = process.env.REACT_APP_YANDEX_METRIKA_ID;
  const counterId = counterIdStr ? parseInt(counterIdStr, 10) : 0;
  const isEnabled = Number.isFinite(counterId) && counterId > 0;

  useEffect(() => {
    if (!isEnabled) {
      console.log('[YandexMetrika] отключена:', { counterIdStr });
      return;
    }

    console.log('[YandexMetrika] инициализация:', { counterId });

    const initMetrika = () => {
      console.log('[YandexMetrika] init:', { counterId });
      window.ym?.(counterId, 'init', {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
      setScriptReady(true);
      setTimeout(() => {
        const url = window.location.href;
        console.log('[YandexMetrika] первый хит:', { url });
        window.ym?.(counterId, 'hit', url);
      }, 150);
    };

    if (window.ym) {
      console.log('[YandexMetrika] window.ym уже есть, вызываем init');
      initMetrika();
    } else {
      const scriptUrl = `${YANDEX_METRIKA_SCRIPT_BASE}?id=${counterId}`;
      console.log('[YandexMetrika] загрузка скрипта:', { scriptUrl });
      const script = document.createElement('script');
      script.async = true;
      script.src = scriptUrl;
      script.onload = () => {
        console.log('[YandexMetrika] скрипт загружен, вызываем init');
        initMetrika();
      };
      script.onerror = () => {
        console.error('[YandexMetrika] ошибка загрузки скрипта:', scriptUrl);
      };
      document.head.appendChild(script);
    }
  }, [isEnabled, counterId]);

  useEffect(() => {
    if (!isEnabled || !scriptReady || !window.ym) return;
    const url = window.location.href;
    console.log('[YandexMetrika] хит при смене маршрута:', { pathname: location.pathname, url });
    window.ym(counterId, 'hit', url);
  }, [isEnabled, counterId, scriptReady, location.pathname, location.search]);

  return null;
};
