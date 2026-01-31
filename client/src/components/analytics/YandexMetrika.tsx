import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ym, { YMInitializer } from 'react-yandex-metrika';

const METRIKA_OPTIONS = {
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true,
  trackHash: true,
  triggerEvent: true,
};

function hitOptions() {
  return {
    title: document.title,
    referer: document.referrer,
  };
}

const YandexMetrikaRouteTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    ym('hit', window.location.href, hitOptions());
  }, [location.pathname, location.search]);

  return null;
};

export const YandexMetrika: React.FC = () => {
  const counterIdStr = process.env.REACT_APP_YANDEX_METRIKA_ID;
  const counterId = counterIdStr ? parseInt(counterIdStr, 10) : 0;
  const isEnabled = Number.isFinite(counterId) && counterId > 0;

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <YMInitializer accounts={[counterId]} options={METRIKA_OPTIONS} />
      <YandexMetrikaRouteTracker />
    </>
  );
};
