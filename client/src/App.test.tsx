import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsentBanner } from './components/common/CookieConsentBanner';

beforeEach(() => {
  localStorage.removeItem('cookie_consent_v1');
});

test('shows cookie banner until accepted', async () => {
  render(
    <MemoryRouter>
      <CookieConsentBanner />
    </MemoryRouter>
  );

  expect(screen.getByRole('dialog', { name: /согласие на использование cookie/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /политикой обработки персональных данных/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /понятно/i }));

  expect(screen.queryByRole('dialog', { name: /согласие на использование cookie/i })).not.toBeInTheDocument();
  expect(localStorage.getItem('cookie_consent_v1')).toBe('accepted');
});
