import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { fetchContests, setFilters } from '../store/slices/contestsSlice';
import { ContestCard } from '../components/contest/ContestCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ContestStatus } from '../types/models';
import { buildLoginUrl } from '../utils/navigation';
import './HomePage.css';

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, total, loading, filters } = useSelector((state: RootState) => state.contests);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [statusFilter, setStatusFilter] = useState<ContestStatus | undefined>(undefined);

  useEffect(() => {
    dispatch(fetchContests({ status: statusFilter, limit: filters.limit, offset: filters.offset }));
  }, [dispatch, statusFilter, filters.limit, filters.offset]);

  const handleStatusFilter = (status: ContestStatus | undefined) => {
    setStatusFilter(status);
    dispatch(setFilters({ status, offset: 0 }));
  };

  const filterOptions = [
    { value: undefined, label: 'Все', status: 'all', icon: '☰' },
    { value: 'draft' as ContestStatus, label: 'Черновики', status: 'draft', icon: '📝' },
    { value: 'registration' as ContestStatus, label: 'Регистрация', status: 'registration', icon: '➕' },
    { value: 'voting' as ContestStatus, label: 'Голосование', status: 'voting', icon: '🗳️' },
    { value: 'finished' as ContestStatus, label: 'Завершенные', status: 'finished', icon: '✅' },
  ];

  return (
    <div className="home-page">
      <div className="home-page-header">
        <div className="home-page-filters" role="tablist" aria-label="Фильтр статусов конкурсов">
          {filterOptions.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.status}
                className={`filter-button filter-button-${option.status} ${isActive ? 'active' : ''}`}
                onClick={() => handleStatusFilter(option.value)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`filter-${option.status}`}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStatusFilter(option.value);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const currentIndex = filterOptions.findIndex((opt) => opt.status === option.status);
                    const nextIndex = e.key === 'ArrowLeft' 
                      ? (currentIndex - 1 + filterOptions.length) % filterOptions.length
                      : (currentIndex + 1) % filterOptions.length;
                    handleStatusFilter(filterOptions[nextIndex].value);
                  }
                }}
              >
                <span className="filter-button-icon">{option.icon}</span>
                <span className="filter-button-label">{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="home-page-list-actions">
          {isAuthenticated ? (
            <Button className="home-page-create-button" onClick={() => navigate('/create-contest')}>
              Создать конкурс
            </Button>
          ) : (
            <Button
              className="home-page-create-button"
              variant="primary"
              onClick={() => {
                const returnUrl = '/create-contest';
                navigate(buildLoginUrl(returnUrl));
              }}
            >
              Войти для создания конкурса
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="home-page-loading">
          <LoadingSpinner size="large" />
        </div>
      ) : (
        <>
          <div className="home-page-contests">
            {!items || items.length === 0 ? (
              <div className="home-page-empty">Нет конкурсов</div>
            ) : (
              items.map((contest) => <ContestCard key={contest.id} contest={contest} />)
            )}
          </div>
          {total > (items?.length || 0) && (
            <div className="home-page-pagination">
              <Button
                disabled={filters.offset === 0}
                onClick={() => dispatch(setFilters({ offset: Math.max(0, filters.offset - filters.limit) }))}
              >
                Назад
              </Button>
              <span>
                Показано {items?.length || 0} из {total}
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
