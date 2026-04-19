import React from 'react';
import { Link } from 'react-router-dom';
import './AppFooter.css';

export const AppFooter: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <nav className="app-footer__nav" aria-label="Юридическая информация">
          <Link to="/privacy" className="app-footer__link">
            Политика конфиденциальности
          </Link>
          <span className="app-footer__sep" aria-hidden>
            ·
          </span>
          <Link to="/terms" className="app-footer__link">
            Пользовательское соглашение
          </Link>
        </nav>
      </div>
    </footer>
  );
};
