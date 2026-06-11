# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**LM Link** is a free, open-source Android client for [LM Studio](https://lmstudio.ai). It allows chatting with language models either remotely (over Wi‑Fi from your Mac/PC) or locally on-device via GGUF models using [llama.rn](https://github.com/mybigday/llama.rn).

**Tech stack:** Expo SDK 54 · React Native · expo-router · llama.rn · React Context · AsyncStorage · expo-secure-store

## Build & development commands

```bash
npm install              # Install dependencies + apply patches (via patch-package)

# Development
npx expo start --lan    # Start dev server on local network (default)
npx expo start --localhost  # Start on localhost only (for web testing)
npm run android         # Build and run on connected device/emulator (native build with llama.rn)

# APK/AAB builds
npm run build:apk:local:debug  # Development APK (local build)
npm run build:apk:local        # Preview APK (local build)
npm run build:aab:local        # Production AAB (local build, generates `builds/`)
npm run build:aab              # Production AAB (EAS Cloud build)

# Asset generation
npm run compose:assets         # Regenerate brand icons and readme hero GIF
npx tsc --noEmit              # Type-check (must pass before PR)
```

**Testing the app:**

- **Quick UI test** (remote chat only): Use Expo Go. Scan the QR code from `npx expo start`.
- **Full features** (on-device models, camera, network scan): Use `npm run android` for a native dev build.

## Architecture & file structure

```
lm-link/
├── app/                     # Screens (expo-router) — navigation, routing
│   ├── _layout.tsx          # Root layout with providers (Settings, Conversations contexts)
│   ├── index.tsx            # Home screen (conversations list or setup)
│   ├── onboarding.tsx       # First-launch experience
│   ├── tutorial.tsx         # Interactive setup guide
│   ├── about.tsx            # About & credits
│   └── chat/                # Chat screens
│       ├── [id].tsx         # Active chat with streaming
│       └── _layout.tsx      # Chat stack navigator
│
├── components/              # UI components (reusable, rendered by screens)
│   ├── ChatModelPicker.tsx  # Model selection in chat footer
│   ├── ModelLibraryModal.tsx    # Browse, search, download models
│   ├── ModelPicker.tsx          # Model selector (remote or on-device)
│   ├── LocalModelsSection.tsx   # On-device GGUF model management
│   ├── SettingsPanel.tsx        # Settings UI
│   ├── ConversationsPanel.tsx   # Conversation list & new chat
│   ├── FirstLaunchTutorial.tsx  # Onboarding component
│   ├── SetupGuideModal.tsx      # Connection setup instructions
│   └── [other UI components]
│
├── lib/                     # Shared logic & utilities
│   ├── context.tsx          # Settings + Conversations React contexts
│   ├── types.ts             # TypeScript interfaces (Conversation, Settings, etc.)
│   ├── storage.ts           # AsyncStorage & secure-store wrappers
│   ├── auth.ts              # Hugging Face account handling
│   ├── api.ts               # LM Studio API + network discovery
│   ├── chat-request.ts      # Streaming chat requests to LM Studio or llama.rn
│   ├── chat-mode.ts         # Infer remote/local mode from conversations
│   ├── chat-navigation.ts   # Recent-chat lookup, missing-id route resolution
│   ├── new-chat-init.ts     # Default model for new chats (recent → settings)
│   ├── chat-model-ensure.ts # Remote model memory-ensure cache helpers
│   ├── local-storage-usage.ts # On-device model bytes + installed counts
│   ├── local-models.ts      # On-device GGUF models (list, load, infer)
│   ├── remote-model-library.ts  # Hugging Face model catalog API
│   ├── local-model-download-store.ts  # Download management for on-device models
│   ├── library-search.ts    # Model search/filter logic
│   ├── setup-guide.ts       # Connection guide copy & illustrations
│   ├── image-attachments.ts # Vision attachment processing
│   └── [other utilities]
│
├── plugins/                 # Expo config plugins
│   └── withLocalNetworkAccess.js  # Android local network permission
│
├── patches/                 # patch-package overrides (applied on npm install)
├── docs/                    # Legal docs (PRIVACY.md, THIRD_PARTY_NOTICES.md)
├── scripts/                 # Build helpers, asset generators
│   ├── build-android-local.sh   # Gradle build wrapper
│   ├── compose-readme-hero.mjs  # Generate hero GIF
│   ├── compose-brand-icons.mjs  # Generate brand SVGs
│   └── install-llama-rn.js      # Install llama.rn for EAS builds
│
├── assets/                  # Icons, images, Lottie JSON
├── app.config.js            # Expo app config (permissions, plugins, build profiles)
├── eas.json                 # EAS Build profiles
├── tsconfig.json            # TypeScript strict mode config
└── package.json             # Dependencies, build scripts
```

## Key architectural patterns

### State management

Two React contexts (`lib/context.tsx`) manage global state:

1. **SettingsContext** — app settings, connection URL, auth token, account info
2. **ConversationsContext** — chat history, active conversation, message creation

Both are provided at the app root (`app/_layout.tsx`). Use `useSettings()` and `useConversations()` hooks throughout.

### Storage

- **AsyncStorage** — Conversations, settings (non-sensitive)
- **expo-secure-store** — HF API tokens, LM Studio connection tokens

See `lib/storage.ts` for all storage operations. Always use the wrappers, not AsyncStorage directly, for consistency.

### Chat & streaming

1. User sends a message in `app/chat/[id].tsx`
2. Request flows through `lib/chat-request.ts` → either:
   - **Remote** → `lib/api.ts` (HTTP to LM Studio) with streaming chunks
   - **Local** → `lib/local-models.ts` (llama.rn inference)
3. Streamed tokens are accumulated and rendered in real-time
4. **New chat** (`/chat/new`) uses `lib/new-chat-init.ts` to pick the recently used model or open Choose Model
5. **Navigation** after delete/stale id uses `lib/chat-navigation.ts`; mode markers live in `lib/chat-mode.ts`
6. **Remote ensure-load** on chat open is gated by `lib/chat-model-ensure.ts` (memory-loaded only, cache invalidates on eject)

### Models

**Remote models:** Loaded in LM Studio on your Mac/PC; the app connects via HTTP.

**On-device models (GGUF):** Downloaded from Hugging Face. Require a native build (`npm run android`). Managed by `lib/local-models.ts` and `lib/local-model-download-store.ts`.

### Model library

`components/ModelLibraryModal.tsx` provides:
- Search & filter Hugging Face GGUF models
- Download progress tracking
- Filtering by platform (macOS, Windows, Linux, Android)

Backed by `lib/remote-model-library.ts` (API calls) and `lib/library-search.ts` (client-side filter).

## Code style & requirements

- **TypeScript strict mode** — `npx tsc --noEmit` must pass before submitting a PR.
- **React Native stylesheets** — Use `StyleSheet.create()` for all styles. No inline style objects.
- **File organization**:
  - Components in `components/`, screens in `app/`, logic in `lib/`.
  - Keep components focused on rendering; move complex logic to `lib/`.
- **Naming** — Components are PascalCase, utilities are camelCase. Use descriptive, unambiguous names.
- **No comments** — except for non-obvious workarounds, subtle invariants, or constraints.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines. Before changing native config (permissions, plugins), read the [Expo versioned docs](https://docs.expo.dev/versions/v54.0.0/).

## Testing & validation

1. **Type-check** — `npx tsc --noEmit` (required for all PRs)
2. **Manual testing**:
   - For UI only: `npx expo start --lan` → scan QR in Expo Go
   - For native features (llama.rn, camera, network scan, local inference): `npm run android` on a connected device
3. **LM Studio setup** — To test remote mode, install LM Studio locally, load a model, enable **Local Network** + **CORS** in Developer settings, note the URL.

## Building for release

**Local build** (for Play Console upload):
```bash
npm run build:aab:local
# AAB written to builds/
```

**EAS Cloud build** (with more aggressive optimization):
```bash
npm run build:aab
# Requires EAS credentials
```

Post-install script (`scripts/eas-build-post-install`) handles asset generation and native config on EAS.

## Legal & docs

If your change touches **permissions, data storage, networking, or bundled libraries**, update:

- [docs/PRIVACY.md](docs/PRIVACY.md) — If you add new data flows or permissions
- [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) — If you add/update dependencies

Check the app's **About → Privacy Policy** and **Open Source Licenses** screens to see what users see.

## Common development flows

### Adding a new chat feature
1. Decide: send to remote (`lib/api.ts` → LM Studio) or local (`lib/local-models.ts` → llama.rn)?
2. Update `lib/chat-request.ts` to support the new message type.
3. Update the chat screen (`app/chat/[id].tsx`) to render or trigger the feature.
4. Add state to `Conversation` type if needed.

### Adding a settings option
1. Add the field to `Settings` type (`lib/types.ts`).
2. Add a UI control to `components/SettingsPanel.tsx`.
3. Wire it to `updateSettings()` in the SettingsContext.

### Adding on-device model support
1. Implement download logic in `lib/local-model-download-store.ts`.
2. Update `lib/local-models.ts` to list or load the new format.
3. Ensure a native build runs (`npm run android`); Expo Go cannot use llama.rn.

### Updating the setup guide
1. Edit copy in `lib/setup-guide.ts`.
2. Add Lottie/illustration assets if needed; reference them in the component.
3. Test on-device with `npm run android`.

## Environment & dependencies

- **Node 18+**
- **Android Studio / SDK** — For native builds and on-device model testing
- **LM Studio** — For testing remote connections
- **gifsicle** — For hero GIF regeneration (`brew install gifsicle`)

Patches under `patches/` are applied automatically on `npm install` via `postinstall` script.

## References & external docs

- **Expo SDK 54 docs** — https://docs.expo.dev/versions/v54.0.0/ (ALWAYS read versioned docs, not latest)
- **React Native** — https://reactnative.dev
- **llama.rn** — https://github.com/mybigday/llama.rn (on-device inference)
- **LM Studio API** — https://lmstudio.ai/docs
- **Hugging Face Hub API** — https://huggingface.co/docs/hub/api

## Debugging tips

- **Network issues** — Check `lib/api.ts` for connection logic; use `expo-network` to inspect local network state.
- **On-device inference fails** — Ensure a native build is running; Expo Go cannot use llama.rn. Check GGUF format compatibility.
- **Streaming hangs** — Check the AbortController in `lib/chat-request.ts`; ensure the request isn't stuck in buffering.
- **Storage issues** — Clear async storage via **Settings → About → Reset App** or manually via React DevTools in Expo.

## Running a test manually

Since this is a React Native app with no automated test suite, validation is manual:

1. Start dev server: `npx expo start --lan` or `npm run android`
2. Interact with the feature in the app
3. Verify the behavior matches expectations (check logs, UI, performance)
4. Test edge cases (network loss, large models, etc.)

For context on what the app does, see the [README](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
