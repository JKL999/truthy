/**
 * Audio source exports
 */

export { MicrophoneSource, checkMicrophonePermission, getAudioInputDevices } from './MicrophoneSource';

// LocalFileSource with type-only exports
export { LocalFileSource, SUPPORTED_FILE_EXTENSIONS, SUPPORTED_MIME_TYPES, isFileSupported, getAcceptString } from './LocalFileSource';
export type { LocalFileSourceOptions } from './LocalFileSource';

// YouTubeSource with type-only exports
export { YouTubeSource, isValidYouTubeUrl, extractYouTubeVideoId } from './YouTubeSource';
export type { YouTubeSourceOptions } from './YouTubeSource';

// Future exports:
// export { ScreenCaptureSource } from './ScreenCaptureSource';
