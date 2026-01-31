import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const YANDEX_METRIKA_SCRIPT = 'https://mc.yandex.ru/metrika/tag.js';

export const YandexMetrika: React.FC = () => {
  const location = useLocation();
  const [scriptReady, setScriptReady] = useState(false);

  const counterIdStr = process.env.REACT_APP_YANDEX_METRIKA_ID;
  const counterId = counterIdStr ? parseInt(counterIdStr, 10) : 0;
  const isEnabled = Number.isFinite(counterId) && counterId > 0;

  useEffect(() => {
    if (!isEnabled) return;

    const initMetrika = () => {
      window.ym?.(counterId, 'init', {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
      setScriptReady(true);
      // Первый хит — сразу после init, в следующем тике, чтобы скрипт Метрики успел обработать init
      setTimeout(() => {
        window.ym?.(counterId, 'hit', window.location.href);
      }, 0);
    };

    if (window.ym) {
      initMetrika();
    } else {
      const script = document.createElement('script');
      script.async = true;
      script.src = YANDEX_METRIKA_SCRIPT;
      script.onload = initMetrika;
      document.head.appendChild(script);
    }
  }, [isEnabled, counterId]);

  useEffect(() => {
    if (!isEnabled || !scriptReady || !window.ym) return;
    window.ym(counterId, 'hit', window.location.href);
  }, [isEnabled, counterId, scriptReady, location.pathname, location.search]);

  return null;
};
