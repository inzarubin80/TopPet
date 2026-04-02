import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { axiosClient } from '../api/axiosClient';
import './MockPayPage.css';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const MockPayPage: React.FC = () => {
  const q = useQuery();
  const navigate = useNavigate();
  const contestId = q.get('contestId') || '';
  const providerPaymentId = q.get('providerPaymentId') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAct = Boolean(contestId && providerPaymentId);

  const handle = async (action: 'complete' | 'cancel') => {
    if (!canAct) return;
    setLoading(true);
    setError(null);
    try {
      await axiosClient.post(`/billing/mock/${action}`, { provider_payment_id: providerPaymentId });
      if (action === 'complete') {
        navigate(`/contests/${contestId}?paid=1`, { replace: true });
      } else {
        navigate(`/contests/${contestId}`, { replace: true });
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось выполнить операцию');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mockpay-page">
      <div className="mockpay-card">
        <h1>Оплата Pro (тестовый режим)</h1>
        <p className="mockpay-muted">
          Это страница-имитация платёжного провайдера. Нажмите «Оплатить», чтобы перевести конкурс в Pro и вернуться
          обратно.
        </p>

        {!canAct ? (
          <div className="mockpay-error">Некорректная ссылка: не хватает параметров.</div>
        ) : null}

        {error ? <div className="mockpay-error">{error}</div> : null}

        <div className="mockpay-actions">
          <Button variant="secondary" disabled={!canAct || loading} onClick={() => handle('cancel')}>
            Отменить
          </Button>
          <Button disabled={!canAct || loading} onClick={() => handle('complete')}>
            {loading ? '…' : 'Оплатить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MockPayPage;

