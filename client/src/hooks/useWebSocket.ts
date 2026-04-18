import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { WebSocketClient } from '../websocket/wsClient';
import {
  addMessage,
  updateMessage,
  removeMessage,
  mergeMessageScore,
  setConnectionState,
  setCurrentContestId,
} from '../store/slices/chatSlice';
import { refreshTokenAsync } from '../store/slices/authSlice';
import {
  fetchContest,
  setUserVoteSlot,
  setUserVotesForContest,
  updateContestTotalVotes,
} from '../store/slices/contestsSlice';
import {
  mergeParticipantFromWebSocket,
  removeParticipantFromWebSocket,
  updateParticipantVotes,
} from '../store/slices/participantsSlice';
import { getVotes } from '../api/votesApi';
import { ChatMessage, ContestID, ParticipantID } from '../types/models';
import { WSConnectionState } from '../types/ws';
import { RefreshTokenResponse } from '../types/api';
import { tokenStorage } from '../utils/tokenStorage';
import { logger } from '../utils/logger';

let wsClientInstance: WebSocketClient | null = null;
const EMPTY_MESSAGES: ChatMessage[] = [];

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
    if (!contestId) return EMPTY_MESSAGES;
    const contestMessages = state.chat.messages[contestId];
    return contestMessages || EMPTY_MESSAGES;
  });
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
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
        if (!participantIdFromPayload) {
          getVotes(contestId)
            .then((votes) => dispatch(setUserVotesForContest({ contestId, votes })))
            .catch(() => {
              // Ignore resync errors; state will refresh on next explicit load.
            });
          return;
        }
        dispatch(
          setUserVoteSlot({
            contestId,
            participantId: participantIdFromPayload,
            voted: true,
          })
        );
      }
    });

    client.setOnChatMessageVoteUpdated((contestIdFromPayload, messageId, score, voterUserId, voterValue) => {
      if (contestId && contestIdFromPayload === contestId) {
        dispatch(
          mergeMessageScore({
            contestId,
            messageId,
            score,
            voterUserId,
            voterValue: voterValue === -1 || voterValue === 1 ? voterValue : undefined,
            currentUserId,
          })
        );
      }
    });

    client.setOnParticipantUpdated((contestIdFromPayload, participant) => {
      if (contestId && contestIdFromPayload === contestId) {
        dispatch(mergeParticipantFromWebSocket({ contestId, participant }));
      }
    });

    client.setOnParticipantDeleted((contestIdFromPayload, participantId) => {
      if (contestId && contestIdFromPayload === contestId) {
        dispatch(removeParticipantFromWebSocket({ contestId, participantId }));
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
  }, [dispatch, contestId, accessToken, currentUserId]);

  // Connect when contestId changes
  useEffect(() => {
    if (!contestId || !wsClientRef.current) {
      return;
    }

    let cancelled = false;
    let didAcquireSocket = false;

    const connectWithToken = async () => {
      const client = wsClientRef.current;
      if (!client) return;

      // Use refresh token from storage only (not Redux) so effect doesn't re-run when Redux updates after refresh
      const refreshTokenValue = tokenStorage.getRefreshToken();
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

      if (cancelled) {
        return;
      }

      dispatch(setCurrentContestId(contestId));
      client.connect(contestId, token);
      didAcquireSocket = true;
      client.subscribe(contestId);
    };

    void connectWithToken();

    return () => {
      cancelled = true;
      const client = wsClientRef.current;
      if (client && didAcquireSocket) {
        client.releaseConnection();
      }
    };
  }, [contestId, dispatch]);

  // Update access token when it changes
  useEffect(() => {
    if (accessToken && wsClientRef.current) {
      wsClientRef.current.updateAccessToken(accessToken);
    }
  }, [accessToken]);

  const sendMessage = useCallback(
    (text: string, parentId?: string, imageUrl?: string) => {
      if (!contestId || !wsClientRef.current) {
        return;
      }
      wsClientRef.current.sendMessage(contestId, text, parentId, imageUrl);
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
          wsClientRef.current.reconnectPreservingConsumers(contestId, token);
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
