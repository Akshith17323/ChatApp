interface MotionMessage {
  id: string;
  clientId?: string;
}

interface MessageMotionState {
  localKeys: ReadonlyMap<string, string>;
  seenKeys: ReadonlySet<string>;
  enteringKeys: ReadonlySet<string>;
  historyLoaded: boolean;
}

export function getMessageKey(message: MotionMessage, localKeys: ReadonlyMap<string, string>): string {
  return message.clientId || localKeys.get(message.id) || message.id;
}

export function rememberLocalMessageKeys(
  outgoingMessages: MotionMessage[],
  previousKeys: ReadonlyMap<string, string>
): Map<string, string> {
  const keys = new Map(previousKeys);
  for (const message of outgoingMessages) {
    if (message.clientId) keys.set(message.id, message.clientId);
  }
  return keys;
}

export function shouldAnimateMessage(
  message: MotionMessage,
  seenKeys: ReadonlySet<string>,
  localKeys: ReadonlyMap<string, string>,
  historyLoaded: boolean
): boolean {
  return (historyLoaded || Boolean(message.clientId)) &&
    !seenKeys.has(getMessageKey(message, localKeys));
}

export function updateMessageMotion(
  previous: MessageMotionState | null,
  messages: MotionMessage[],
  outgoingMessages: MotionMessage[],
  olderMessages: MotionMessage[],
  historyLoaded: boolean
): MessageMotionState {
  const localKeys = rememberLocalMessageKeys(outgoingMessages, previous?.localKeys || new Map());
  const seenKeys = new Set(previous?.seenKeys);
  const enteringKeys = new Set<string>();
  olderMessages.forEach((message) => seenKeys.add(getMessageKey(message, localKeys)));

  for (const message of messages) {
    const key = getMessageKey(message, localKeys);
    if (previous && shouldAnimateMessage(message, seenKeys, localKeys, previous.historyLoaded)) {
      enteringKeys.add(key);
    }
    seenKeys.add(key);
  }
  return { localKeys, seenKeys, enteringKeys, historyLoaded: previous?.historyLoaded || historyLoaded };
}
