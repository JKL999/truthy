/**
 * Shared YouTube stream state
 *
 * In production, this should use Redis or similar for cross-process sharing.
 * For development, this in-memory Map works for single-process Next.js.
 */

import type { ChildProcess } from 'child_process';

export interface YouTubeStream {
  process: ChildProcess | null;
  title: string;
  duration: number;
  status: 'pending' | 'extracting' | 'ready' | 'error';
  error?: string;
  audioBuffer: Buffer[];
  clients: Set<ReadableStreamDefaultController>;
}

// Store active streams in memory
export const activeStreams = new Map<string, YouTubeStream>();
