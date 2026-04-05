import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contest } from '../../types/models';
import { resolvePublicAssetUrl } from '../../utils/seo';
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
      onClick={() => navigate(`/contests/${contest.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/contests/${contest.id}`);
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
            <span className="contest-card-votes">
              Голосов: {contest.total_votes || 0}
            </span>
            <span className="contest-card-date">
              Создан {new Date(contest.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
