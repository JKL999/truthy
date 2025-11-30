/**
 * AudioSourceProvider - Abstract interface for all audio sources
 *
 * Provides a unified way to capture audio from different sources:
 * - Microphone (existing)
 * - Local files (MP4, MP3, WAV)
 * - YouTube streams
 * - Screen capture (Zoom, Meet, etc.)
 *
 * All sources output 16kHz mono PCM Float32Array for Gemini Live API compatibility.
 */

import { Speaker } from '@/types';

export type AudioSourceType = 'microphone' | 'youtube' | 'file' | 'screen';

export interface AudioSourceConfig {
  /** Target sample rate (default: 16000 for Gemini) */
  sampleRate: number;
  /** Number of channels (default: 1 for mono) */
  channelCount: number;
  /** Buffer size for audio processing (default: 256) */
  bufferSize: number;
}

export const DEFAULT_AUDIO_CONFIG: AudioSourceConfig = {
  sampleRate: 16000,
  channelCount: 1,
  bufferSize: 256,
};

export interface AudioSourceEvents {
  /** Called when audio data is available */
  onAudioData: (pcmData: Float32Array, speaker?: Speaker) => void;
  /** Called when the source starts */
  onStart?: () => void;
  /** Called when the source stops */
  onStop?: () => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Called when playback ends (for file sources) */
  onEnded?: () => void;
}

export interface AudioSourceProvider {
  /** Type identifier for this source */
  readonly type: AudioSourceType;

  /** Whether the source is currently active/connected */
  readonly isActive: boolean;

  /** Current configuration */
  readonly config: AudioSourceConfig;

  /**
   * Connect and start the audio source
   * @param events - Event callbacks for audio data and lifecycle events
   */
  connect(events: AudioSourceEvents): Promise<void>;

  /**
   * Disconnect and stop the audio source
   */
  disconnect(): void;

  /**
   * Get the video element if this source has video (for file, YouTube, screen)
   * Returns null for audio-only sources like microphone
   */
  getVideoElement(): HTMLVideoElement | null;

  /**
   * Get the media element (video or audio) for playback control
   * Returns null for live sources like microphone
   */
  getMediaElement(): HTMLMediaElement | null;

  /**
   * Get total duration in seconds (for file sources)
   * Returns undefined for live sources
   */
  getDuration(): number | undefined;

  /**
   * Get current playback position in seconds (for file sources)
   * Returns undefined for live sources
   */
  getCurrentTime(): number | undefined;

  /**
   * Seek to a specific time in seconds (for file sources)
   * No-op for live sources
   */
  seek(time: number): void;

  /**
   * Pause playback (for file sources)
   * No-op for live sources
   */
  pause(): void;

  /**
   * Resume playback (for file sources)
   * No-op for live sources
   */
  resume(): void;

  /**
   * Get the audio context for this source
   */
  getAudioContext(): AudioContext | null;

  /**
   * Get the gain node for level monitoring
   */
  getGainNode(): GainNode | null;
}

/**
 * Base class with common functionality for audio sources
 */
export abstract class BaseAudioSource implements AudioSourceProvider {
  abstract readonly type: AudioSourceType;

  protected _isActive: boolean = false;
  protected _config: AudioSourceConfig;
  protected audioContext: AudioContext | null = null;
  protected gainNode: GainNode | null = null;
  protected events: AudioSourceEvents | null = null;

  constructor(config: Partial<AudioSourceConfig> = {}) {
    this._config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get config(): AudioSourceConfig {
    return this._config;
  }

  abstract connect(events: AudioSourceEvents): Promise<void>;
  abstract disconnect(): void;

  getVideoElement(): HTMLVideoElement | null {
    return null;
  }

  getMediaElement(): HTMLMediaElement | null {
    return null;
  }

  getDuration(): number | undefined {
    return undefined;
  }

  getCurrentTime(): number | undefined {
    return undefined;
  }

  seek(_time: number): void {
    // No-op for base class
  }

  pause(): void {
    // No-op for base class
  }

  resume(): void {
    // No-op for base class
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getGainNode(): GainNode | null {
    return this.gainNode;
  }

  /**
   * Initialize the audio context with the configured sample rate
   */
  protected async initAudioContext(): Promise<AudioContext> {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx({ sampleRate: this._config.sampleRate });
    this.audioContext = ctx;
    this.gainNode = ctx.createGain();
    return ctx;
  }

  /**
   * Clean up audio context resources
   */
  protected cleanupAudioContext(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.gainNode = null;
  }
}
