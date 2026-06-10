export type Role = "user" | "assistant" | "system";

export type MessageType = "chat" | "model_change";

export type ChatModelMode = "remote" | "local";

/** Where inference runs: Hub cloud, local Mac/PC, or on-device phone. */
export type ModelPlatform = "hub" | "pc" | "phone";

export interface MessageStats {
  tokensPerSec: number;
  totalTokens: number;
  timeToFirstTokenMs: number;
  totalTimeMs: number;
}

export interface MessageImage {
  uri: string;
  mimeType: string;
  filename: string;
  /** In-memory only — stripped before persistence; resolved from uri at send time. */
  base64?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  type?: MessageType;
  modelLabel?: string;
  modelMode?: ChatModelMode;
  stats?: MessageStats;
  images?: MessageImage[];  // attached images (stored alongside content)
}

export function isChatMessage(m: Message): boolean {
  return m.type !== "model_change";
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  /** On-device catalog key when this chat uses local inference. */
  localModelKey?: string;
  systemPrompt?: string;
}

export interface ConnectionProfile {
  id: string;
  name: string;       // e.g. "Home", "Work", "Cloud"
  url: string;        // e.g. "http://192.168.1.10:1234/v1"
  apiKey?: string;    // optional Bearer token for LM Studio Pro / cloud
  isCloud?: boolean;  // true = LM Studio cloud endpoint
  createdAt: number;
}

export interface Settings {
  baseUrl: string;
  defaultModel: string;
  defaultLocalModel: string;
  defaultSystemPrompt: string;
  temperature: number;
  maxTokens: number;
  theme: "dark" | "light";
  apiKey?: string;              // active profile's API key (if any)
  localServerUrl?: string;      // Mac LAN URL for model download/load (when using Hub for chat)
  /** Unload other models on Mac before loading a new one (default: true). */
  singleModelMode?: boolean;
  activeProfileId?: string;     // which ConnectionProfile is active
  connectionProfiles?: ConnectionProfile[];
}

export interface LMModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  // LM Studio extras
  max_context_length?: number;
  arch?: string;
  type?: string;
  publisher?: string;
  quantization?: string;
  state?: string;
  compatibility_type?: string;
  format?: string;
  size_bytes?: number;
  params_string?: string;
}

export interface ModelDownloadJob {
  job_id: string;
  status: string;
  total_size_bytes?: number;
  downloaded_bytes?: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface ModelLoadResult {
  status: string;
  instance_id?: string;
  type?: string;
  load_time_seconds?: number;
  error?: string;
}

export interface LMModelsResponse {
  object: string;
  data: LMModel[];
}
