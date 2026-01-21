import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { fetchContests, setFilters } from '../store/slices/contestsSlice';
import { ContestCard } from '../components/contest/ContestCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ContestStatus } from '../types/models';
import './HomePage.css';

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, total, loading, filters } = useSelector((state: RootState) => state.contests);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [statusFilter, setStatusFilter] = useState<ContestStatus | undefined>(undefined);

  useEffect(() => {
    dispatch(fetchContests({ status: statusFilter, limit: filters.limit, offset: filters.offset }));
  }, [dispatch, statusFilter, filters.limit, filters.offset]);

  const handleStatusFilter = (status: ContestStatus | undefined) => {
    setStatusFilter(status);
    dispatch(setFilters({ status, offset: 0 }));
  };

  return (
    <div className="home-page">
      <div className="home-page-header">
        <h1>Конкурсы красоты животных</h1>
        {isAuthenticated && (
          <Button onClick={() => navigate('/create-contest')}>Создать конкурс</Button>
        )}
      </div>

      <div className="home-page-filters">
        <button
          className={`filter-button ${statusFilter === undefined ? 'active' : ''}`}
          onClick={() => handleStatusFilter(undefined)}
        >
          Все
        </button>
        <button
          className={`filter-button ${statusFilter === 'draft' ? 'active' : ''}`}
          onClick={() => handleStatusFilter('draft')}
        >
          Черновики
        </button>
        <button
          className={`filter-button ${statusFilter === 'published' ? 'active' : ''}`}
          onClick={() => handleStatusFilter('published')}
        >
          Опубликованные
        </button>
        <button
          className={`filter-button ${statusFilter === 'finished' ? 'active' : ''}`}
          onClick={() => handleStatusFilter('finished')}
        >
          Завершенные
        </button>
      </div>

      {loading ? (
        <div className="home-page-loading">
          <LoadingSpinner size="large" />
        </div>
      ) : (
        <>
          <div className="home-page-contests">
            {items.length === 0 ? (
              <div className="home-page-empty">Нет конкурсов</div>
            ) : (
              items.map((contest) => <ContestCard key={contest.id} contest={contest} />)
            )}
          </div>
          {total > items.length && (
            <div className="home-page-pagination">
              <Button
                disabled={filters.offset === 0}
                onClick={() => dispatch(setFilters({ offset: Math.max(0, filters.offset - filters.limit) }))}
              >
                Назад
              </Button>
              <span>
                Показано {items.length} из {total}
              </span>
              <Button
                disabled={filters.offset + filters.limit >= total}
                onClick={() => dispatch(setFilters({ offset: filters.offset + filters.limit }))}
              >
                Вперед
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HomePage;
