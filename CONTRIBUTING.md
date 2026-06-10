# Contributing to LM Link

Thanks for your interest in contributing!

## Development setup

```bash
git clone https://github.com/Dead-Stone/lm-link.git
cd lm-link
npm install
npx expo start
```

`npm install` reads `package.json` and runs `postinstall` (`patch-package`) to apply patches under `patches/`.

For native features (on-device inference, camera, local network scan), use a dev build:

```bash
npm run android
# or
npx expo run:android
```

## Code style

- **TypeScript strict** — `npx tsc --noEmit` must pass
- **StyleSheet.create** for styles — no inline style objects
- Components in `components/`, screens in `app/`, shared logic in `lib/`
- Read [AGENTS.md](AGENTS.md) for Expo SDK version docs before changing native config

## Pull requests

1. Fork the repo and branch from `main`: `git checkout -b feat/my-feature`
2. Make changes; ensure `npx tsc --noEmit` passes
3. Test on Android (and iOS if your change touches shared native behavior)
4. Open a PR with a clear description of what changed and why

## Legal docs

If your change affects permissions, data storage, networking, or bundled libraries, update:

- [docs/PRIVACY.md](docs/PRIVACY.md)
- [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md)

## Reporting issues

Use GitHub Issues. Include Expo SDK version, Android version, LM Studio version, and steps to reproduce.

For security vulnerabilities, see [SECURITY.md](SECURITY.md) — please report privately by email.
