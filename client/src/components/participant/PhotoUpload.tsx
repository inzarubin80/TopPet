import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { uploadPhoto } from '../../store/slices/participantsSlice';
import { FileUpload } from '../common/FileUpload';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { ParticipantID } from '../../types/models';
import './PhotoUpload.css';

interface PhotoUploadProps {
  participantId: ParticipantID;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ participantId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('Размер файла не должен превышать 10MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const result = await dispatch(uploadPhoto({ participantId, file }));
      if (uploadPhoto.rejected.match(result)) {
        setError(result.payload as string || 'Не удалось загрузить фото');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="photo-upload">
      <div className="photo-upload-header">
        <h3>Загрузить фото</h3>
        {uploading && <LoadingSpinner size="small" />}
      </div>
      <FileUpload
        accept="image/*"
        onFileSelect={handleFileSelect}
        disabled={uploading}
        label={uploading ? 'Загрузка...' : 'Выбрать фото'}
      />
      {error && <ErrorMessage message={error} />}
      <p className="photo-upload-hint">Можно загрузить несколько фотографий</p>
    </div>
  );
};
