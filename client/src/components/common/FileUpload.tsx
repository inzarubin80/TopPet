import React, { useRef } from 'react';
import { Button } from './Button';
import './FileUpload.css';

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  label?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  onFileSelect,
  disabled = false,
  label = 'Выбрать файл',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="file-upload-input"
      />
      <Button type="button" onClick={handleClick} disabled={disabled} size="small">
        {label}
      </Button>
    </div>
  );
};
