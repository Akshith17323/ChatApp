What this repo does: This is an Expo/React Native chat client with a NestJS API and MongoDB storage. It supports direct and group conversations, polling for messages, photo/file attachments, and a test bot. This audit assumes several users chatting at the same time on mobile, plus the web support exposed by the project.

# Bugs and risks audit

- **Audited:** 18 November 2026, source commit `c9cbcd7`.
- **Scope:** Authentication, server/account changes, conversation creation, message history and sending, attachments, outbox, bot, database/deployment configuration, dependencies, and existing checks.
- **Report only:** No application code, dependencies, database records, or native projects were changed.
- **Not missing features:** The five additions in `FEATURES.md` are explicitly planned, not implemented. Their absence is not counted as a bug here.

## How to read this report

- **P0:** Fix first; private conversations or accounts can be accessed without the right permission.
- **P1:** High-impact security, session, or availability issue.
- **P2:** User-facing correctness issue or a reliability/verification gap.
- **Source/mock:** Verified by reading the connected code and, where stated below, temporary source-based assertion checks with mocked dependencies. This is not a live API/database test.
- **Configuration risk:** Depends on how the app is built or deployed; the stated deployment condition matters.
- **Tooling result:** Observed from an actual local check/export. A successful bundle or an advisory scan is not proof of device behavior or an exploitable runtime vulnerability.

## Must fix

1. **[P0] Outsiders can read and send messages in another conversation**
   (`backend/src/message/message.controller.ts:L51-55,L78-79`; `backend/src/message/message.service.ts:L21-49,L85-124`) — **Source/mock**
   - **What this is:** The message endpoints require sign-in, but also need to check whether that user belongs to the requested conversation.
   - **Problem:** For an Alice/Bob conversation, an authenticated Eve who knows its ID can fetch its history and post a message into it. The history method receives no caller ID, and sending checks that the conversation exists but never checks membership; source-based assertions reproduced both paths.
   - **Fix:** Pass the authenticated user ID into history retrieval and enforce `participants_ids` membership before reading or writing messages. Also validate that a supplied history cursor belongs to that conversation.
   - **If we skip it:** Knowing a conversation ID is enough to read private text/legacy inline images and inject messages, even after other features are added.

2. **[P0] Password handling permits a bypass and stores real passwords as plain text**
   (`backend/src/auth/auth.guard.ts:L53-69`; `backend/prisma/schema.prisma:L13-16`) — **Source/mock; bypass depends on an account having no stored password**
   - **What this is:** The guard uses the nullable `User.phone` field as the password field.
   - **Problem:** An existing account with `phone: null` or `phone: ''` accepts any nonempty password because verification is conditional on `user.phone`; an assertion reproduced that bypass. Normal registration also writes the actual password into `phone` without hashing it.
   - **Fix:** Store a salted password hash and verify it, rather than storing the secret itself. Reject accounts without a usable credential until they have been safely migrated or reset; do not silently accept a replacement password from a login request.
   - **If we skip it:** Passwordless legacy accounts can be impersonated, and a database or backup leak reveals every stored password.

3. **[P1] A supposedly private DM can include an extra reader**
   (`backend/src/conversation/dto/conversation.dto.ts:L10-36`; `backend/src/conversation/conversation.service.ts:L43-79,L86-103`) — **Source/mock**
   - **What this is:** A DM is meant to be a conversation between exactly two users, including its creator.
   - **Problem:** Alice can submit `type: 'DM'` with Bob and Eve in `participants_ids`, creating a three-person DM. A later request for just Alice/Bob can reuse it because `hasEvery` checks that both IDs are present, not that no third participant exists; source-based checks reproduced this reuse.
   - **Fix:** Require exactly one other participant for a DM and reuse only an exact two-person pair. Repair or explicitly reclassify existing malformed DMs so they cannot be returned as private pairs.
   - **If we skip it:** A user can believe they are messaging one person while an extra participant has legitimate access to the same conversation.

4. **[P1] The default connection sends passwords and chats without encryption**
   (`src/api/config.ts:L3,L24-32,L59-73`; `src/screens/SettingsScreen.js:L158-206`; `app.json:L10-21`) — **Configuration risk; native configuration inspected**
   - **What this is:** The default server and all quick presets use `http://`, and credentials accompany protected requests.
   - **Problem:** On an observable network, HTTP exposes the password and message contents in transit. Native introspection also showed iOS allowing arbitrary loads but no Android application-level cleartext exception, so HTTP support in an Android release needs verification rather than being assumed from Expo Go.
   - **Fix:** Serve the API over HTTPS and use an HTTPS URL for release use. Keep any necessary local-development HTTP exception narrowly scoped through Expo configuration/config plugins, not hand-edited native projects.
   - **If we skip it:** Network observers can capture credentials and chats, and the current HTTP-only setup may also fail in an Android release; that release failure was not device-tested.

5. **[P1] The Docker quickstart can expose MongoDB with public example credentials**
   (`backend/docker-compose.yml:L7-12,L27,L57`; `backend/.env.example:L1-3`; `backend/README.md:L16-26`) — **Conditional configuration risk**
   - **What this is:** Docker publishes database port `27017` on the host, and the documented quickstart copies the example environment file unchanged.
   - **Problem:** If those example credentials are kept and the host port is reachable, another machine can connect using the publicly documented database root account. The API connection also uses that root account; this is not a claim that a current deployment actually kept those credentials or is publicly reachable.
   - **Fix:** Remove the database port mapping, or bind it to `127.0.0.1` when local tools require it. Replace example secrets and give the API a database user with only the permissions it needs.
   - **If we skip it:** That deployment condition permits reading, changing, or deleting the entire database, including the plain-text passwords in finding 2.

6. **[P1] Switching servers keeps the old account and forwards its credentials**
   (`src/context/AuthContext.js:L28-36`; `src/api/config.ts:L11-17`; `src/screens/SettingsScreen.js:L33-46`; `src/context/MessageOutboxContext.js:L13-27`) — **Source/mock**
   - **What this is:** Applying a new server URL clears cached queries but does not establish a new authenticated session.
   - **Problem:** Sign in on server A, then apply server B: the UI keeps A's user ID while requests send A's username/password to B. If B auto-registers the same name with a different ID, current-user filtering and message ownership still use A's ID; source-based checks confirmed the retained state.
   - **Fix:** Treat a server-origin change as sign-out: clear the user and credentials, invalidate pending authentication, and require sign-in against the new server. Do not send an old server's password merely to test a new host.
   - **If we skip it:** The app shows the wrong identity, can expose a password to a different server, and misidentifies users or outgoing messages.

7. **[P1] A late login response can undo sign-out or a server change**
   (`src/context/AuthContext.js:L38-75`; `src/context/MessageOutboxContext.js:L19-22`; `src/navigation/Tabnavigator.js:L67-70`) — **Source/mock**
   - **What this is:** Login waits for a profile response and then writes authentication state unconditionally.
   - **Problem:** Start a login, use the available Settings tab to sign out or change the server while it waits, then let the old response resolve. The old user becomes authenticated again while API configuration has empty credentials or points elsewhere; deferred-response assertions reproduced this mismatch and the outbox's rejection of sends.
   - **Fix:** Give authentication attempts a generation/token and invalidate it on logout, server changes, and newer logins. Ignore both success and failure from an obsolete attempt, and cancel its request where practical.
   - **If we skip it:** Sign-out is not final, and the UI can say the user is signed in while requests and message sending fail.

8. **[P1] Discarded remote-upload responses escape the time and size limits**
   (`backend/src/common/remote-fetch.util.ts:L106-129,L191-215,L218-270`; `backend/src/file/file.service.ts:L62-64`) — **Source/mock with real stream checks**
   - **What this is:** Uploading by URL lets the server download a client-selected public URL with limits on the download.
   - **Problem:** A remote server can return redirect/error headers and leave the response body streaming indefinitely. Those branches call `response.resume()` after the header timer has been cleared, but never destroy the discarded stream or apply `readBody` limits; checks confirmed unfinished streams survived completion/rejection without a timer.
   - **Fix:** Destroy unused response bodies before redirecting or rejecting, instead of draining them without limits. Keep the absolute deadline covering every stream owned by the download.
   - **If we skip it:** Repeated uploads to such URLs can keep sockets and bandwidth busy after the upload request has already finished; exhaustion under real load was not measured.

9. **[P2] Concurrent creation can fail registration or create duplicate DMs**
   (`backend/src/auth/auth.guard.ts:L53-64`; `backend/src/conversation/conversation.service.ts:L69-103`; `backend/src/bot/bot.service.ts:L40-53,L106-139`; `backend/prisma/schema.prisma:L13-35`) — **Source/mock**
   - **What this is:** Account and DM creation first look for an existing record, then create one in a separate database operation.
   - **Problem:** Two first requests for the same username can both see no user, after which one receives an unhandled `P2002` duplicate-key error; concurrent DM requests can both create a separate conversation because the pair has no unique database identity. Controlled concurrent assertions reproduced these races, and the bot uses the same unsafe find-then-create pattern.
   - **Fix:** Handle username conflicts by re-reading the winning account and verifying its password, not automatically trusting it. Give a normalized DM pair database-enforced uniqueness and use the same atomic/conflict-safe creation path for API and bot callers.
   - **If we skip it:** Valid first logins intermittently fail, and the same two users can have fragmented message histories in duplicate chats.

10. **[P2] Older messages cannot be reached from the chat screen**
    (`backend/src/message/message.service.ts:L7,L21-56`; `src/api/hooks.ts:L106-123`; `src/screens/ChatRoomScreen.js:L69-85,L494-552`) — **Source review**
    - **What this is:** The backend returns 20 messages per page and supplies `nextCursor` to request older history.
    - **Problem:** A conversation with 21 or more saved messages only shows the latest 20: the screen always calls `useMessages(conversationId)` without a cursor and never consumes `nextCursor`. Later polls replace that latest page, so scrolling cannot recover earlier messages even though they remain stored.
    - **Fix:** Use the existing cursor API to load older pages, merge them by message ID, and preserve scroll position. Keep latest-message polling separate from the retained older pages.
    - **If we skip it:** Normal conversations appear to lose history after the twentieth message.

11. **[P2] PDFs and other files are rendered as images**
    (`src/screens/ChatRoomScreen.js:L55-65,L327-383`; `backend/src/message/message.service.ts:L177-183`) — **Source/mock**
    - **What this is:** The backend distinguishes `TEXT`, `IMAGE`, and `FILE` messages and returns attachment metadata.
    - **Problem:** A valid PDF message with `type: 'FILE'` and a `fileId` gets an image URI and enters the `<Image>` branch. An assertion reproduced that classification; there is no document filename/open action, and the bytes cannot be decoded as a photo.
    - **Fix:** Only send image attachments to the image renderer. Render other files with their filename and an authenticated open/download action, using the returned metadata.
    - **If we skip it:** Valid incoming documents become broken or empty photo bubbles rather than usable attachments.

12. **[P2] Direct browser-to-backend requests lack CORS support**
    (`backend/src/main.ts:L8-22,L50-58`; `src/api/config.ts:L50-73`) — **Source/configuration; no live backend browser test**
    - **What this is:** CORS is the browser's permission check when a page calls an API at a different origin, such as web port `8081` calling API port `3000`.
    - **Problem:** Authenticated browser requests need a preflight/allowed-origin response because they carry `Authorization`, but this backend never enables CORS. Direct cross-origin login and chat requests are therefore blocked unless an external proxy supplies the missing behavior; native clients do not have this browser restriction.
    - **Fix:** Enable CORS for the intended web origins and required headers/methods, including preflight handling. Keep normal API authentication and conversation permissions in place.
    - **If we skip it:** Web users see connection errors even when the API is running and reachable.

13. **[P2] Protected photos cannot reload on web using image headers**
    (`src/screens/ChatRoomScreen.js:L60-64,L373-380,L641-649`; `src/api/fileApi.ts:L16-21`; `backend/src/file/file.service.ts:L119-156`) — **App and installed React Native Web source reviewed**
    - **What this is:** Stored photos use an authenticated `/file/:id/download` URL after the temporary local preview is gone.
    - **Problem:** React Native Web's installed image loader uses `new window.Image()` and a URL, ignoring `source.headers`; the supplied Authorization header never reaches the protected file endpoint. This remains a separate problem even after CORS is fixed, so a locally previewed send can look successful but fail after reload or reconciliation.
    - **Fix:** On web, fetch the image through the existing authenticated `fileApi.getFile()` helper and render its base64 data URI, with session-safe caching/cleanup. Do not put passwords in URLs or make private downloads public as a workaround.
    - **If we skip it:** Stored photo bubbles and fullscreen previews fail for browser users.

14. **[P2] Production web export succeeds but produces no HTML page**
    (`app.json:L22-25,L36`; `package.json:L3`; `index.js:L1-8`; `App.js:L45-48`) — **Tooling result**
    - **What this is:** The project requests Expo's static web output, which is supposed to export pages that a web host can serve.
    - **Problem:** A production web export completed with bundles/assets but zero `.html` files, including no `index.html`. The entry point registers the custom `App` and React Navigation tree rather than Expo Router routes, despite the static-output/router configuration; the saved export was checked recursively.
    - **Fix:** Complete the Expo Router entry/routes setup required by the selected static output, moving shared providers into its root layout. Require an actual exported HTML entry page in the deployment check; a successful bundling exit code is insufficient.
    - **If we skip it:** Publishing the export directory alone does not publish a usable website; the earlier temporary test HTML shell was only a test workaround.

15. **[P2] A DM recipient sees their own name as the chat title**
    (`backend/src/conversation/conversation.service.ts:L89-94`; `src/screens/ChatListScreen.js:L46-58,L111-116`) — **Source/mock**
    - **What this is:** A DM title should identify the other person from the current user's perspective.
    - **Problem:** When Alice starts a DM with Bob, the stored name becomes `[DM] Bob`; Bob's list prioritizes that name and also displays `[DM] Bob`, not Alice. Source-based title checks reproduced this, and opening that list item passes the same wrong title to the chat header.
    - **Fix:** For DMs, resolve the other participant before falling back to the stored name. Keep stored names for groups; the existing user lookup already supports the DM calculation.
    - **If we skip it:** Recipients see misleading contacts and can open the wrong-looking chat.

16. **[P2] New-chat failures are invisible on web**
    (`src/screens/NewChatScreen.js:L61-63,L80-87,L105-107`; `src/screens/ChatRoomScreen.js:L661-678`) — **App and installed React Native Web source reviewed**
    - **What this is:** Starting a DM or creating a group reports validation/request errors using `Alert.alert()`.
    - **Problem:** The installed React Native Web `Alert.alert()` implementation is an empty function. A rejected conversation request consequently returns the user to the screen without an explanation; group validation alerts are also invisible.
    - **Fix:** Show those errors inline, or use the same explicit web/native alert pattern already used in `ChatRoomScreen.js`. Cover both DM and group actions.
    - **If we skip it:** Browser users cannot tell why starting a conversation failed or what to correct.

## Should fix

17. **[P1] Dependency security advisories need triage before release**
    (`package-lock.json`; `backend/package-lock.json`) — **Tooling result; runtime exploitability unverified**
    - **What this is:** `npm audit --omit=dev --json` checks the locked dependency trees against published security advisories.
    - **Problem:** The frontend scan reported **33 affected packages: 27 high, 6 moderate**; the backend reported **7: 5 high, 2 moderate**, including the Express/Multer and Prisma dependency paths. These counts include transitive tooling or unused code paths and are not 40 independently demonstrated application exploits.
    - **Fix:** Review which advisory paths are reachable, then apply compatible targeted updates and rerun builds/tests/audits. Do not blindly run `npm audit fix --force`: proposed frontend fixes included incompatible Expo 52 and React Native 0.83 downgrades.
    - **If we skip it:** Known dependency risks remain unassessed, while an indiscriminate forced fix can break the SDK-compatible app.

18. **[P2] Installed packages do not match Expo SDK 58's expected versions**
    (`package.json:L12-31`; `package-lock.json`) — **Tooling result; no specific device regression reproduced**
    - **What this is:** Expo's version check identifies packages expected to work together for the installed SDK.
    - **Problem:** The compatibility check exited with code 1 and listed **13 mismatches**, including installed Expo `58.0.22` versus `~58.0.26` and React Native `0.88.0` versus `0.88.1`. Passing JavaScript checks does not establish native compatibility for that combination.
    - **Fix:** Align packages using Expo's SDK-aware installer, then rerun compatibility checks and rebuild/test the native app. Keep this separate from forced npm security fixes.
    - **If we skip it:** Native builds or device behavior can fail in ways the current frontend tests do not exercise.

19. **[P2] Repeated message polling lacks a supporting database index**
    (`backend/prisma/schema.prisma:L38-52`; `backend/src/message/message.service.ts:L21-25`; `src/api/hooks.ts:L106-123`) — **Schema/load risk; no live query-plan or load measurement**
    - **What this is:** Every open chat requests messages by `conversationId`, sorted by `createdAt`, every three seconds.
    - **Problem:** The schema declares no index supporting that filter/sort, so a database created only from this schema has no matching compound index as its message collection grows. Multiple open chats repeatedly pay that cost; indexes that may have been added manually to a live database were not inspected.
    - **Fix:** Add and apply the supporting message index, such as `@@index([conversationId, createdAt])`, then check the actual database query plan with representative history.
    - **If we skip it:** Growing chat history can make polling slow and increase database load; the size at which this becomes noticeable is not measured.

20. **[P2] Passing checks miss the authentication and backend failures above**
    (`tests/apiFetch.test.mjs`; `tests/messageOutbox.test.mjs`; `tests/theme.test.mjs`; `tsconfig.json:L11-17`; `package.json:L39-46`; `backend/package.json:L8-18`) — **Test/configuration review**
    - **What this is:** The existing 21 tests cover the frontend HTTP client, outbox, and theme, not backend permissions or the real `AuthProvider` lifecycle.
    - **Problem:** All 21 tests pass while the outsider access, password bypass, and session races above still reproduce. Frontend typechecking includes only TS/TSX and excludes the backend, leaving the JS screens/auth context and backend outside that successful result.
    - **Fix:** Add small regression tests for outsider reads/writes, missing-password rejection, concurrent creation, and late login after logout/server changes. Run the backend's own build/typecheck and appropriate JS checks alongside the existing frontend suite; no wholesale rewrite to TypeScript is required.
    - **If we skip it:** Security and account-state regressions can continue to pass the project's normal checks.

## Checks performed and their limits

| Check | Result |
| --- | --- |
| `CI=1 npm run lint` | Passed. |
| `npm exec -- eslint App.js index.js src --no-cache` | Passed, including JS frontend files. |
| `npm run typecheck` | Passed for the configured frontend TS/TSX scope only. |
| `npm test` | Passed all 21 existing tests. |
| Temporary source-based assertions | Reproduced the permission/password gaps, creation races, server/login-state bugs, wrong DM title, file-as-image classification, and unfinished discarded response streams. Not committed as regression tests. |
| `CI=1 npm exec -- expo install --check` | Failed: 13 SDK compatibility mismatches. No packages changed. |
| Frontend `npm audit --omit=dev --json` | 33 affected packages: 27 high, 6 moderate. |
| Backend `npm audit --omit=dev --json` | 7 affected packages: 5 high, 2 moderate. Lockfile scan, not a running-backend exploit test. |
| Native configuration introspection | Completed; inspected cleartext/transport settings. Not a native build or device test. |
| Production web export to a temporary directory | Export command completed, but recursive inspection found zero HTML files. |
| Backend TypeScript build check | **Unverified.** Backend dependencies were not installed; the attempted check picked up frontend TypeScript 6 and stopped on `TS5101` for `baseUrl`. This does not prove failure with the backend's intended compiler/dependencies. |

Expo recommendations were checked against the [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/), [Router installation](https://docs.expo.dev/router/installation.md), and [static-rendering documentation](https://docs.expo.dev/router/web/static-rendering.md).

**Verdict:** Fix conversation permissions and password authentication first, then session isolation and unsafe deployment defaults, before building the planned features.

**Not checked:** A live NestJS/MongoDB deployment, native release builds/devices, real load/query plans, actual deployed credentials/network exposure, and whether individual dependency advisories are exploitable in this app. No fixes were made; the existing `.gitignore` change and `ChatApp_Project_Report.docx` were left untouched.
