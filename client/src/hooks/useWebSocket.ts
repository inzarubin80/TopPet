import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { WebSocketClient } from '../websocket/wsClient';
import { addMessage, setConnectionState, setCurrentContestId } from '../store/slices/chatSlice';
import { ChatMessage, ContestID } from '../types/models';
import { WSConnectionState } from '../types/ws';
import { tokenStorage } from '../utils/tokenStorage';

let wsClientInstance: WebSocketClient | null = null;

const getWebSocketClient = (): WebSocketClient => {
  if (!wsClientInstance) {
    wsClientInstance = new WebSocketClient();
  }
  return wsClientInstance;
};

export const useWebSocket = (contestId: ContestID | null) => {
  const dispatch = useDispatch();
  const connectionState = useSelector((state: RootState) => state.chat.connectionState);
  const messages = useSelector((state: RootState) =>
    contestId ? state.chat.messages[contestId] || [] : []
  );
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const wsClientRef = useRef<WebSocketClient | null>(null);

  // Initialize WebSocket client
  useEffect(() => {
    const client = getWebSocketClient();
    wsClientRef.current = client;

    // Set up message handler
    client.setOnMessage((message: ChatMessage) => {
      if (contestId && message.contest_id === contestId) {
        dispatch(addMessage({ contestId, message }));
      }
    });

    // Set up connection state handler
    client.setOnConnectionStateChange((state: WSConnectionState) => {
      dispatch(setConnectionState(state));
    });

    // Update access token if available
    if (accessToken) {
      client.updateAccessToken(accessToken);
    }

    return () => {
      // Cleanup is handled by disconnect
    };
  }, [dispatch, contestId, accessToken]);

  // Connect when contestId changes
  useEffect(() => {
    if (!contestId || !wsClientRef.current) {
      return;
    }

    const client = wsClientRef.current;
    const token = accessToken || tokenStorage.getAccessToken();

    if (!token) {
      console.warn('WebSocket: No access token available for connection');
      return;
    }

    dispatch(setCurrentContestId(contestId));
    client.connect(contestId, token);
    client.subscribe(contestId);

    return () => {
      if (client) {
        client.unsubscribe(contestId);
        // Only disconnect if no other contests are subscribed
        // For now, we'll disconnect when component unmounts
        // In a more complex scenario, we might want to keep connection alive
        client.disconnect();
      }
    };
  }, [contestId, accessToken, dispatch]);

  // Update access token when it changes
  useEffect(() => {
    if (accessToken && wsClientRef.current) {
      wsClientRef.current.updateAccessToken(accessToken);
    }
  }, [accessToken]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!contestId || !wsClientRef.current) {
        return;
      }
      wsClientRef.current.sendMessage(contestId, text);
    },
    [contestId]
  );

  const reconnect = useCallback(() => {
    if (!contestId || !wsClientRef.current) {
      return;
    }
    const token = accessToken || tokenStorage.getAccessToken();
    if (token) {
      wsClientRef.current.connect(contestId, token);
      wsClientRef.current.subscribe(contestId);
    }
  }, [contestId, accessToken]);

  return {
    connectionState,
    messages,
    sendMessage,
    reconnect,
    isConnected: wsClientRef.current?.isConnected() || false,
  };
};
