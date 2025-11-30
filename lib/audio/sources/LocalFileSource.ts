/**
 * LocalFileSource - Audio source for local media files
 *
 * Supports MP4, MP3, WAV, WebM, and other browser-supported formats.
 * Extracts audio at 16kHz mono PCM for Gemini Live API.
 */

'use client';

import {
  BaseAudioSource,
  AudioSourceConfig,
  AudioSourceEvents,
} from '../AudioSourceProvider';

export interface LocalFileSourceOptions extends Partial<AudioSourceConfig> {
  /** The media file to play */
  file: File;
  /** Whether to start playback immediately on connect (default: true) */
  autoplay?: boolean;
}

export class LocalFileSource extends BaseAudioSource {
  readonly type = 'file' as const;

  private file: File;
  private autoplay: boolean;
  private mediaElement: HTMLVideoElement | HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private objectUrl: string | null = null;

  constructor(options: LocalFileSourceOptions) {
    super(options);
    this.file = options.file;
    this.autoplay = options.autoplay ?? true;
  }

  async connect(events: AudioSourceEvents): Promise<void> {
    if (this._isActive) {
      return;
    }

    this.events = events;

    try {
      // Create object URL for the file
      this.objectUrl = URL.createObjectURL(this.file);

      // Determine if this is a video or audio file
      const isVideo = this.file.type.startsWith('video/') ||
                      this.file.name.match(/\.(mp4|webm|mkv|avi|mov)$/i);

      // Create appropriate media element
      if (isVideo) {
        const videoEl = document.createElement('video');
        videoEl.playsInline = true;
        this.mediaElement = videoEl;
      } else {
        this.mediaElement = document.createElement('audio');
      }

      this.mediaElement.src = this.objectUrl;
      this.mediaElement.crossOrigin = 'anonymous';

      // Wait for metadata to load
      await new Promise<void>((resolve, reject) => {
        if (!this.mediaElement) {
          reject(new Error('Media element not created'));
          return;
        }

        this.mediaElement.onloadedmetadata = () => resolve();
        this.mediaElement.onerror = () => reject(new Error('Failed to load media file'));
      });

      // Initialize audio context at 16kHz
      await this.initAudioContext();

      if (!this.audioContext || !this.gainNode || !this.mediaElement) {
        throw new Error('Failed to initialize audio context');
      }

      // Create source from media element
      this.sourceNode = this.audioContext.createMediaElementSource(this.mediaElement);
      this.sourceNode.connect(this.gainNode);

      // Create script processor for raw PCM access
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(
        this._config.bufferSize,
        this._config.channelCount,
        this._config.channelCount
      );

      this.scriptProcessorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this._isActive || !this.mediaElement || this.mediaElement.paused) return;

        const pcmData = e.inputBuffer.getChannelData(0);
        // Clone the data since the buffer may be reused
        const pcmDataCopy = new Float32Array(pcmData);
        this.events?.onAudioData(pcmDataCopy);
      };

      // Connect the audio graph
      // Connect to gain node for level monitoring
      this.sourceNode.connect(this.scriptProcessorNode);
      // Connect processor to destination (required for it to work)
      this.scriptProcessorNode.connect(this.audioContext.destination);
      // Also connect source through gain to destination for actual playback
      this.gainNode.connect(this.audioContext.destination);

      // Set up event listeners
      this.mediaElement.onended = () => {
        this.events?.onEnded?.();
      };

      this.mediaElement.onerror = () => {
        this.events?.onError?.(new Error('Media playback error'));
      };

      this._isActive = true;
      this.events?.onStart?.();

      // Start playback if autoplay is enabled
      if (this.autoplay) {
        await this.mediaElement.play();
      }
    } catch (error) {
      this.cleanup();
      const err = error instanceof Error ? error : new Error('Unknown file source error');
      this.events?.onError?.(err);
      throw err;
    }
  }

  disconnect(): void {
    if (!this._isActive) return;

    this.cleanup();
    this._isActive = false;
    this.events?.onStop?.();
  }

  private cleanup(): void {
    // Pause and cleanup media element
    if (this.mediaElement) {
      this.mediaElement.pause();
      this.mediaElement.src = '';
      this.mediaElement.onended = null;
      this.mediaElement.onerror = null;
      this.mediaElement = null;
    }

    // Revoke object URL
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    // Disconnect audio nodes
    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode.onaudioprocess = null;
      this.scriptProcessorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Clean up audio context
    this.cleanupAudioContext();
  }

  /**
   * Get the video element (only for video files)
   */
  getVideoElement(): HTMLVideoElement | null {
    if (this.mediaElement instanceof HTMLVideoElement) {
      return this.mediaElement;
    }
    return null;
  }

  /**
   * Get the media element (video or audio)
   */
  getMediaElement(): HTMLMediaElement | null {
    return this.mediaElement;
  }

  /**
   * Get total duration in seconds
   */
  getDuration(): number | undefined {
    return this.mediaElement?.duration;
  }

  /**
   * Get current playback position in seconds
   */
  getCurrentTime(): number | undefined {
    return this.mediaElement?.currentTime;
  }

  /**
   * Seek to a specific time in seconds
   */
  seek(time: number): void {
    if (this.mediaElement) {
      this.mediaElement.currentTime = time;
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.mediaElement?.pause();
  }

  /**
   * Resume playback
   */
  resume(): void {
    this.mediaElement?.play();
  }

  /**
   * Get the file name
   */
  getFileName(): string {
    return this.file.name;
  }

  /**
   * Get the file size in bytes
   */
  getFileSize(): number {
    return this.file.size;
  }

  /**
   * Get the file MIME type
   */
  getFileType(): string {
    return this.file.type;
  }
}

/**
 * Supported file extensions for local file source
 */
export const SUPPORTED_FILE_EXTENSIONS = [
  // Video
  '.mp4',
  '.webm',
  '.mkv',
  '.avi',
  '.mov',
  '.m4v',
  // Audio
  '.mp3',
  '.wav',
  '.ogg',
  '.aac',
  '.m4a',
  '.flac',
  '.wma',
];

/**
 * Supported MIME types for local file source
 */
export const SUPPORTED_MIME_TYPES = [
  // Video
  'video/mp4',
  'video/webm',
  'video/x-matroska',
  'video/quicktime',
  'video/x-msvideo',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/flac',
];

/**
 * Check if a file is supported
 */
export function isFileSupported(file: File): boolean {
  // Check MIME type
  if (SUPPORTED_MIME_TYPES.includes(file.type)) {
    return true;
  }

  // Check extension as fallback
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_FILE_EXTENSIONS.includes(extension);
}

/**
 * Get accept string for file input
 */
export function getAcceptString(): string {
  return [...SUPPORTED_MIME_TYPES, ...SUPPORTED_FILE_EXTENSIONS].join(',');
}
