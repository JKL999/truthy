/**
 * YouTube Media API - Extract audio from YouTube videos using yt-dlp
 *
 * POST /api/media/youtube
 * Body: { url: string }
 * Response: { streamId: string, title: string, duration: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { activeStreams } from '@/lib/youtube/streams';

// Full paths to executables (Homebrew on Steam Deck)
// In production, these should be environment variables
const YTDLP_PATH = process.env.YTDLP_PATH || '/home/linuxbrew/.linuxbrew/bin/yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/home/linuxbrew/.linuxbrew/bin/ffmpeg';

// YouTube URL validation regex
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_URL_REGEX);
  return match ? match[5] : null;
}

function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not extract video ID' },
        { status: 400 }
      );
    }

    const streamId = randomUUID();

    // Initialize stream entry
    activeStreams.set(streamId, {
      process: null,
      title: '',
      duration: 0,
      status: 'pending',
      audioBuffer: [],
      clients: new Set(),
    });

    // Get video info first
    const infoProcess = spawn(YTDLP_PATH, [
      '--dump-json',
      '--no-download',
      url,
    ]);

    let infoData = '';

    infoProcess.stdout.on('data', (data) => {
      infoData += data.toString();
    });

    infoProcess.on('close', async (code) => {
      const stream = activeStreams.get(streamId);
      if (!stream) return;

      if (code !== 0) {
        stream.status = 'error';
        stream.error = 'Failed to get video info';
        return;
      }

      try {
        const info = JSON.parse(infoData);
        stream.title = info.title || 'Unknown';
        stream.duration = info.duration || 0;
        stream.status = 'extracting';

        // Start audio extraction with yt-dlp piped to ffmpeg
        startAudioExtraction(streamId, url);
      } catch (e) {
        stream.status = 'error';
        stream.error = 'Failed to parse video info';
      }
    });

    infoProcess.on('error', () => {
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.status = 'error';
        stream.error = 'yt-dlp not found. Please install: pip install yt-dlp';
      }
    });

    return NextResponse.json({
      streamId,
      videoId,
      message: 'Processing started',
    });
  } catch (error) {
    console.error('YouTube API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function startAudioExtraction(streamId: string, url: string) {
  const stream = activeStreams.get(streamId);
  if (!stream) return;

  // Use yt-dlp to extract audio and pipe to ffmpeg for conversion to 16kHz PCM
  const ytdlp = spawn(YTDLP_PATH, [
    '-f', 'bestaudio',
    '-o', '-',  // Output to stdout
    '--no-playlist',
    url,
  ]);

  const ffmpeg = spawn(FFMPEG_PATH, [
    '-i', 'pipe:0',           // Input from stdin
    '-ar', '16000',           // Sample rate 16kHz
    '-ac', '1',               // Mono
    '-f', 's16le',            // Raw PCM signed 16-bit little-endian
    '-acodec', 'pcm_s16le',
    'pipe:1',                 // Output to stdout
  ]);

  // Pipe yt-dlp output to ffmpeg input
  ytdlp.stdout.pipe(ffmpeg.stdin);

  // Handle ffmpeg output (PCM audio data)
  ffmpeg.stdout.on('data', (chunk: Buffer) => {
    const stream = activeStreams.get(streamId);
    if (!stream) return;

    // Store in buffer
    stream.audioBuffer.push(chunk);

    // Send to all connected clients
    stream.clients.forEach((controller) => {
      try {
        const base64Chunk = chunk.toString('base64');
        const data = `data: ${JSON.stringify({ type: 'audio', data: base64Chunk })}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      } catch (e) {
        // Client disconnected
        stream.clients.delete(controller);
      }
    });
  });

  ffmpeg.on('close', (code) => {
    const stream = activeStreams.get(streamId);
    if (!stream) return;

    if (code === 0) {
      stream.status = 'ready';
      // Notify all clients that stream is complete
      stream.clients.forEach((controller) => {
        try {
          const data = `data: ${JSON.stringify({ type: 'end' })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
          controller.close();
        } catch (e) {
          // Ignore
        }
      });
    } else {
      stream.status = 'error';
      stream.error = 'Audio extraction failed';
    }

    // Cleanup after 5 minutes
    setTimeout(() => {
      activeStreams.delete(streamId);
    }, 5 * 60 * 1000);
  });

  ytdlp.on('error', (err) => {
    console.error('yt-dlp error:', err);
    const stream = activeStreams.get(streamId);
    if (stream) {
      stream.status = 'error';
      stream.error = 'yt-dlp execution failed';
    }
  });

  ffmpeg.on('error', (err) => {
    console.error('ffmpeg error:', err);
    const stream = activeStreams.get(streamId);
    if (stream) {
      stream.status = 'error';
      stream.error = 'ffmpeg execution failed';
    }
  });

  stream.process = ytdlp;
}

// GET endpoint to check stream status
export async function GET(request: NextRequest) {
  const streamId = request.nextUrl.searchParams.get('streamId');

  if (!streamId) {
    return NextResponse.json(
      { error: 'streamId is required' },
      { status: 400 }
    );
  }

  const stream = activeStreams.get(streamId);
  if (!stream) {
    return NextResponse.json(
      { error: 'Stream not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    streamId,
    title: stream.title,
    duration: stream.duration,
    status: stream.status,
    error: stream.error,
  });
}

// DELETE endpoint to stop extraction
export async function DELETE(request: NextRequest) {
  const streamId = request.nextUrl.searchParams.get('streamId');

  if (!streamId) {
    return NextResponse.json(
      { error: 'streamId is required' },
      { status: 400 }
    );
  }

  const stream = activeStreams.get(streamId);
  if (!stream) {
    return NextResponse.json(
      { error: 'Stream not found' },
      { status: 404 }
    );
  }

  console.log('[YouTube API] Stopping stream:', streamId);

  // Kill the yt-dlp process (which will also stop ffmpeg via pipe)
  if (stream.process) {
    try {
      stream.process.kill('SIGTERM');
      console.log('[YouTube API] Killed yt-dlp process');
    } catch (e) {
      console.warn('[YouTube API] Error killing process:', e);
    }
  }

  // Close all SSE clients
  stream.clients.forEach((controller) => {
    try {
      const data = `data: ${JSON.stringify({ type: 'end' })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
      controller.close();
    } catch (e) {
      // Client already disconnected
    }
  });
  stream.clients.clear();

  // Update status
  stream.status = 'ready';

  // Remove from active streams
  activeStreams.delete(streamId);

  return NextResponse.json({ success: true, message: 'Stream stopped' });
}

