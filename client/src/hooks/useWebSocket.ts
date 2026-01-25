import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { WebSocketClient } from '../websocket/wsClient';
import { addMessage, updateMessage, removeMessage, setConnectionState, setCurrentContestId } from '../store/slices/chatSlice';
import { refreshTokenAsync } from '../store/slices/authSlice';
import { fetchContest, setUserVote, updateContestTotalVotes } from '../store/slices/contestsSlice';
import { updateParticipantVotes } from '../store/slices/participantsSlice';
import { ChatMessage, ContestID, ParticipantID } from '../types/models';
import { WSConnectionState } from '../types/ws';
import { RefreshTokenResponse } from '../types/api';
import { tokenStorage } from '../utils/tokenStorage';
import { logger } from '../utils/logger';

let wsClientInstance: WebSocketClient | null = null;

const getWebSocketClient = (): WebSocketClient => {
  if (!wsClientInstance) {
    wsClientInstance = new WebSocketClient();
  }
  return wsClientInstance;
};

export const useWebSocket = (contestId: ContestID | null, participantId?: ParticipantID | null) => {
  const dispatch = useDispatch<AppDispatch>();
  const connectionState = useSelector((state: RootState) => state.chat.connectionState);
  const messages = useSelector((state: RootState) => {
    if (!contestId) return [];
    const contestMessages = state.chat.messages[contestId];
    return contestMessages || [];
  });
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
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

    client.setOnMessageUpdated((message: ChatMessage) => {
      if (contestId && message.contest_id === contestId) {
        dispatch(updateMessage({ contestId, message }));
      }
    });

    client.setOnMessageDeleted((messageId: string, contestIdFromPayload: string) => {
      if (contestId && contestIdFromPayload === contestId) {
        dispatch(removeMessage({ contestId, messageId }));
      }
    });

    client.setOnContestStatusUpdated((contestIdFromPayload) => {
      if (contestId && contestIdFromPayload === contestId) {
        dispatch(fetchContest(contestId));
      }
    });

    client.setOnVoteCountsUpdated((contestIdFromPayload, participantIdFromPayload, totalVotes, contestTotal) => {
      if (contestId && contestIdFromPayload === contestId) {
        if (participantIdFromPayload && typeof totalVotes === 'number') {
          dispatch(updateParticipantVotes({ participantId: participantIdFromPayload, totalVotes }));
        }
        if (typeof contestTotal === 'number') {
          dispatch(updateContestTotalVotes({ contestId, totalVotes: contestTotal }));
        }
      }
    });

    client.setOnUserVoteUpdated((contestIdFromPayload, participantIdFromPayload) => {
      if (contestId && contestIdFromPayload === contestId) {
        dispatch(setUserVote({ contestId, participantId: participantIdFromPayload || null }));
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

    const connectWithToken = async () => {
      const client = wsClientRef.current;
      if (!client) return;

      // Always refresh token before connecting to ensure it's fresh
      const refreshTokenValue = refreshToken || tokenStorage.getRefreshToken();
      if (!refreshTokenValue) {
        logger.warn('[useWebSocket] No refresh token available for connection');
        return;
      }

      logger.debug('[useWebSocket] Refreshing token before WebSocket connection...');
      let token: string | null = null;
      
      try {
        const result = await dispatch(refreshTokenAsync(refreshTokenValue));
        if (refreshTokenAsync.fulfilled.match(result)) {
          const payload = result.payload as RefreshTokenResponse;
          token = payload?.token;
          if (token) {
            logger.info('[useWebSocket] Token refreshed successfully, connecting WebSocket...');
          } else {
            logger.error('[useWebSocket] Token refresh returned no token');
            return;
          }
        } else {
          logger.error('[useWebSocket] Token refresh failed', result.payload);
          return;
        }
      } catch (err) {
        logger.error('[useWebSocket] Failed to refresh token', err);
        return;
      }

      if (!token) {
        console.warn('[useWebSocket] No access token available after refresh');
        return;
      }

      dispatch(setCurrentContestId(contestId));
      client.connect(contestId, token);
      client.subscribe(contestId);
    };

    connectWithToken();

    return () => {
      const client = wsClientRef.current;
      if (client) {
        client.unsubscribe(contestId);
        // Only disconnect if no other contests are subscribed
        // For now, we'll disconnect when component unmounts
        // In a more complex scenario, we might want to keep connection alive
        client.disconnect();
      }
    };
  }, [contestId, refreshToken, dispatch]);

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

  const reconnect = useCallback(async () => {
    if (!contestId || !wsClientRef.current) {
      return;
    }
    
    // Always refresh token before reconnecting to ensure it's fresh
    const refreshTokenValue = refreshToken || tokenStorage.getRefreshToken();
    if (!refreshTokenValue) {
      logger.warn('[useWebSocket] Reconnect: No refresh token available');
      return;
    }

    logger.debug('[useWebSocket] Reconnect: Refreshing token before reconnecting...');
    
    try {
      const result = await dispatch(refreshTokenAsync(refreshTokenValue));
      if (refreshTokenAsync.fulfilled.match(result)) {
        const payload = result.payload as RefreshTokenResponse;
        const token = payload?.token;
        if (token) {
          logger.info('[useWebSocket] Reconnect: Token refreshed successfully, reconnecting...');
          wsClientRef.current.connect(contestId, token);
          wsClientRef.current.subscribe(contestId);
        } else {
          logger.error('[useWebSocket] Reconnect: Token refresh returned no token');
        }
      } else {
        logger.error('[useWebSocket] Reconnect: Token refresh failed', result.payload);
      }
    } catch (err) {
      logger.error('[useWebSocket] Reconnect: Failed to refresh token', err);
    }
  }, [contestId, refreshToken, dispatch]);

  // Use connectionState to determine isConnected instead of checking ws.readyState directly
  // This ensures consistency between ConnectionStatus and MessageInput
  const isConnectedValue = connectionState === 'CONNECTED';
  return {
    connectionState,
    messages,
    sendMessage,
    reconnect,
    isConnected: isConnectedValue,
  };
};
