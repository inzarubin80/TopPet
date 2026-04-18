import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { resolvePublicAssetUrl } from '../../utils/seo';

export type JuryParticipantWorkCellProps = {
  contestId: string;
  participantId: string;
  title: string;
  subLine: React.ReactNode;
  /** Превью в таблице (thumb или любой URL) */
  coverUrlRaw?: string | null;
  /** Полный кадр в модалке; если нет — используется превью */
  lightboxUrlRaw?: string | null;
};

/**
 * Превью работы (клик — увеличение фото), название — ссылка на страницу участника.
 */
export const JuryParticipantWorkCell: React.FC<JuryParticipantWorkCellProps> = ({
  contestId,
  participantId,
  title,
  subLine,
  coverUrlRaw,
  lightboxUrlRaw,
}) => {
  const href = `/contests/${contestId}/participants/${participantId}`;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const trimmedCover = coverUrlRaw?.trim();
  const imgSrc = trimmedCover ? resolvePublicAssetUrl(trimmedCover) : undefined;

  const lightboxResolved = useMemo(() => {
    const raw = (lightboxUrlRaw?.trim() || trimmedCover)?.trim();
    return raw ? resolvePublicAssetUrl(raw) : undefined;
  }, [lightboxUrlRaw, trimmedCover]);

  return (
    <div className="contest-jury-voting-work-cell">
      {imgSrc ? (
        <button
          type="button"
          className="contest-jury-voting-work-thumb-link"
          onClick={() => setLightboxOpen(true)}
          title="Показать фото"
          aria-label={`Показать фото: ${title}`}
        >
          <img src={imgSrc} alt="" className="contest-jury-voting-work-thumb" />
        </button>
      ) : (
        <span
          className="contest-jury-voting-work-thumb-link contest-jury-voting-work-thumb-link--empty"
          aria-hidden
        >
          <span className="contest-jury-voting-work-thumb-placeholder">Нет фото</span>
        </span>
      )}

      <div className="contest-jury-voting-work-text">
        <Link
          to={href}
          target="_blank"
          rel="noopener noreferrer"
          className="contest-jury-voting-work-title"
        >
          {title}
        </Link>
        <span className="contest-jury-voting-work-sub">{subLine}</span>
      </div>

      {lightboxResolved ? (
        <Modal
          className="contest-jury-work-lightbox-modal"
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          closeOnlyHeader
          showHeaderDivider={false}
          closeOnBackdropClick
        >
          <div className="contest-jury-work-lightbox-body">
            <img src={lightboxResolved} alt="" className="contest-jury-work-lightbox-img" />
          </div>
        </Modal>
      ) : null}
    </div>
  );
};
