/**
 * MicrophoneSource - Audio source for microphone input
 *
 * Captures audio from the user's microphone at 16kHz mono PCM.
 * Extracted from useDebateCore.ts for reuse with AudioSourceProvider pattern.
 */

'use client';

import {
  BaseAudioSource,
  AudioSourceConfig,
  AudioSourceEvents,
} from '../AudioSourceProvider';

export class MicrophoneSource extends BaseAudioSource {
  readonly type = 'microphone' as const;

  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;

  constructor(config: Partial<AudioSourceConfig> = {}) {
    super(config);
  }

  async connect(events: AudioSourceEvents): Promise<void> {
    if (this._isActive) {
      return;
    }

    this.events = events;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize audio context at 16kHz
      await this.initAudioContext();

      if (!this.audioContext || !this.gainNode) {
        throw new Error('Failed to initialize audio context');
      }

      // Create source from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.gainNode);

      // Create script processor for raw PCM access
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(
        this._config.bufferSize,
        this._config.channelCount,
        this._config.channelCount
      );

      this.scriptProcessorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this._isActive) return;

        const pcmData = e.inputBuffer.getChannelData(0);
        // Clone the data since the buffer may be reused
        const pcmDataCopy = new Float32Array(pcmData);
        this.events?.onAudioData(pcmDataCopy);
      };

      // Connect the audio graph
      this.sourceNode.connect(this.scriptProcessorNode);
      // Connect to destination to keep the processor running (required by Web Audio API)
      this.scriptProcessorNode.connect(this.audioContext.destination);

      this._isActive = true;
      this.events?.onStart?.();
    } catch (error) {
      this.cleanup();
      const err = error instanceof Error ? error : new Error('Unknown microphone error');
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

    // Stop all media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Clean up audio context
    this.cleanupAudioContext();
  }

  /**
   * Get the raw MediaStream (useful for audio visualization)
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }
}

/**
 * Check if microphone access is available
 */
export async function checkMicrophonePermission(): Promise<PermissionState> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state;
  } catch {
    // Some browsers don't support permission query for microphone
    return 'prompt';
  }
}

/**
 * Get list of available audio input devices
 */
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput');
}
