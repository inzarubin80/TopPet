import React from 'react';
import { Link } from 'react-router-dom';
import type { ContestWinnerBrief } from '../../types/models';
import {
  formatJuryPointsWord,
  formatVotesWord,
  splitContestWinnerLines,
  winnerInitialsFromName,
} from '../../utils/contestWinnersDisplay';
import './ContestWinnersSection.css';

type Props = {
  contestId: string;
  audienceWinners?: ContestWinnerBrief[];
  juryWinners?: ContestWinnerBrief[];
};

function AudienceIcon() {
  return (
    <svg className="contest-winners-category-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function JuryIcon() {
  return (
    <svg className="contest-winners-category-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l2.95 8.5L24 9.5l-7.5 5.5L19 24l-7-5.25L5 24l2.5-9L0 9.5l9.05.5L12 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WinnerRow({
  contestId,
  w,
  metricKind,
}: {
  contestId: string;
  w: ContestWinnerBrief;
  metricKind: 'audience' | 'jury';
}) {
  const { name, nomination } = splitContestWinnerLines(w);
  const initial = winnerInitialsFromName(name);
  const score = w.score;
  const unit = metricKind === 'audience' ? formatVotesWord(Number(score)) : formatJuryPointsWord(Number(score));
  const ariaMetric =
    metricKind === 'audience'
      ? `${score} ${unit} зрителей`
      : `${score} ${unit} жюри (сумма)`;

  return (
    <li>
      <article className="contest-winners-card">
        <div className="contest-winners-card-avatar" aria-hidden>
          {initial}
        </div>
        <div className="contest-winners-card-text">
          <Link
            className="contest-winners-card-name"
            to={`/contests/${contestId}/participants/${w.participant_id}`}
          >
            {name}
          </Link>
          {nomination ? <p className="contest-winners-card-nomination">{nomination}</p> : null}
        </div>
        <div className="contest-winners-metric-badge" aria-label={ariaMetric}>
          <span className="contest-winners-metric-value">{score}</span>
          <span className="contest-winners-metric-unit">{unit}</span>
        </div>
      </article>
    </li>
  );
}

export function ContestWinnersSection({ contestId, audienceWinners, juryWinners }: Props) {
  const hasAudience = (audienceWinners?.length ?? 0) > 0;
  const hasJury = (juryWinners?.length ?? 0) > 0;
  if (!hasAudience && !hasJury) {
    return null;
  }

  const gridTwo = hasAudience && hasJury;

  return (
    <section className="contest-winners-section" aria-labelledby="contest-winners-heading">
      <h2 id="contest-winners-heading" className="contest-winners-section-title">
        Победители
      </h2>
      <div className={gridTwo ? 'contest-winners-grid contest-winners-grid--two' : 'contest-winners-grid'}>
        {hasAudience ? (
          <div className="contest-winners-category">
            <div className="contest-winners-category-head">
              <AudienceIcon />
              <div>
                <h3 className="contest-winners-category-title">По голосам зрителей</h3>
                <p className="contest-winners-category-hint">Больше всего голосов среди принятых работ в номинации</p>
              </div>
            </div>
            <ul className="contest-winners-cards">
              {audienceWinners!.map((w) => (
                <WinnerRow key={`a-${w.participant_id}`} contestId={contestId} w={w} metricKind="audience" />
              ))}
            </ul>
          </div>
        ) : null}
        {hasJury ? (
          <div className="contest-winners-category">
            <div className="contest-winners-category-head">
              <JuryIcon />
              <div>
                <h3 className="contest-winners-category-title">По сумме баллов жюри</h3>
                <p className="contest-winners-category-hint">
                  Сумма всех выставленных баллов по критериям (все члены жюри)
                </p>
              </div>
            </div>
            <ul className="contest-winners-cards">
              {juryWinners!.map((w) => (
                <WinnerRow key={`j-${w.participant_id}`} contestId={contestId} w={w} metricKind="jury" />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
