import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from '../../utils/logger';

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const YANDEX_METRIKA_SCRIPT_BASE = 'https://mc.yandex.ru/metrika/tag.js';
const LOG_PREFIX = '[YandexMetrika]';

export const YandexMetrika: React.FC = () => {
  const location = useLocation();
  const [scriptReady, setScriptReady] = useState(false);

  const counterIdStr = process.env.REACT_APP_YANDEX_METRIKA_ID;
  const counterId = counterIdStr ? parseInt(counterIdStr, 10) : 0;
  const isEnabled = Number.isFinite(counterId) && counterId > 0;

  useEffect(() => {
    if (!isEnabled) {
      logger.debug(`${LOG_PREFIX} отключена: REACT_APP_YANDEX_METRIKA_ID не задан или невалиден`, { counterIdStr });
      return;
    }

    logger.info(`${LOG_PREFIX} инициализация счётчика`, { counterId });

    const initMetrika = () => {
      logger.info(`${LOG_PREFIX} вызов ym(${counterId}, 'init', ...)`);
      window.ym?.(counterId, 'init', {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
      setScriptReady(true);
      setTimeout(() => {
        const url = window.location.href;
        logger.info(`${LOG_PREFIX} первый хит`, { url });
        window.ym?.(counterId, 'hit', url);
      }, 150);
    };

    if (window.ym) {
      logger.debug(`${LOG_PREFIX} window.ym уже есть, вызываем init`);
      initMetrika();
    } else {
      const scriptUrl = `${YANDEX_METRIKA_SCRIPT_BASE}?id=${counterId}`;
      logger.info(`${LOG_PREFIX} загрузка скрипта`, { scriptUrl });
      const script = document.createElement('script');
      script.async = true;
      script.src = scriptUrl;
      script.onload = () => {
        logger.info(`${LOG_PREFIX} скрипт загружен, вызываем init`);
        initMetrika();
      };
      script.onerror = () => {
        logger.error(`${LOG_PREFIX} ошибка загрузки скрипта`, scriptUrl);
      };
      document.head.appendChild(script);
    }
  }, [isEnabled, counterId]);

  useEffect(() => {
    if (!isEnabled || !scriptReady || !window.ym) return;
    const url = window.location.href;
    logger.info(`${LOG_PREFIX} хит при смене маршрута`, { pathname: location.pathname, url });
    window.ym(counterId, 'hit', url);
  }, [isEnabled, counterId, scriptReady, location.pathname, location.search]);

  return null;
};
