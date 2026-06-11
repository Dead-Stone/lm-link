# Build artifacts

Local Android builds are written here by:

```bash
npm run build:apk:local        # preview APK → builds/lm-link-preview-v*.apk
npm run build:apk:local:debug  # development APK
npm run build:aab:local        # production AAB → builds/lm-link-production-v*.aab
```

Files are named:

`lm-link-{profile}-v{version}-{YYYYMMDD-HHMMSS}.{apk|aab}`

This folder is gitignored.

## Distribution

| Channel | Artifact | Where |
|--------|----------|--------|
| **Pre-production** (testers) | Preview APK | [GitHub Releases](https://github.com/Dead-Stone/lm-link/releases) — tag e.g. `v1.0.0-preview.1`, attach `lm-link-preview-*.apk` |
| **Production** | AAB | Google Play Console — upload `lm-link-production-*.aab` from here or EAS |

**Pre-production flow:** build locally → create a GitHub Release → upload the preview APK → share [install.html](https://dead-stone.github.io/lm-link/install.html).

Cloud builds (`npm run build:aab`) download from the EAS dashboard; copy them here if you want a local archive.
