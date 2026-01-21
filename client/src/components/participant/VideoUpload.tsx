import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { uploadVideo } from '../../store/slices/participantsSlice';
import { FileUpload } from '../common/FileUpload';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { ParticipantID } from '../../types/models';
import './VideoUpload.css';

interface VideoUploadProps {
  participantId: ParticipantID;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ participantId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Пожалуйста, выберите видео');
      return;
    }

    // Validate file size (e.g., max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setError('Размер файла не должен превышать 100MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const result = await dispatch(uploadVideo({ participantId, file }));
      if (uploadVideo.rejected.match(result)) {
        setError(result.payload as string || 'Не удалось загрузить видео');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить видео');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-upload">
      <div className="video-upload-header">
        <h3>Загрузить видео</h3>
        {uploading && <LoadingSpinner size="small" />}
      </div>
      <FileUpload
        accept="video/*"
        onFileSelect={handleFileSelect}
        disabled={uploading}
        label={uploading ? 'Загрузка...' : 'Выбрать видео'}
      />
      {error && <ErrorMessage message={error} />}
      <p className="video-upload-hint">Можно загрузить одно видео (максимум 100MB)</p>
    </div>
  );
};
