# Chat App Backend API Integration Guide

This React Native Expo application integrates with the NestJS + MongoDB Chat Backend documented at:
**Swagger UI:** [http://10.7.1.51:3000/docs#/](http://10.7.1.51:3000/docs#/)

---

## 1. Authentication Scheme

Every protected endpoint requires the `Authorization` header formatted as:
```http
Authorization: Basic <username>:<password>
```

> **Important:** The backend `AuthGuard` parses literal plain text (`username:password`) rather than base64.
- `username`: Unique user identifier (display name).
- `password`: Secret/phone for the user.
- **Auto-registration:** If a username does not exist when a request arrives, the server creates the user automatically! If the user exists, the password must match.

---

## 2. API Endpoints Reference

### 👤 User Endpoints (`/user`)
- **`GET /user`**
  - **Summary:** List every registered user on the platform.
  - **Response:** `UserResponseDto[]`
    ```json
    [
      { "id": "64b8f9e2c4a3b12d4e5f6789", "name": "Alice", "bio": "Hello world" }
    ]
    ```

- **`GET /user/profile`**
  - **Query Params:** `?user_id=<mongo_id>` *(optional, defaults to authenticated caller)*
  - **Response:** `UserResponseDto`
    ```json
    { "id": "64b8f9e2c4a3b12d4e5f6789", "name": "Alice", "bio": "Building cool stuff" }
    ```

---

### 💬 Conversation Endpoints (`/conversation`)
- **`GET /conversation`**
  - **Summary:** List all conversations the authenticated user is part of (sorted newest first).
  - **Response:** `ConversationResponseDto[]`
    ```json
    [
      {
        "id": "64b8f9e2c4a3b12d4e5f0001",
        "name": null,
        "type": "DM",
        "createdAt": "2026-10-28T10:30:00.000Z",
        "createdBy": "64b8f9e2c4a3b12d4e5f6789",
        "participants_ids": ["64b8f9e2c4a3b12d4e5f6789", "64b8f9e2c4a3b12d4e5f6790"]
      }
    ]
    ```

- **`POST /conversation`**
  - **Summary:** Create a new DM or group conversation. Returns existing DM if one already exists between the two users.
  - **Body (DM):**
    ```json
    { "type": "DM", "recipient_id": "64b8f9e2c4a3b12d4e5f6790" }
    ```
  - **Body (Group):**
    ```json
    { "type": "GROUP", "name": "Study Group", "participants_ids": ["id1", "id2"] }
    ```
  - **Response:** `ConversationResponseDto`

---

### ✉️ Message Endpoints (`/message`)
- **`GET /message`**
  - **Query Params:**
    - `conversation_id`: MongoDB ObjectId of conversation (*required*)
    - `from_message_cursor`: ObjectId of cursor message (*optional, for pagination*)
  - **Response:** `PaginatedMessagesResponseDto`
    ```json
    {
      "data": [
        {
          "id": "64b8f9e2c4a3b12d4e5f1234",
          "content": "Hey there!",
          "createdAt": "2026-10-28T10:35:00.000Z",
          "senderId": "64b8f9e2c4a3b12d4e5f6789",
          "conversationId": "64b8f9e2c4a3b12d4e5f0001",
          "status": {
            "64b8f9e2c4a3b12d4e5f6789": { "delivered": true, "read": true },
            "64b8f9e2c4a3b12d4e5f6790": { "delivered": true, "read": false }
          }
        }
      ],
      "nextCursor": "64b8f9e2c4a3b12d4e5f1111",
      "count": 1
    }
    ```

- **`POST /message`**
  - **Body:**
    ```json
    {
      "conversation_id": "64b8f9e2c4a3b12d4e5f0001",
      "content": "Hello!"
    }
    ```
  - **Response:** `MessageResponseDto`

---

## 3. Client Architecture

The API module is located in `src/api/`:
- `src/api/types.ts`: Complete TypeScript interfaces for all DTOs and models.
- `src/api/config.ts`: Base URL configuration (`http://10.7.1.51:3000`), plain text Basic Auth header generation, and typed `apiFetch`.
- `src/api/userApi.ts`: User endpoints (`getAllUsers`, `getUserProfile`).
- `src/api/conversationApi.ts`: Conversation endpoints (`getConversations`, `createConversation`, `startDirectMessage`, `createGroup`).
- `src/api/messageApi.ts`: Message endpoints (`getMessages`, `sendMessage`).
- `src/api/hooks.ts`: TanStack React Query hooks with automatic caching and polling:
  - `useUsers()`
  - `useCurrentUser()`
  - `useUserProfile(userId)`
  - `useConversations()` (polls every 5s)
  - `useCreateConversation()`
  - `useMessages(conversationId)` (polls every 3s for live chat)
  - `useSendMessage()`

### Frontend sending and appearance

- Text and photo sends appear immediately with **Sending** or **Uploading photo** states.
- Failed messages keep their content and attachments, with manual **Retry** and an **Edit** action for text. Retrying a photo message reuses its uploaded file ID when the upload already succeeded.
- The outbox survives screen navigation during the signed-in session. It is not persisted across app restarts, and is cleared when signing out or changing servers/accounts.
- A confirmed send stays visible until the existing message polling returns its server ID. Fetch errors do not hide pending or failed messages in the chat room.
- The existing API has no idempotency key. There are no automatic POST retries; a timeout or server error prompts a duplicate-send warning before manual retry.
- Request timeouts cover reading the full response body, not just waiting for headers. Retry/Edit confirmations work on native devices and in the browser.
- **Settings → Appearance → System / Light / Dark** controls the entire app. The preference is saved locally; System follows device changes.
- No backend routes, payloads, or authentication contracts have changed.

Run `npm test`, `npm run lint`, and `npm run typecheck` for frontend checks. Native development builds need rebuilding after adding the appearance/storage modules.

#### Verification results (2026-11-12)

- Passed 21 automated tests, Expo lint, full frontend ESLint, TypeScript checks, and `git diff --check`.
- Production bundles completed for iOS, Android, and web; native configuration introspection succeeded. These are not native builds or device tests.
- Headless Chrome checks at 390×844 passed with local HTTP mocks: appearance persistence/system changes, optimistic sends and reconciliation, Retry/Edit, photos, navigation, sign-out during upload, and server switching. No runtime exceptions were reported; the real backend was not exercised.
- The browser checks used a temporary HTML shell because the existing web export emitted bundles but no HTML. Production web routing/deployment was not changed.
- `CI=1 npx expo install --check` still flags existing SDK patch mismatches, including Expo `58.0.22` versus `~58.0.24` and React Native `0.88.0` versus `0.88.1`. Dependency upgrades were left outside this feature change.
- Native-device verification below remains to be done with a rebuilt development app.

#### Device verification

1. Send a text message; confirm its pending state changes to Sent without a duplicate after polling.
2. Make the server unreachable, send text/photo, and confirm failure keeps the message and caption. Restore connectivity and retry; also try Edit while another draft exists.
3. Navigate away and back before retrying, and rapidly tap Send/Retry to check duplicate-tap protection.
4. Switch among System, Light, and Dark; check login, chat list, chat room, new chat, Settings, headers, keyboard, and image preview. Restart to verify the saved appearance.
5. With System selected, change the device appearance. Sign out during a photo upload and check that it does not continue as another account.

---

## 4. Testing with Local Backend

If you are not connected to the `10.7.1.51` campus/lab network, you can run the backend locally from `backend/`:

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run start:dev:bot   # Starts with FactBots for automated chat testing!
```
Then set the Server Base URL in the app's Settings screen to `http://localhost:3000` (iOS simulator) or `http://10.0.2.2:3000` (Android emulator).
