import React from 'react';
import { WSConnectionState } from '../../types/ws';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  state: WSConnectionState;
  onReconnect?: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ state, onReconnect }) => {
  const getStatusText = () => {
    switch (state) {
      case 'CONNECTING':
        return 'Подключение...';
      case 'CONNECTED':
        return 'Подключено';
      case 'RECONNECTING':
        return 'Переподключение...';
      case 'DISCONNECTED':
        return 'Отключено';
      default:
        return 'Неизвестно';
    }
  };

  const getStatusClass = () => {
    switch (state) {
      case 'CONNECTING':
      case 'RECONNECTING':
        return 'status-connecting';
      case 'CONNECTED':
        return 'status-connected';
      case 'DISCONNECTED':
        return 'status-disconnected';
      default:
        return '';
    }
  };

  return (
    <div className={`connection-status ${getStatusClass()}`}>
      <span className="status-indicator"></span>
      <span className="status-text">{getStatusText()}</span>
      {state === 'DISCONNECTED' && onReconnect && (
        <button className="reconnect-button" onClick={onReconnect}>
          Переподключить
        </button>
      )}
    </div>
  );
};
