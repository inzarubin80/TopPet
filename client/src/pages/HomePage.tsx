import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { fetchContests, setFilters } from '../store/slices/contestsSlice';
import { ContestCard } from '../components/contest/ContestCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SegmentMenu } from '../components/common/SegmentMenu';
import { ContestStatus } from '../types/models';
import { canCreateContests } from '../utils/contestPermissions';
import './HomePage.css';

const HomePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, total, loading, filters } = useSelector((state: RootState) => state.contests);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const showCreateContest = isAuthenticated && canCreateContests(user);
  type StatusFilterKey = 'all' | ContestStatus;
  const [statusFilter, setStatusFilter] = useState<ContestStatus | undefined>(undefined);

  useEffect(() => {
    dispatch(fetchContests({ status: statusFilter, limit: filters.limit, offset: filters.offset }));
  }, [dispatch, statusFilter, filters.limit, filters.offset]);

  const handleStatusFilter = (status: ContestStatus | undefined) => {
    setStatusFilter(status);
    dispatch(setFilters({ status, offset: 0 }));
  };

  const filterOptions: { key: StatusFilterKey; value: ContestStatus | undefined; label: string }[] = [
    { key: 'all', value: undefined, label: 'Все' },
    { key: 'draft', value: 'draft', label: 'Черновики' },
    { key: 'publication', value: 'publication', label: 'Публикация' },
    { key: 'registration', value: 'registration', label: 'Регистрация' },
    { key: 'voting', value: 'voting', label: 'Голосование' },
    { key: 'finished', value: 'finished', label: 'Завершенные' },
  ];
  const activeFilterKey: StatusFilterKey = statusFilter ?? 'all';
  const handleStatusFilterByKey = (key: StatusFilterKey) => {
    const option = filterOptions.find((candidate) => candidate.key === key);
    handleStatusFilter(option ? option.value : undefined);
  };

  return (
    <div className="home-page">
      <div className="home-page-header">
        <SegmentMenu
          variant="contest"
          className="home-page-filters"
          ariaLabel="Фильтр статусов конкурсов"
          items={filterOptions.map((option) => ({
            key: option.key,
            label: option.label,
          }))}
          activeKey={activeFilterKey}
          onChange={handleStatusFilterByKey}
        />
        {showCreateContest ? (
          <div className="home-page-list-actions">
            <Button className="home-page-create-button" onClick={() => navigate('/contests/new/edit')}>
              <span className="home-page-create-button-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Создать конкурс
              </span>
            </Button>
          </div>
        ) : null}
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
