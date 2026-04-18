import React, { useEffect, useRef, useState } from 'react';
import EmojiPicker, { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import { Button } from '../common/Button';
import { SendIcon } from './SendIcon';
import { useToast } from '../../contexts/ToastContext';
import './MessageInput.css';

const MAX_LEN = 2000;

export type MessageSendPayload = {
  text: string;
  imageUrl?: string | null;
};

interface MessageInputProps {
  onSend: (payload: MessageSendPayload) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  /** Загрузка файла на сервер; нужна для отправки сообщения с картинкой. */
  uploadImage?: (file: File) => Promise<string>;
}

const SmileIcon: React.FC<{ width?: number; height?: number }> = ({
  width = 22,
  height = 22,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <path
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
      stroke="currentColor"
      strokeWidth="1.75"
    />
    <path
      d="M8.5 9.5h.01M15.5 9.5h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M8.5 14.5c1.2 2.2 3.5 3.5 6 2.8 1.2-.4 2.2-1.2 2.8-2.3"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const ImageAttachIcon: React.FC<{ width?: number; height?: number }> = ({
  width = 22,
  height = 22,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <path
      d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
      stroke="currentColor"
      strokeWidth="1.75"
    />
    <circle cx="9" cy="10" r="1.25" fill="currentColor" />
    <path
      d="M4 16l4.5-4.5 3 3L15 11l5 5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Введите сообщение...',
  uploadImage,
}) => {
  const { showWarning, showError } = useToast();
  const [text, setText] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiAnchorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
    };
  }, [pendingImage]);

  const clearPendingImage = () => {
    setPendingImage((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleChange = (value: string) => {
    setText(value);
    requestAnimationFrame(resizeTextarea);
  };

  const insertEmoji = (emoji: string) => {
    if (disabled) {
      return;
    }
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);
    if (before.length + emoji.length + after.length > MAX_LEN) {
      return;
    }
    const next = before + emoji + after;
    setText(next);
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      resizeTextarea();
      if (!textareaRef.current) {
        return;
      }
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(caret, caret);
    });
  };

  const handleEmojiClick = (data: EmojiClickData) => {
    insertEmoji(data.emoji);
  };

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return;
    }
    const onMouseDown = (e: MouseEvent) => {
      if (emojiAnchorRef.current && !emojiAnchorRef.current.contains(e.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isEmojiPickerOpen]);

  const canSend = !disabled && !isSending && (text.trim().length > 0 || pendingImage !== null);

  const runSend = async () => {
    if (!canSend) {
      return;
    }
    const t = text.trim();
    if (!t && !pendingImage) {
      return;
    }
    if (pendingImage && !uploadImage) {
      showWarning('Загрузка изображения для этого чата не настроена');
      return;
    }
    let imageUrl: string | undefined;
    if (pendingImage) {
      setIsSending(true);
      try {
        imageUrl = await uploadImage!(pendingImage.file);
      } catch {
        showError('Не удалось загрузить изображение');
        setIsSending(false);
        return;
      }
      setIsSending(false);
    }
    try {
      await Promise.resolve(onSend({ text: t, imageUrl: imageUrl ?? null }));
    } catch {
      showError('Не удалось отправить сообщение');
      return;
    }
    setText('');
    clearPendingImage();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsEmojiPickerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSend();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || disabled) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      showWarning('Выберите файл изображения');
      return;
    }
    clearPendingImage();
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void runSend();
    }
  };

  return (
    <div className="message-input-composer">
      {pendingImage ? (
        <div className="message-input-image-preview">
          <div className="message-input-image-preview-thumb">
            <img src={pendingImage.previewUrl} alt="Предпросмотр вложения" />
            <button
              type="button"
              className="message-input-image-preview-remove"
              aria-label="Убрать изображение"
              disabled={disabled || isSending}
              onClick={clearPendingImage}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <form className="message-input" onSubmit={handleSubmit}>
        <div className="message-input-field-wrap">
          <textarea
            ref={textareaRef}
            className="message-input-field"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            maxLength={MAX_LEN}
            rows={1}
          />
          <div className="message-input-inline-actions">
            <div className="message-input-emoji-anchor" ref={emojiAnchorRef}>
              <button
                type="button"
                className="message-input-emoji-btn"
                disabled={disabled || isSending}
                aria-label="Выбрать эмодзи"
                aria-expanded={isEmojiPickerOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  if (!disabled && !isSending) {
                    setIsEmojiPickerOpen((open) => !open);
                  }
                }}
              >
                <SmileIcon width={22} height={22} />
              </button>
              {isEmojiPickerOpen && !disabled && !isSending && (
                <div className="message-input-emoji-popover" role="dialog" aria-label="Эмодзи">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme={Theme.LIGHT}
                    emojiStyle={EmojiStyle.NATIVE}
                    searchPlaceHolder="Поиск"
                    width="100%"
                    height={350}
                    style={{ width: 'min(320px, calc(100vw - 32px))' }}
                  />
                </div>
              )}
            </div>
            <div className="message-input-image-slot">
              <input
                ref={imageInputRef}
                type="file"
                className="message-input-file-input"
                accept="image/*"
                tabIndex={-1}
                aria-hidden
                onChange={handleImageChange}
              />
              <button
                type="button"
                className="message-input-emoji-btn"
                disabled={disabled || isSending}
                aria-label="Прикрепить изображение"
                title="Прикрепить изображение"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageAttachIcon width={22} height={22} />
              </button>
            </div>
          </div>
        </div>
        <Button
          type="submit"
          disabled={!canSend}
          size="small"
          className="message-input-send"
          aria-label="Отправить"
          title="Отправить"
        >
          <SendIcon width={20} height={20} />
        </Button>
      </form>
    </div>
  );
};
