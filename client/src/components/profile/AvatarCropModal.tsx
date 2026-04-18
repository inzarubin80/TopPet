import React, { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { getCroppedImageBlob } from '../../utils/cropImage';
import './AvatarCropModal.css';

const OUTPUT_SIZE = 512;

type AvatarCropModalProps = {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onApply: (blob: Blob) => Promise<void>;
};

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onApply,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) {
      setError('Подождите загрузки изображения');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, OUTPUT_SIZE, 'image/jpeg', 0.92);
      await onApply(blob);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось обработать фото');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Выберите область лица"
      className="avatar-crop-modal-overlay"
      footer={
        <div className="avatar-crop-modal-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button type="button" onClick={handleApply} disabled={busy || !croppedAreaPixels}>
            {busy ? <LoadingSpinner size="small" /> : 'Сохранить'}
          </Button>
        </div>
      }
    >
      <div className="avatar-crop-modal-body">
        <p className="avatar-crop-modal-hint">Перемещайте и масштабируйте фото, чтобы лицо было в круге.</p>
        <div className="avatar-crop-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <label className="avatar-crop-zoom-label">
          Масштаб
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="avatar-crop-zoom"
            disabled={busy}
          />
        </label>
        {error && <div className="avatar-crop-error">{error}</div>}
      </div>
    </Modal>
  );
};
