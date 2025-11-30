/**
 * TypeScript type definitions for Truthy
 */

export type Speaker = 'A' | 'B';

export type VerdictLabel =
  | 'True'
  | 'Mostly True'
  | 'Mixed'
  | 'Mostly False'
  | 'False'
  | 'Unverifiable';

export interface Source {
  name: string;
  url: string;
  as_of: string; // ISO date or date string like "2025-09-30"
}

export interface Verdict {
  id?: string;
  speaker: Speaker;
  claim: string;
  label: VerdictLabel;
  confidence: number; // 0.0 to 1.0
  rationale: string;
  sources: Source[];
  timestamp?: number; // ms since session start
}

export interface Transcript {
  id?: string;
  speaker: Speaker;
  text: string;
  timestamp: number; // ms since session start
}

export interface Evidence {
  id?: string;
  publisher: string;
  url: string;
  as_of: string;
  snippet: string;
  alignment: 'supports' | 'contradicts' | 'neutral';
  score: number; // 0.0 to 1.0, retrieval confidence
  tier?: 'primary' | 'secondary' | 'analysis' | 'any';
}

export interface Claim {
  id: string;
  session_id: string;
  speaker: Speaker;
  ts_ms: number;
  raw_text: string;
  normalized?: {
    topic?: string;
    location?: string;
    timeframe?: string;
    quantity?: {
      value: number;
      unit: string;
      direction?: 'increase' | 'decrease' | null;
    };
  };
  checkworthy: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface Session {
  id: string;
  started_at: Date;
  ended_at?: Date;
}

// Tool request/response types
export interface SearchVectaraRequest {
  query: string;
  top_k?: number;
  freshness_days?: number;
  filters?: {
    publisher_tier?: 'primary' | 'secondary' | 'analysis' | 'any';
  };
}

export interface SearchVectaraResponse {
  items: Evidence[];
}

export interface SearchWebRequest {
  query: string;
  top_k?: number;
  recency_days?: number;
  allowlist?: string[];
}

export interface SearchWebResponse {
  items: Evidence[];
}

export interface ContextCheckRequest {
  claim: string;
  expected?: {
    metric?: string;
    location?: string;
    timeframe?: string;
  };
}

export interface ContextCheckResponse {
  ok: boolean;
  warnings: string[];
  notes?: string;
}

// Hook state types
export interface DebateCoreState {
  isRecording: boolean;
  isConnectedA: boolean;
  isConnectedB: boolean;
  activeSpeaker: Speaker;
  transcripts: Transcript[];
  verdicts: Verdict[];
  currentTranscriptionA: string;
  currentTranscriptionB: string;
  audioLevelA: number;
  audioLevelB: number;
  isPlayingA: boolean;
  isPlayingB: boolean;
  status: string;
  error: string;
  debugMode: boolean;
  /** Video element from current media source (null for microphone) */
  videoElement: HTMLVideoElement | null;
  /** Type of current media source (microphone, file, youtube, screen) */
  mediaSourceType: string;
}

export interface DebateCoreActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  setActiveSpeaker: (speaker: Speaker) => void;
  reset: () => void;
  toggleDebugMode: () => void;
  sendTextInput: (text: string) => void;
}
