/**
 * SSE Audio Stream Endpoint
 *
 * GET /api/media/stream?streamId=xxx
 * Response: Server-Sent Events stream of base64-encoded PCM audio chunks
 */

import { NextRequest } from 'next/server';
import { activeStreams } from '@/lib/youtube/streams';

export async function GET(request: NextRequest) {
  const streamId = request.nextUrl.searchParams.get('streamId');

  if (!streamId) {
    return new Response('streamId is required', { status: 400 });
  }

  const stream = activeStreams.get(streamId);

  if (!stream) {
    return new Response('Stream not found', { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    start(controller) {
      // Add this client to the stream's client set
      stream.clients.add(controller);

      // Send initial status
      const statusData = `data: ${JSON.stringify({
        type: 'status',
        status: stream.status,
        title: stream.title,
        duration: stream.duration,
      })}\n\n`;
      controller.enqueue(encoder.encode(statusData));

      // Send any buffered audio data
      for (const chunk of stream.audioBuffer) {
        const base64Chunk = chunk.toString('base64');
        const data = `data: ${JSON.stringify({ type: 'audio', data: base64Chunk })}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      // If already complete, send end signal
      if (stream.status === 'ready') {
        const endData = `data: ${JSON.stringify({ type: 'end' })}\n\n`;
        controller.enqueue(encoder.encode(endData));
        controller.close();
        stream.clients.delete(controller);
      } else if (stream.status === 'error') {
        const errorData = `data: ${JSON.stringify({ type: 'error', error: stream.error })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
        stream.clients.delete(controller);
      }
    },

    cancel() {
      // Remove client on disconnect
      stream.clients.delete(this as any);
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
