/**
 * Public legal URLs — update GITHUB_REPO if you fork or rename the repository.
 * Play Console requires PRIVACY_POLICY_URL to be a public HTTPS page before submission.
 */
export const GITHUB_REPO = "https://github.com/Dead-Stone/lm-link";

/** Pre-production APKs — publish preview builds from `builds/` here before Play Store. */
export const GITHUB_RELEASES_URL = `${GITHUB_REPO}/releases/latest`;

/** Public site — enable GitHub Pages: Settings → Pages → branch `master`, folder `/docs`. */
export const GITHUB_PAGES_BASE = "https://dead-stone.github.io/lm-link";

export const PRIVACY_POLICY_URL = `${GITHUB_PAGES_BASE}/`;

/** Public install one-pager — GitHub Pages `docs/install.html`. */
export const INSTALL_PAGE_URL = `${GITHUB_PAGES_BASE}/install.html`;

export const THIRD_PARTY_NOTICES_URL = `${GITHUB_PAGES_BASE}/THIRD_PARTY_NOTICES.html`;

export const SOURCE_CODE_URL = GITHUB_REPO;

export const LM_STUDIO_TRADEMARK_DISCLAIMER =
  "LM Link is an independent mobile client. It is not affiliated with, endorsed by, or sponsored by LM Studio or Element Labs Inc. LM Studio is a trademark of its respective owner.";

export const APP_LEGAL_FOOTER =
  "LM Link app source is licensed under MIT. Bundled libraries and downloaded model weights are subject to their own licenses.";
