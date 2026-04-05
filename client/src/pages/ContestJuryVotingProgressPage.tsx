import React, { useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchContest } from '../store/slices/contestsSlice';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ContestJuryVotingProgressReport } from '../components/contest/ContestJuryVotingProgressReport';
import { useContestPermissions } from '../hooks/useContestPermissions';
import './ContestJuryVotingProgressPage.css';

const ContestJuryVotingProgressPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { currentContest, loading } = useSelector((state: RootState) => state.contests);
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const { isAdmin } = useContestPermissions(currentContest, currentUser);

  useEffect(() => {
    if (id) {
      dispatch(fetchContest(id));
    }
  }, [dispatch, id]);

  if (!id) {
    return <Navigate to="/" replace />;
  }

  if (loading && (!currentContest || currentContest.id !== id)) {
    return (
      <div className="contest-jury-voting-progress-page contest-jury-voting-progress-page--centered">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!currentContest || currentContest.id !== id) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin || !currentContest.jury_voting_enabled) {
    return <Navigate to={`/contests/${id}`} replace />;
  }

  return (
    <div className="contest-jury-voting-progress-page">
      <nav className="contest-jury-voting-progress-nav" aria-label="Навигация">
        <Link to={`/contests/${id}`} className="contest-jury-voting-progress-back">
          ← К конкурсу
        </Link>
      </nav>
      <header className="contest-jury-voting-progress-header">
        <h1 className="contest-jury-voting-progress-title">Контроль оценок жюри</h1>
        <p className="contest-jury-voting-progress-contest">{currentContest.title}</p>
      </header>
      <ContestJuryVotingProgressReport contestId={id} />
    </div>
  );
};

export default ContestJuryVotingProgressPage;
