import React, { useRef } from 'react';
import { Button } from '../common/Button';
import { resolvePublicAssetUrl } from '../../utils/seo';

export interface ContestAssetImageFieldProps {
  legend: string;
  /** URL с сервера после загрузки — только для превью, вводить ссылку вручную нельзя. */
  url: string;
  onPickFile: (file: File) => void;
  /** Сбросить изображение (очистит поле до сохранения формы). */
  onClear?: () => void;
  uploading?: boolean;
  disabled?: boolean;
}

export const ContestAssetImageField: React.FC<ContestAssetImageFieldProps> = ({
  legend,
  url,
  onPickFile,
  onClear,
  uploading = false,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trimmed = url.trim();
  const previewSrc = trimmed ? resolvePublicAssetUrl(trimmed) : '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onPickFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="edit-contest-asset-field">
      <span className="edit-contest-asset-legend">{legend}</span>
      {previewSrc ? (
        <div className="edit-contest-asset-preview-wrap">
          <img className="edit-contest-asset-preview" src={previewSrc} alt="" />
        </div>
      ) : (
        <p className="edit-contest-asset-preview-placeholder">Нет изображения</p>
      )}
      <div className="edit-contest-asset-actions">
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Загрузка…' : 'Выбрать файл'}
        </Button>
        {trimmed && onClear ? (
          <Button
            type="button"
            variant="secondary"
            size="small"
            disabled={disabled || uploading}
            onClick={onClear}
          >
            Убрать
          </Button>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="edit-contest-asset-file-input"
        aria-hidden
        tabIndex={-1}
        onChange={handleFileChange}
      />
    </div>
  );
};
