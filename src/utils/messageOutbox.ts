import type {
  CreateMessagePayload,
  FileMetadata,
  Message,
  UploadFilePayload,
} from '../api/types';

export type LocalMessageStatus = 'uploading' | 'sending' | 'failed' | 'sent';

export interface OutgoingMessage extends Message {
  clientId: string;
  localStatus: LocalMessageStatus;
  payload: CreateMessagePayload;
  attachment?: UploadFilePayload;
  localImageUri?: string;
  error?: string;
  deliveryUncertain?: boolean;
}

interface AttachmentOptions {
  attachment?: UploadFilePayload;
  localImageUri?: string;
}

interface OutboxDependencies {
  senderId: string;
  sendMessage: (payload: CreateMessagePayload) => Promise<Message>;
  uploadFile: (payload: UploadFilePayload) => Promise<FileMetadata>;
  isCurrent?: () => boolean;
  onSent?: (message: Message, payload: CreateMessagePayload) => void;
  now?: () => string;
}

/** Session-local outbox. Local IDs and send states are never sent to the API. */
export function createMessageOutbox(dependencies: OutboxDependencies) {
  let messages: OutgoingMessage[] = [];
  let active = true;
  let sequence = 0;
  const listeners = new Set<() => void>();
  const isCurrent = () => active && (dependencies.isCurrent?.() ?? true);

  const publish = (next: OutgoingMessage[]) => {
    messages = next;
    listeners.forEach((listener) => listener());
  };

  const update = (clientId: string, changes: Partial<OutgoingMessage>) => {
    publish(messages.map((message) =>
      message.clientId === clientId ? { ...message, ...changes } : message
    ));
  };

  const isSending = (conversationId: string) => messages.some((message) =>
    message.conversationId === conversationId &&
    (message.localStatus === 'sending' || message.localStatus === 'uploading')
  );

  const attempt = async (clientId: string) => {
    const message = messages.find((item) => item.clientId === clientId);
    if (!message || !isCurrent()) return;
    let payload = message.payload;
    let messageRequestStarted = false;
    let sentMessage: Message;

    try {
      if (message.attachment && !payload.file_id) {
        const file = await dependencies.uploadFile(message.attachment);
        if (!isCurrent()) return;
        payload = { ...payload, file_id: file.id };
        // Keep the uploaded ID for retries; do not upload the same photo again.
        update(clientId, {
          payload,
          fileId: file.id,
          attachment: undefined,
          localStatus: 'sending',
        });
      }

      if (!isCurrent()) return;
      messageRequestStarted = true;
      sentMessage = await dependencies.sendMessage(payload);
    } catch (error) {
      if (!isCurrent()) return;
      const failure = error as { message?: string; status?: number } | null;
      update(clientId, {
        localStatus: 'failed',
        error: failure?.message || 'Could not send this message. Please try again.',
        // A lost response or a server error is not proof that a POST was rejected.
        deliveryUncertain: messageRequestStarted &&
          (!failure?.status || failure.status >= 500),
      });
      return;
    }

    if (!isCurrent()) return;
    update(clientId, {
      ...sentMessage,
      payload,
      localStatus: 'sent',
      attachment: undefined,
      error: undefined,
      deliveryUncertain: false,
    });
    // A failed cache refresh must not turn a confirmed send into a failed send.
    try {
      dependencies.onSent?.(sentMessage, payload);
    } catch {
      // The confirmed message remains visible until polling catches up.
    }
  };

  return {
    getSnapshot: () => messages,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setActive: (value: boolean) => { active = value; },
    isSending,
    enqueue: (input: CreateMessagePayload, options: AttachmentOptions = {}) => {
      const content = input.content?.trim() || undefined;
      if (!isCurrent() || !dependencies.senderId || !input.conversation_id ||
          isSending(input.conversation_id) ||
          (!content && !input.imageInfo && !input.file_id && !options.attachment)) {
        return null;
      }
      const clientId = `local-${Date.now()}-${sequence++}`;
      const payload = { ...input, content };
      const message: OutgoingMessage = {
        id: clientId,
        clientId,
        conversationId: input.conversation_id,
        senderId: dependencies.senderId,
        createdAt: dependencies.now?.() ?? new Date().toISOString(),
        content,
        imageInfo: input.imageInfo,
        fileId: input.file_id,
        status: {},
        payload,
        ...options,
        localStatus: options.attachment && !input.file_id ? 'uploading' : 'sending',
      };
      publish([...messages, message]);
      void attempt(clientId);
      return clientId;
    },
    retry: (clientId: string) => {
      const message = messages.find((item) => item.clientId === clientId);
      if (!isCurrent() || !message || message.localStatus !== 'failed' ||
          isSending(message.conversationId)) return false;
      update(clientId, {
        localStatus: message.attachment && !message.payload.file_id ? 'uploading' : 'sending',
        error: undefined,
        deliveryUncertain: false,
      });
      void attempt(clientId);
      return true;
    },
    discard: (clientId: string) => {
      const message = messages.find((item) => item.clientId === clientId);
      if (!message || message.localStatus !== 'failed') return false;
      publish(messages.filter((item) => item.clientId !== clientId));
      return true;
    },
    acknowledge: (serverMessages: Message[]) => {
      const ids = new Set(serverMessages.map((message) => message.id));
      const remaining = messages.filter((message) =>
        message.localStatus !== 'sent' || !ids.has(message.id)
      );
      if (remaining.length !== messages.length) publish(remaining);
    },
  };
}

/** Keep failed and confirmed local messages visible even if fetching fails. */
export function mergeChatMessages(
  serverMessages: Message[],
  outgoingMessages: OutgoingMessage[]
): (Message | OutgoingMessage)[] {
  const messages = new Map<string, Message | OutgoingMessage>();
  outgoingMessages.forEach((message) => messages.set(message.id, message));
  serverMessages.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}
