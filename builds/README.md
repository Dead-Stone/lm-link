# Build artifacts

Local Android builds are written here by:

```bash
npm run build:apk:local        # preview APK → builds/lm-link-preview-v*.apk
npm run build:apk:local:debug  # development APK
npm run build:aab:local        # production AAB → builds/lm-link-production-v*.aab
```

Files are named:

`lm-link-{profile}-v{version}-{YYYYMMDD-HHMMSS}.{apk|aab}`

This folder is gitignored — upload artifacts to Play Console or distribute manually.

Cloud builds (`npm run build:aab`) download from the EAS dashboard; copy them here if you want a local archive.
