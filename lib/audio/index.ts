/**
 * Audio module exports
 */

// Original audio utilities (encoding/decoding)
export { createBlob, decode, decodeAudioData, encode } from '../audioUtils';

// Core types (type-only exports for isolatedModules compatibility)
export type { AudioSourceType, AudioSourceConfig, AudioSourceEvents, AudioSourceProvider } from './AudioSourceProvider';

// Base class and constants
export { BaseAudioSource, DEFAULT_AUDIO_CONFIG } from './AudioSourceProvider';

// Source implementations
export * from './sources';
