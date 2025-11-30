/**
 * YouTubeInput - URL input component for YouTube videos
 *
 * Validates YouTube URLs and provides preview thumbnail.
 */

'use client';

import { useState, useCallback } from 'react';
import { isValidYouTubeUrl, extractYouTubeVideoId } from '@/lib/audio';

interface YouTubeInputProps {
  /** Callback when a valid URL is submitted */
  onSubmit: (url: string) => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Loading state */
  isLoading?: boolean;
}

export default function YouTubeInput({
  onSubmit,
  disabled = false,
  isLoading = false,
}: YouTubeInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    setError('');

    if (value.trim()) {
      const id = extractYouTubeVideoId(value);
      setVideoId(id);
      if (!id && value.length > 10) {
        setError('Invalid YouTube URL');
      }
    } else {
      setVideoId(null);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!url.trim()) {
        setError('Please enter a YouTube URL');
        return;
      }

      if (!isValidYouTubeUrl(url)) {
        setError('Invalid YouTube URL. Please use a valid youtube.com or youtu.be link.');
        return;
      }

      onSubmit(url);
    },
    [url, onSubmit]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (isValidYouTubeUrl(text)) {
        setUrl(text);
        setVideoId(extractYouTubeVideoId(text));
        setError('');
      }
    } catch (e) {
      // Clipboard access denied
    }
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* URL Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...)"
            disabled={disabled || isLoading}
            className={`w-full bg-gray-800 border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
              error
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-gray-700 focus:ring-blue-500/50'
            } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          />

          {/* Paste button */}
          {!url && !disabled && (
            <button
              type="button"
              onClick={handlePaste}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors"
            >
              Paste
            </button>
          )}

          {/* Clear button */}
          {url && !disabled && (
            <button
              type="button"
              onClick={() => {
                setUrl('');
                setVideoId(null);
                setError('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled || isLoading || !url.trim()}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            disabled || isLoading || !url.trim()
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </span>
          ) : (
            'Load Video'
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Video Preview */}
      {videoId && !error && (
        <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt="Video thumbnail"
            className="w-32 h-18 object-cover rounded"
          />
          <div className="flex-1">
            <div className="text-white text-sm font-medium">Video found</div>
            <div className="text-gray-400 text-xs mt-1">
              Click "Load Video" to start fact-checking
            </div>
          </div>
          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </div>
      )}

      {/* Help text */}
      {!videoId && !error && (
        <div className="text-gray-500 text-xs">
          Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
        </div>
      )}
    </form>
  );
}
