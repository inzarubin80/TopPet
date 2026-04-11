import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contest } from '../../types/models';
import { resolvePublicAssetUrl } from '../../utils/seo';
import { getContestScheduleDisplayLines } from '../../utils/scheduleTimezone';
import { ContestRulesViewer } from './ContestRulesViewer';
import './ContestCard.css';

interface ContestCardProps {
  contest: Contest;
}

export const ContestCard: React.FC<ContestCardProps> = ({ contest }) => {
  const navigate = useNavigate();

  const accentHex = (contest.theme_color || '').trim();
  const hasThemedAccent = /^#[0-9A-Fa-f]{6}$/.test(accentHex);
  const coverRaw = (contest.cover_url || '').trim();
  const logoRaw = (contest.logo_url || '').trim();
  const taglineRaw = (contest.tagline || '').trim();
  const participantDomains = (contest.participant_allowed_email_domains ?? []).filter(Boolean);

  const cardStyle = useMemo(
    () =>
      hasThemedAccent
        ? ({ '--contest-card-accent': accentHex } as React.CSSProperties)
        : undefined,
    [hasThemedAccent, accentHex]
  );

  const scheduleSummary = useMemo(() => {
    const lines = getContestScheduleDisplayLines(contest);
    if (lines.length === 0) return null;
    return lines.slice(0, 2).join(' · ');
  }, [contest]);

  const prizeRaw = (contest.prize_text || '').trim();
  const sponsorName = (contest.sponsor_name || '').trim();
  const sponsorLogoRaw = (contest.sponsor_logo_url || '').trim();
  const sponsorUrl = (contest.sponsor_url || '').trim();
  const ctaMoreLabel = (contest.cta_label_override || '').trim() || 'Подробнее';

  const goToContest = () => navigate(`/contests/${contest.id}`);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Черновик';
      case 'publication':
        return 'Публикация';
      case 'registration':
        return 'Регистрация';
      case 'voting':
        return 'Голосование';
      case 'finished':
        return 'Завершен';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    return `status-${status}`;
  };

  return (
    <div
      className={`contest-card${hasThemedAccent ? ' contest-card--themed' : ''}${coverRaw ? ' contest-card--has-cover' : ''}`}
      style={cardStyle}
      onClick={goToContest}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToContest();
        }
      }}
    >
      {coverRaw ? (
        <div className="contest-card-cover">
          <img src={resolvePublicAssetUrl(coverRaw)} alt="" />
        </div>
      ) : null}
      <div className="contest-card-inner">
        <div className="contest-card-header">
          <div className="contest-card-title-block">
            <div className="contest-card-title-row">
              {logoRaw ? (
                <img
                  className="contest-card-logo"
                  src={resolvePublicAssetUrl(logoRaw)}
                  alt=""
                />
              ) : null}
              <h3 className="contest-card-title">{contest.title}</h3>
            </div>
            {taglineRaw ? <p className="contest-card-tagline">{taglineRaw}</p> : null}
            {participantDomains.length > 0 ? (
              <p className="contest-card-domain-hint" title={participantDomains.join(', ')}>
                Участие: e-mail на {participantDomains.length === 1 ? `домене ${participantDomains[0]}` : 'указанных доменах'}
              </p>
            ) : null}
          </div>
          <span className={`contest-card-status ${getStatusClass(contest.status)}`}>
            {getStatusLabel(contest.status)}
          </span>
        </div>
        <p className="contest-card-description">{contest.description || 'Нет описания'}</p>
        {scheduleSummary ? (
          <p className="contest-card-schedule" title={scheduleSummary}>
            {scheduleSummary}
          </p>
        ) : null}
        {prizeRaw ? <p className="contest-card-prize">{prizeRaw}</p> : null}
        {sponsorName || sponsorLogoRaw ? (
          <div className="contest-card-sponsor">
            {sponsorLogoRaw ? (
              <img
                className="contest-card-sponsor-logo"
                src={resolvePublicAssetUrl(sponsorLogoRaw)}
                alt=""
              />
            ) : null}
            {sponsorUrl ? (
              <a
                className="contest-card-sponsor-link"
                href={sponsorUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {sponsorName || 'Спонсор'}
              </a>
            ) : (
              <span className="contest-card-sponsor-name">{sponsorName}</span>
            )}
          </div>
        ) : null}
        <div className="contest-card-footer">
          {(contest.rules_text ?? '').trim() ? (
            <div className="contest-card-footer-left">
              <ContestRulesViewer
                rulesText={contest.rules_text}
                contestTitle={contest.title}
                stopPropagation
                triggerClassName="contest-card-rules-btn"
              />
            </div>
          ) : null}
          <div className="contest-card-footer-right">
            <button
              type="button"
              className="contest-card-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                goToContest();
              }}
            >
              {ctaMoreLabel}
            </button>
            <span className="contest-card-votes">Голосов: {contest.total_votes || 0}</span>
            <span className="contest-card-date">
              Создан {new Date(contest.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
