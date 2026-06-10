import type { Ionicons } from "@expo/vector-icons";
import { APP_DISPLAY_NAME } from "./app-name";
import type { SetupGuideIllustrationId } from "../components/SetupGuideIllustrations";

export type SetupGuideStep = {
  icon: keyof typeof Ionicons.glyphMap;
  step: string;
  detail: string;
  bullets?: string[];
  illustration?: SetupGuideIllustrationId;
};

export type SetupGuideSection = {
  title: string;
  steps: SetupGuideStep[];
};

export const SETUP_GUIDE_SECTIONS: SetupGuideSection[] = [
  {
    title: "On your Mac",
    steps: [
      {
        icon: "cube-outline",
        step: "Load a model in LM Studio",
        detail: "Open the Chat tab, pick a model, and tap Load so it is ready to serve.",
        illustration: "lm-studio-load",
      },
      {
        icon: "code-slash-outline",
        step: "Open the Developer tab",
        detail: "In the left sidebar, tap the ↔ Developer icon (not the Chat tab).",
        illustration: "lm-studio-developer",
      },
      {
        icon: "play-circle-outline",
        step: "Start the local server",
        detail:
          "Turn on Serve on Local Network and Allow network access (CORS), then Start Server. Wait for the green running status.",
        bullets: [
          "Requires LM Studio 0.4 or newer",
          "Both Serve on Local Network and CORS must be enabled",
          "Default port is 1234",
        ],
        illustration: "lm-studio-server",
      },
      {
        icon: "copy-outline",
        step: "Copy the network address",
        detail: `LM Studio shows an address like http://192.168.1.5:1234. In ${APP_DISPLAY_NAME}, paste it with /v1 at the end.`,
        bullets: [
          "Example: http://192.168.1.5:1234/v1",
          "Use your Mac's Wi‑Fi IP — not localhost",
        ],
        illustration: "lm-studio-copy-url",
      },
    ],
  },
  {
    title: `In ${APP_DISPLAY_NAME}`,
    steps: [
      {
        icon: "wifi-outline",
        step: "Scan local network",
        detail: "Settings → Connection → Scan local network. Tap your Mac when it appears on the radar.",
        illustration: "lm-link-scan",
      },
      {
        icon: "link-outline",
        step: "Paste the connection string",
        detail: "Or enter the server URL manually — include /v1 and use the same IP shown in LM Studio.",
        illustration: "lm-link-connection",
      },
      {
        icon: "save-outline",
        step: "Test and save",
        detail: "Tap Test Connection to verify, then Save to store the connection string on your phone.",
        bullets: ["Green check means the server responded"],
        illustration: "lm-link-save",
      },
      {
        icon: "key-outline",
        step: "Add an API token if needed",
        detail: "Settings → Connection → Advanced keys. Paste a token from LM Studio → Developer → Manage Tokens.",
        bullets: ["Required when authentication is enabled on your Mac"],
        illustration: "lm-link-token",
      },
      {
        icon: "chatbubble-outline",
        step: "Start chatting",
        detail: "Open a new chat and choose a model from the footer picker.",
        illustration: "lm-link-chat",
      },
    ],
  },
];

export const SETUP_TROUBLESHOOTING = [
  {
    icon: "home-outline" as const,
    title: "Same Wi‑Fi",
    detail: "Phone and Mac must be on the same network. VPNs and guest networks often block discovery.",
  },
  {
    icon: "globe-outline" as const,
    title: "Use the LAN IP",
    detail: "Paste 192.168.x.x (or 10.x.x.x), never localhost or 127.0.0.1 — that only works on the Mac itself.",
  },
  {
    icon: "shield-outline" as const,
    title: "Firewall",
    detail: "If Test fails, allow incoming connections for LM Studio in macOS System Settings → Network → Firewall.",
  },
  {
    icon: "checkmark-done-outline" as const,
    title: "CORS enabled",
    detail:
      "In LM Studio → Developer → Local Server, turn on Allow network access from any device (CORS) along with Serve on Local Network.",
  },
];

export type TutorialSlideKind = "welcome" | "guide" | "connect" | "finish";

export type TutorialSlide = {
  kind: TutorialSlideKind;
  section?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  bullets?: string[];
  illustration?: SetupGuideIllustrationId;
  /** What the Android guide sprite says — walk the user through this step. */
  androidWalk: string;
  /** Short tip below the guide speech. */
  help: string;
};

/** Shown atop the first tutorial slide (replaces the old welcome page). */
export const TUTORIAL_WELCOME_INTRO = {
  title: `Welcome to ${APP_DISPLAY_NAME}`,
  detail: "Chat with models on your Mac or PC from this phone — private, on your Wi‑Fi.",
};

/** First-launch / replay tutorial — one slide per setup-guide screenshot. */
export const FIRST_LAUNCH_SLIDES: TutorialSlide[] = [
  {
    kind: "welcome",
    section: "Welcome",
    icon: "cube-outline",
    title: TUTORIAL_WELCOME_INTRO.title,
    detail: TUTORIAL_WELCOME_INTRO.detail,
    androidWalk:
      "Hi! I'm your guide — I'll help you talk to LM Studio on your Mac or PC, right from this phone.\n\nFirst up: open LM Studio in your Windows PC, select a model in Chat, and tap Load. I'll wait here while you get set up!",
    help: "Keep your phone and computer on the same Wi‑Fi. The model must be loaded before the server can chat.",
    illustration: "lm-studio-load",
  },
  {
    kind: "guide",
    section: "Step 2 · Mac",
    icon: "code-slash-outline",
    title: "Open the Developer tab",
    detail: "In the left sidebar, tap the ↔ Developer icon (not the Chat tab).",
    androidWalk:
      "Next, tap the ↔ Developer icon in LM Studio's left sidebar — not Chat. That's where the server controls live.",
    help: "Developer is separate from Chat. Look for the swap-arrows icon.",
    illustration: "lm-studio-developer",
  },
  {
    kind: "guide",
    section: "Step 3 · Mac",
    icon: "play-circle-outline",
    title: "Start the local server",
    detail:
      "Turn on Serve on Local Network and Allow network access (CORS), then Start Server. Wait for the green running status.",
    bullets: [
      "Requires LM Studio 0.4 or newer",
      "Enable Serve on Local Network and CORS",
      "Default port is 1234",
    ],
    androidWalk:
      "In Developer → Local Server, turn on Serve on Local Network and Allow network access (CORS), then tap Start Server. Wait for the green running light!",
    help: "Both toggles must be on — CORS lets your phone reach the server. Port is usually 1234.",
    illustration: "lm-studio-server",
  },
  {
    kind: "guide",
    section: "Step 4 · Mac",
    icon: "copy-outline",
    title: "Copy the network address",
    detail: `LM Studio shows an address like http://192.168.1.5:1234. In ${APP_DISPLAY_NAME}, paste it with /v1 at the end.`,
    bullets: [
      "Example: http://192.168.1.5:1234/v1",
      "Use your Mac's Wi‑Fi IP — not localhost",
    ],
    androidWalk:
      "Copy the network address LM Studio shows — like http://192.168.1.5:1234. In this app we'll add /v1 at the end.",
    help: "Use the Wi‑Fi IP, not localhost or 127.0.0.1.",
    illustration: "lm-studio-copy-url",
  },
  {
    kind: "guide",
    section: "Step 5 · Android",
    icon: "wifi-outline",
    title: "Scan local network",
    detail: "Settings → Connection → Scan local network. Your Mac appears on the radar when found.",
    androidWalk:
      "Your turn! Open Settings → Connection, then tap Scan local network. I'll find your Mac on Wi‑Fi — tap it to fill the connection string.",
    help: "Devices pop up while scanning. You can tap one even before the scan finishes.",
    illustration: "lm-link-scan",
  },
  {
    kind: "guide",
    section: "Step 6 · Android",
    icon: "link-outline",
    title: "Paste the connection string",
    detail: "Or type the server URL yourself — include /v1 and use the same IP shown in LM Studio.",
    androidWalk:
      "Paste the connection string from your Mac — include /v1 at the end, like http://192.168.1.5:1234/v1.",
    help: "Same Wi‑Fi IP as LM Studio. Never use localhost on your phone.",
    illustration: "lm-link-connection",
  },
  {
    kind: "guide",
    section: "Step 7 · Android",
    icon: "save-outline",
    title: "Test and save",
    detail: "Tap Test Connection to verify, then Save to store the connection string.",
    androidWalk:
      "Tap Test to make sure it works, then Save. That stores your connection string so you don't have to enter it again.",
    help: "A green check on Test means your Mac responded. Save before you leave Settings.",
    illustration: "lm-link-save",
  },
  {
    kind: "guide",
    section: "Step 8 · Android",
    icon: "key-outline",
    title: "Add an API token if needed",
    detail: "Settings → Connection → Advanced keys. Paste a token from LM Studio → Developer → Manage Tokens.",
    bullets: ["Required when authentication is enabled on your Mac"],
    androidWalk:
      "If your Mac asks for a token, open Advanced keys and paste one from LM Studio → Developer → Manage Tokens.",
    help: "Skip this if your Mac server doesn't require authentication.",
    illustration: "lm-link-token",
  },
  {
    kind: "finish",
    section: "All done",
    icon: "chatbubble-outline",
    title: "Chat away",
    detail: "You're set up — open a new chat and talk to your Mac's models over Wi‑Fi.",
    androidWalk:
      "All done! Tap the check to finish, then chat away — open a new chat and pick a model from the bar at the bottom.",
    help: "Your Mac does the thinking; your phone is the remote. No models yet? Refresh in Settings → Model Library.",
    illustration: "lm-link-chat",
  },
];
