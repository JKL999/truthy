/**
 * YouTubeSource - Audio source for YouTube videos
 *
 * Connects to server-side yt-dlp extraction via SSE.
 * Provides video element for iframe display.
 */

'use client';

import {
  BaseAudioSource,
  AudioSourceConfig,
  AudioSourceEvents,
} from '../AudioSourceProvider';

export interface YouTubeSourceOptions extends Partial<AudioSourceConfig> {
  /** YouTube video URL */
  url: string;
}

interface StreamStatus {
  type: 'status';
  status: string;
  title: string;
  duration: number;
}

interface AudioChunk {
  type: 'audio';
  data: string; // base64 encoded PCM
}

interface StreamEnd {
  type: 'end';
}

interface StreamError {
  type: 'error';
  error: string;
}

type SSEMessage = StreamStatus | AudioChunk | StreamEnd | StreamError;

export class YouTubeSource extends BaseAudioSource {
  readonly type = 'youtube' as const;

  private url: string;
  private videoId: string | null = null;
  private streamId: string | null = null;
  private eventSource: EventSource | null = null;
  private iframeElement: HTMLIFrameElement | null = null;
  private _title: string = '';
  private _duration: number = 0;
  private _status: 'pending' | 'extracting' | 'ready' | 'error' = 'pending';

  constructor(options: YouTubeSourceOptions) {
    super(options);
    this.url = options.url;
    this.videoId = this.extractVideoId(options.url);
  }

  private extractVideoId(url: string): string | null {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[5] : null;
  }

  async connect(events: AudioSourceEvents): Promise<void> {
    if (this._isActive) {
      return;
    }

    if (!this.videoId) {
      throw new Error('Invalid YouTube URL');
    }

    this.events = events;

    try {
      // Step 1: Initialize extraction on server
      const response = await fetch('/api/media/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: this.url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start extraction');
      }

      const { streamId } = await response.json();
      this.streamId = streamId;

      // Step 2: Create iframe for video display
      this.createIframe();

      // Step 3: Connect to SSE stream for audio
      await this.connectToStream();

      this._isActive = true;
      this.events?.onStart?.();
    } catch (error) {
      this.cleanup();
      const err = error instanceof Error ? error : new Error('Unknown YouTube error');
      this.events?.onError?.(err);
      throw err;
    }
  }

  private createIframe(): void {
    if (!this.videoId) return;

    this.iframeElement = document.createElement('iframe');
    // Don't mute - let user hear the audio from iframe while we extract separately for Gemini
    this.iframeElement.src = `https://www.youtube.com/embed/${this.videoId}?autoplay=1&enablejsapi=1`;
    this.iframeElement.width = '100%';
    this.iframeElement.height = '100%';
    this.iframeElement.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    this.iframeElement.allowFullscreen = true;
    this.iframeElement.style.border = 'none';
  }

  private async connectToStream(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.streamId) {
        reject(new Error('No stream ID'));
        return;
      }

      this.eventSource = new EventSource(`/api/media/stream?streamId=${this.streamId}`);

      this.eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'status':
              this._title = message.title;
              this._duration = message.duration;
              this._status = message.status as any;
              resolve();
              break;

            case 'audio':
              this.processAudioChunk(message.data);
              break;

            case 'end':
              this.events?.onEnded?.();
              this.disconnect();
              break;

            case 'error':
              this._status = 'error';
              this.events?.onError?.(new Error(message.error));
              this.disconnect();
              break;
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this._status = 'error';
        reject(new Error('Connection to audio stream failed'));
      };

      // Timeout if no response
      setTimeout(() => {
        if (this._status === 'pending') {
          reject(new Error('Connection timeout'));
        }
      }, 30000);
    });
  }

  private processAudioChunk(base64Data: string): void {
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert Int16 PCM to Float32
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    // Send to callback
    this.events?.onAudioData(float32);
  }

  disconnect(): void {
    console.log('[YouTubeSource] disconnect called, isActive:', this._isActive, 'eventSource:', !!this.eventSource);

    // Always cleanup, don't early return
    this.cleanup();
    this._isActive = false;

    // Call onStop callback
    this.events?.onStop?.();

    // Clear events to prevent any further callbacks
    this.events = null;
  }

  private cleanup(): void {
    console.log('[YouTubeSource] cleanup called');

    if (this.eventSource) {
      console.log('[YouTubeSource] Closing EventSource');
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.iframeElement) {
      console.log('[YouTubeSource] Clearing iframe');
      this.iframeElement.src = '';
      if (this.iframeElement.parentNode) {
        this.iframeElement.parentNode.removeChild(this.iframeElement);
      }
      this.iframeElement = null;
    }

    // Tell server to stop extraction
    if (this.streamId) {
      console.log('[YouTubeSource] Notifying server to stop stream:', this.streamId);
      fetch(`/api/media/youtube?streamId=${this.streamId}`, { method: 'DELETE' })
        .catch(e => console.warn('Failed to stop server stream:', e));
    }

    this.streamId = null;
  }

  /**
   * Get the iframe element for embedding in the page
   * Note: Returns as HTMLVideoElement type for interface compatibility
   * but it's actually an iframe
   */
  getVideoElement(): HTMLVideoElement | null {
    // Return iframe as any since we need to display it
    // The VideoOverlayContainer will handle it appropriately
    return this.iframeElement as any;
  }

  getMediaElement(): HTMLMediaElement | null {
    return null; // No direct media element control for YouTube
  }

  getDuration(): number | undefined {
    return this._duration > 0 ? this._duration : undefined;
  }

  getCurrentTime(): number | undefined {
    return undefined; // Can't get current time from iframe
  }

  seek(_time: number): void {
    // Can't seek YouTube iframe from outside
    // Would need YouTube IFrame API for this
  }

  pause(): void {
    // Can't control YouTube iframe playback from outside
  }

  resume(): void {
    // Can't control YouTube iframe playback from outside
  }

  /**
   * Get the video title
   */
  getTitle(): string {
    return this._title;
  }

  /**
   * Get the video ID
   */
  getVideoId(): string | null {
    return this.videoId;
  }

  /**
   * Get current extraction status
   */
  getStatus(): string {
    return this._status;
  }

  /**
   * Get the original URL
   */
  getUrl(): string {
    return this.url;
  }
}

/**
 * Validate if a URL is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return regex.test(url);
}

/**
 * Extract video ID from YouTube URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[5] : null;
}
