import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { userApi } from './userApi';
import { conversationApi } from './conversationApi';
import { messageApi } from './messageApi';
import {
  User,
  Conversation,
  CreateConversationPayload,
  CreateMessagePayload,
  PaginatedMessagesResponse,
} from './types';
import { getAuthHeader } from './config';

export const QUERY_KEYS = {
  users: ['users'] as const,
  userProfile: (userId?: string) => ['user', 'profile', userId ?? 'me'] as const,
  conversations: ['conversations'] as const,
  messages: (conversationId: string, cursor?: string) =>
    ['messages', conversationId, cursor ?? 'latest'] as const,
};

/**
 * Hook to fetch all users on the platform.
 */
export function useUsers(options?: Partial<UseQueryOptions<User[], Error>>) {
  const hasAuth = !!getAuthHeader();
  return useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: () => userApi.getAllUsers(),
    enabled: hasAuth && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to fetch current authenticated user profile.
 */
export function useCurrentUser(options?: Partial<UseQueryOptions<User, Error>>) {
  const hasAuth = !!getAuthHeader();
  return useQuery({
    queryKey: QUERY_KEYS.userProfile(),
    queryFn: () => userApi.getUserProfile(),
    enabled: hasAuth && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Hook to fetch a specific user's profile.
 */
export function useUserProfile(
  userId?: string,
  options?: Partial<UseQueryOptions<User, Error>>
) {
  const hasAuth = !!getAuthHeader();
  return useQuery({
    queryKey: QUERY_KEYS.userProfile(userId),
    queryFn: () => userApi.getUserProfile(userId),
    enabled: hasAuth && !!userId && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Hook to fetch all conversations the user is a part of.
 * Defaults to polling every 5000ms for incoming conversations/bots.
 */
export function useConversations(options?: {
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  const hasAuth = !!getAuthHeader();
  return useQuery({
    queryKey: QUERY_KEYS.conversations,
    queryFn: () => conversationApi.getConversations(),
    enabled: hasAuth && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? 5000,
  });
}

/**
 * Hook to create a new DM or group conversation.
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateConversationPayload) =>
      conversationApi.createConversation(payload),
    onSuccess: (newConv: Conversation) => {
      // Invalidate conversation list so the new chat shows up immediately
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
}

/**
 * Hook to fetch messages for a conversation.
 * Defaults to polling every 3000ms so new messages (including FactBots) show up live.
 */
export function useMessages(
  conversationId?: string,
  cursor?: string,
  options?: { refetchInterval?: number | false; enabled?: boolean }
) {
  const hasAuth = !!getAuthHeader();
  const isEnabled = hasAuth && !!conversationId && (options?.enabled ?? true);

  return useQuery<PaginatedMessagesResponse, Error>({
    queryKey: QUERY_KEYS.messages(conversationId || '', cursor),
    queryFn: () =>
      messageApi.getMessages({
        conversation_id: conversationId!,
        from_message_cursor: cursor,
      }),
    enabled: isEnabled,
    refetchInterval: options?.refetchInterval ?? 3000,
  });
}

/**
 * Hook to send a message to a conversation.
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMessagePayload) => messageApi.sendMessage(payload),
    onSuccess: (sentMessage, variables) => {
      // Immediately refetch or invalidate message queries for this conversation
      queryClient.invalidateQueries({
        queryKey: ['messages', variables.conversation_id],
      });
      // Also invalidate conversations to update conversation list order
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.conversations,
      });
    },
  });
}
