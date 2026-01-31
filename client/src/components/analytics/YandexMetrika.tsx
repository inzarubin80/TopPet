import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const YANDEX_METRIKA_SCRIPT_BASE = 'https://mc.yandex.ru/metrika/tag.js';

function hitOptions() {
  return {
    title: document.title,
    referer: document.referrer,
  };
}

export const YandexMetrika: React.FC = () => {
  const location = useLocation();
  const [scriptReady, setScriptReady] = useState(false);
  const initialized = useRef(false);

  const counterIdStr = process.env.REACT_APP_YANDEX_METRIKA_ID;
  const counterId = counterIdStr ? parseInt(counterIdStr, 10) : 0;
  const isEnabled = Number.isFinite(counterId) && counterId > 0;

  useEffect(() => {
    if (!isEnabled) {
      console.log('[YandexMetrika] отключена:', { counterIdStr });
      return;
    }
    if (initialized.current) return;
    initialized.current = true;

    console.log('[YandexMetrika] инициализация:', { counterId });

    const initMetrika = () => {
      console.log('[YandexMetrika] init:', { counterId });
      window.ym?.(counterId, 'init', {
        defer: true,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
        trackHash: true,
        triggerEvent: true,
      });
      setScriptReady(true);
      const url = window.location.href;
      console.log('[YandexMetrika] первый хит:', { url });
      window.ym?.(counterId, 'hit', url, hitOptions());
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
  }, [isEnabled, counterId, counterIdStr]);

  useEffect(() => {
    if (!isEnabled || !scriptReady || !window.ym) return;
    const url = window.location.href;
    console.log('[YandexMetrika] хит при смене маршрута:', { pathname: location.pathname, url });
    window.ym(counterId, 'hit', url, hitOptions());
  }, [isEnabled, counterId, scriptReady, location.pathname, location.search]);

  return null;
};
