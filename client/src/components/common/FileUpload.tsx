import React, { useRef } from 'react';
import { Button } from './Button';
import './FileUpload.css';

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  label?: string;
  multiple?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  onFileSelect,
  disabled = false,
  label = 'Выбрать файл',
  multiple = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // For single file selection, call onFileSelect for each file
      // This allows the parent to handle multiple files if needed
      for (let i = 0; i < files.length; i++) {
        onFileSelect(files[i]);
      }
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
        multiple={multiple}
        className="file-upload-input"
      />
      <Button type="button" onClick={handleClick} disabled={disabled} size="small">
        {label}
      </Button>
    </div>
  );
};
