# LM Link for Android

**A free, open-source mobile client for [LM Studio](https://lmstudio.ai)**

LM Link connects your Android phone to LM Studio on your Mac or PC over Wi‑Fi, streams chat from your loaded models, and can run quantized GGUF models on-device via [llama.cpp](https://github.com/ggerganov/llama.cpp) (through [llama.rn](https://github.com/mybigday/llama.rn)).

> **Disclaimer:** LM Link is an independent project and is not affiliated with, endorsed by, or sponsored by LM Studio or Element Labs Inc.

---

## Features

- **Streaming chat** — token-by-token replies with live speed and usage stats
- **Model library** — browse, search, and download models for Mac/PC and on-device
- **On-device inference** — run GGUF models locally (native build required)
- **Vision attachments** — send photos to vision-capable remote models
- **Network scan** — discover LM Studio on your local Wi‑Fi
- **Conversation history** — chats stored on your device
- **Saved connections** — store server URLs and optional API tokens

---

## Screenshots

*Add Play Store / README screenshots before public launch.*

---

## Getting started

### Prerequisites

- Node 18+
- [LM Studio](https://lmstudio.ai) 0.4+ on a Mac, PC, or Linux machine (for remote chat)
- Android device on the same Wi‑Fi network as your computer (for local discovery)

### Install & run

```bash
git clone https://github.com/Dead-Stone/lm-link.git
cd lm-link
npm install   # applies patches/ via postinstall (patch-package)
npx expo start
```

| Build | Command | Output |
|-------|---------|--------|
| Expo Go | Scan QR from `expo start` | Remote chat only — no on-device models |
| Android (full) | `npm run android` or `npx expo run:android` | Required for on-device inference |
| Preview APK (local) | `npm run build:apk:local` | `builds/lm-link-preview-v*.apk` |
| Production AAB (local) | `npm run build:aab:local` | `builds/lm-link-production-v*.aab` |
| Production AAB (cloud) | `npm run build:aab` | Download from [EAS dashboard](https://expo.dev) |

### Connect to LM Studio

**On your computer (LM Studio 0.4+):**

1. Load a model in LM Studio.
2. Open the **Developer** tab in the sidebar.
3. Enable **Serve on Local Network** and **Allow network access from any device (CORS)**.
4. Start the server (default port `1234`).
5. Copy the network address, e.g. `http://192.168.1.5:1234/v1`.

**On your phone (LM Link):**

1. Open **Settings → Connection**.
2. Tap **Scan local network** or paste the server URL manually.
3. **Test Connection**, then **Save**.
4. Start a chat and pick a model from the footer picker.

The in-app **Setup Guide** (Settings) walks through each step with illustrations.

**Troubleshooting:** phone and computer must be on the same Wi‑Fi; use the LAN IP (not `localhost`); allow LM Studio through the firewall if the test fails.

---

## Play Store release

| Item | Value |
|------|--------|
| Package | `com.lmlink.android` |
| Privacy policy | [docs/PRIVACY.md](docs/PRIVACY.md) |
| Third-party notices | [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) |
| Build | `npm run build:aab` or `npm run build:aab:local` |
| Output | `builds/lm-link-production-v*.aab` (local) |

Before submitting to [Google Play Console](https://play.google.com/console):

1. Confirm `PRIVACY_POLICY_URL` in [`lib/legal.ts`](lib/legal.ts) matches your public repo URL.
2. Host the repo (or mirror `docs/PRIVACY.md` on your site) so the privacy URL is reachable without login.
3. Configure EAS credentials: `eas credentials` (production keystore).
4. Upload the `.aab`, complete the Data safety form (local storage, network, optional camera/photos), and add store assets.

---

## Legal & privacy

| Document | Location |
|----------|----------|
| License (MIT) | [LICENSE](LICENSE) |
| Privacy policy | [docs/PRIVACY.md](docs/PRIVACY.md) |
| Third-party notices | [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) |
| Security | [SECURITY.md](SECURITY.md) |

In the app: **Settings → Privacy Policy** and **About → Open Source Licenses**.

---

## Tech stack

| Layer | Library |
|-------|---------|
| Framework | Expo SDK 54 / React Native |
| Navigation | expo-router |
| On-device inference | llama.rn → llama.cpp |
| Storage | AsyncStorage, expo-secure-store, expo-file-system |
| Lists | @shopify/flash-list |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and feature requests welcome via GitHub Issues.

---

## Contact

**Mohana Moganti** — [mohanmoganti2023@gmail.com](mailto:mohanmoganti2023@gmail.com)

---

## License

MIT — see [LICENSE](LICENSE). Third-party components and downloaded model weights are subject to their own licenses — see [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).
