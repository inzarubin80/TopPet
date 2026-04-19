import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import type { Contest, ContestWinnerBrief, Nomination, Participant } from '../../types/models';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { NominationTabsBar } from '../common/NominationTabsBar';
import { resolvePublicAssetUrl } from '../../utils/seo';
import { participantAuthorDisplayName } from '../../utils/participantDisplay';
import './ParticipantCard.css';
import {
  buildAudienceByParticipantId,
  groupWinnersByNomination,
  labelForNominationKey,
  nominationKeysWithWinners,
  orderNominationKeysForTabs,
  participantDisplayName,
  sortWinnersBySnapshotPlace,
  voteCountForParticipant,
} from '../../utils/contestWinnersSectionData';
import './ContestWinnersSection.css';

/** Первое фото работы (по position), thumb при наличии. */
function participantCoverRaw(p: Participant | undefined): string | undefined {
  if (!p?.photos?.length) {
    return undefined;
  }
  const sorted = [...p.photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const ph = sorted[0];
  const raw = (ph.thumb_url || ph.url || '').trim();
  return raw || undefined;
}

function podiumPetLabel(p: Participant | undefined, w: ContestWinnerBrief): string {
  const pet = (p?.pet_name || w.pet_name || '').trim();
  if (pet) {
    return pet;
  }
  return participantDisplayName(p, w);
}

/** Как в галерее: название работы или кличка. */
function participantWorkTitle(p: Participant | undefined, w: ContestWinnerBrief): string {
  if (p) {
    const t = (p.entry_title || '').trim();
    if (t) {
      return t;
    }
    return (p.pet_name || '').trim() || 'Участник';
  }
  return (w.entry_title || w.pet_name || '').trim() || 'Участник';
}

/** Единая палитра для всех мест: белый круг без обводки. */
const PODIUM_MEDAL_STYLE = {
  fill: '#ffffff',
  num: '#1e293b',
} as const;

/** Круг с номером места поверх фото (левый верх — в CSS). */
function PodiumMedalSvg({ place }: { place: number }) {
  return (
    <svg
      className="contest-winners-podium-medal-svg"
      viewBox="0 0 48 48"
      width="44"
      height="44"
      aria-hidden
    >
      <circle cx="24" cy="24" r="20" fill={PODIUM_MEDAL_STYLE.fill} />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fill={PODIUM_MEDAL_STYLE.num}
        fontSize="20"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        {place}
      </text>
    </svg>
  );
}

type WinnerGalleryCardProps = {
  contestId: string;
  participant: Participant | undefined;
  participantId: string;
  workTitle: string;
  petLabel: string;
  coverSrc: string | undefined;
  /** 1–3 — показать медаль с этим номером */
  medalPlace: number | null;
  authorLabel: string;
  votesDisplay: number | null;
  juryMetaDisplay: number | null;
};

function WinnerGalleryCard({
  contestId,
  participant,
  participantId,
  workTitle,
  petLabel,
  coverSrc,
  medalPlace,
  authorLabel,
  votesDisplay,
  juryMetaDisplay,
}: WinnerGalleryCardProps) {
  const showMedal = medalPlace !== null && medalPlace >= 1 && medalPlace <= 3;

  return (
    <Link
      className="participant-card contest-winners-podium-card"
      to={`/contests/${contestId}/participants/${participantId}`}
    >
      <div className="participant-card-image-wrap">
        <div className="participant-card-image">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={workTitle}
              className="participant-card-single-image"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="participant-card-placeholder">Нет фото</div>
          )}
          {showMedal && medalPlace !== null ? (
            <div className="contest-winners-podium-medal-overlay" aria-hidden>
              <PodiumMedalSvg place={medalPlace} />
            </div>
          ) : null}
        </div>
        <div className="participant-card-summary">
          <h4 className="participant-card-name">{workTitle}</h4>
          <div className="participant-card-meta-row contest-winners-podium-meta">
            <span className="participant-card-author">{petLabel}</span>
            {authorLabel ? (
              <>
                <span className="participant-card-dot" aria-hidden>
                  •
                </span>
                <span className="participant-card-author">{authorLabel}</span>
              </>
            ) : null}
            <span className="participant-card-dot" aria-hidden>
              •
            </span>
            <span className="participant-card-comments">💬 {participant?.comment_count ?? 0}</span>
            {votesDisplay !== null ? (
              <>
                <span className="participant-card-dot" aria-hidden>
                  •
                </span>
                <span className="participant-card-comments">
                  ❤️ {votesDisplay.toLocaleString('ru-RU')}
                </span>
              </>
            ) : null}
            {juryMetaDisplay !== null ? (
              <>
                <span className="participant-card-dot" aria-hidden>
                  •
                </span>
                <span className="participant-card-comments">Жюри {juryMetaDisplay}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function resolveCoverSrc(p: Participant | undefined): string | undefined {
  if (!p?.photos?.length) {
    const alt = participantCoverRaw(p);
    return alt ? resolvePublicAssetUrl(alt) : undefined;
  }
  const first = p.photos[0];
  const raw = (first.thumb_url || first.url || '').trim();
  if (raw) {
    return resolvePublicAssetUrl(raw);
  }
  const alt = participantCoverRaw(p);
  return alt ? resolvePublicAssetUrl(alt) : undefined;
}

function authorLabelFor(p: Participant | undefined, currentUserId: number | undefined): string {
  if (!p) {
    return '';
  }
  const isOwner = currentUserId !== undefined && currentUserId === p.user_id;
  return participantAuthorDisplayName(p, { isOwner });
}

export interface ContestWinnersSectionProps {
  contest: Contest;
  nominations: Nomination[];
  nominationTitleById: Record<string, string>;
  participants: Participant[];
  participantsLoading: boolean;
}

export const ContestWinnersSection: React.FC<ContestWinnersSectionProps> = ({
  contest,
  nominations,
  nominationTitleById,
  participants,
  participantsLoading,
}) => {
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);

  const participantById = useMemo(() => {
    const m = new Map<string, Participant>();
    for (const p of participants) {
      m.set(p.id, p);
    }
    return m;
  }, [participants]);

  const jury = useMemo(() => contest.jury_winners ?? [], [contest.jury_winners]);
  const audience = useMemo(() => contest.audience_winners ?? [], [contest.audience_winners]);

  const juryByNom = useMemo(() => groupWinnersByNomination(jury), [jury]);
  const audienceByNom = useMemo(() => groupWinnersByNomination(audience), [audience]);
  const audienceByPid = useMemo(() => buildAudienceByParticipantId(audience), [audience]);

  const tabKeys = useMemo(() => {
    const raw = nominationKeysWithWinners(jury, audience);
    return orderNominationKeysForTabs(raw, nominations, nominationTitleById);
  }, [jury, audience, nominations, nominationTitleById]);

  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (tabKeys.length === 0) {
      setActiveKey(null);
      return;
    }
    setActiveKey((prev) => {
      if (prev !== null && tabKeys.includes(prev)) {
        return prev;
      }
      return tabKeys[0];
    });
  }, [tabKeys]);

  if (contest.status !== 'finished') {
    return (
      <div className="contest-winners-section contest-winners-section--message">
        <p className="contest-winners-section__lead">
          Итоги и призовые места появятся здесь после завершения конкурса.
        </p>
      </div>
    );
  }

  const hasAnyWinnerData = jury.length > 0 || audience.length > 0;

  if (!hasAnyWinnerData) {
    return (
      <div className="contest-winners-section contest-winners-section--message">
        <p className="contest-winners-section__lead">
          Победители будут объявлены позже. Обновите страницу, если итоги уже подсчитаны на сервере.
        </p>
      </div>
    );
  }

  const activeNomKey = activeKey ?? tabKeys[0] ?? null;
  const juryList = activeNomKey !== null ? juryByNom.get(activeNomKey) ?? [] : [];
  const audienceList = activeNomKey !== null ? audienceByNom.get(activeNomKey) ?? [] : [];

  const jurySorted = sortWinnersBySnapshotPlace(juryList);
  const audienceSorted = sortWinnersBySnapshotPlace(audienceList).filter((w) => {
    const p = participantById.get(w.participant_id);
    return !p || p.submission_status === 'accepted';
  });

  const showNominationTabs = tabKeys.length > 1;

  const showJuryBlock =
    activeNomKey !== null && contest.jury_voting_enabled && jurySorted.length > 0;

  const showPopularBlock = audienceSorted.length > 0;

  return (
    <div className="contest-winners-section">
      {showNominationTabs ? (
        <div className="contest-winners-section__nomination-tabs-wrap">
          <NominationTabsBar
            tabs={tabKeys.map((key) => ({
              id: key,
              label: labelForNominationKey(key, nominationTitleById),
            }))}
            selectedId={activeNomKey ?? ''}
            onSelect={(id) => setActiveKey(id)}
            ariaLabel="Номинации"
          />
        </div>
      ) : null}

      {showJuryBlock ? (
        <section className="contest-winners-section__subsection" aria-label="Голосование жюри">
          <h3 className="contest-winners-section__block-heading">Голосование жюри</h3>
          <div className="contest-winners-section__podium-grid">
            {jurySorted.map((w) => {
              const p = participantById.get(w.participant_id);
              const place = w.place ?? 0;
              const medalPlace = place >= 1 && place <= 3 ? place : null;
              const votes = voteCountForParticipant(w.participant_id, p, audienceByPid);
              return (
                <WinnerGalleryCard
                  key={w.participant_id}
                  contestId={contest.id}
                  participant={p}
                  participantId={w.participant_id}
                  workTitle={participantWorkTitle(p, w)}
                  petLabel={podiumPetLabel(p, w)}
                  coverSrc={resolveCoverSrc(p)}
                  medalPlace={medalPlace}
                  authorLabel={authorLabelFor(p, currentUserId)}
                  votesDisplay={votes}
                  juryMetaDisplay={w.score}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {showPopularBlock ? (
        <section className="contest-winners-section__subsection" aria-label="Народное голосование">
          <h3 className="contest-winners-section__block-heading">Народное голосование</h3>
          <div className="contest-winners-section__podium-grid">
            {audienceSorted.map((w) => {
              const p = participantById.get(w.participant_id);
              const place = w.place ?? 0;
              const medalPlace = place >= 1 && place <= 3 ? place : null;
              const votesDisplay = contest.public_voting_enabled ? w.score : null;
              const juryM =
                p?.total_jury_score !== undefined && p?.total_jury_score !== null
                  ? p.total_jury_score
                  : null;
              return (
                <WinnerGalleryCard
                  key={`aud-${w.participant_id}`}
                  contestId={contest.id}
                  participant={p}
                  participantId={w.participant_id}
                  workTitle={participantWorkTitle(p, w)}
                  petLabel={podiumPetLabel(p, w)}
                  coverSrc={resolveCoverSrc(p)}
                  medalPlace={medalPlace}
                  authorLabel={authorLabelFor(p, currentUserId)}
                  votesDisplay={votesDisplay}
                  juryMetaDisplay={juryM}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {participantsLoading ? (
        <div className="contest-winners-section__inline-loading" aria-hidden>
          <LoadingSpinner size="small" />
        </div>
      ) : null}
    </div>
  );
};
