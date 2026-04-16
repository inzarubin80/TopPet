import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { emitCookieConsentAccepted, hasCookieConsent, setCookieConsentAccepted } from '../../utils/cookieConsent';
import './CookieConsentBanner.css';

export const CookieConsentBanner: React.FC = () => {
  const initialHidden = useMemo(() => hasCookieConsent(), []);
  const [isHidden, setIsHidden] = useState<boolean>(initialHidden);

  if (isHidden) {
    return null;
  }

  const accept = () => {
    setCookieConsentAccepted();
    emitCookieConsentAccepted();
    setIsHidden(true);
  };

  return (
    <div className="cookie-consent" role="dialog" aria-label="Согласие на использование cookie" aria-live="polite">
      <div className="cookie-consent__inner">
        <div className="cookie-consent__text">
          Мы используем файлы cookie для корректной работы сайта и аналитики. Продолжая пользоваться сайтом, вы соглашаетесь с
          использованием cookie и{' '}
          <Link to="/privacy" className="cookie-consent__link">
            политикой обработки персональных данных
          </Link>
          .
        </div>
        <div className="cookie-consent__actions">
          <Button variant="primary" size="small" onClick={accept}>
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
};

