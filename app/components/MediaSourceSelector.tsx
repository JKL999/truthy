/**
 * MediaSourceSelector - Tab-based interface for selecting media input source
 *
 * Allows switching between:
 * - Microphone (default)
 * - Local file (MP4, MP3, etc.)
 * - YouTube URL (coming soon)
 * - Screen capture (coming soon)
 */

'use client';

import { useState, useCallback } from 'react';
import type { AudioSourceProvider, AudioSourceType } from '@/lib/audio';
import { MicrophoneSource, LocalFileSource, YouTubeSource } from '@/lib/audio';
import YouTubeInput from './YouTubeInput';

export type MediaSourceTab = 'microphone' | 'file' | 'youtube' | 'screen';

interface MediaSourceSelectorProps {
  /** Currently selected source */
  selectedSource: MediaSourceTab;
  /** Callback when source type changes */
  onSourceChange: (source: MediaSourceTab) => void;
  /** Callback when audio source provider is ready */
  onSourceReady: (provider: AudioSourceProvider) => void;
  /** Whether currently recording/processing */
  isRecording: boolean;
  /** Disable changing source while recording */
  disableWhileRecording?: boolean;
}

interface SourceTabConfig {
  id: MediaSourceTab;
  label: string;
  icon: React.ReactNode;
  available: boolean;
  comingSoon?: boolean;
}

const SOURCE_TABS: SourceTabConfig[] = [
  {
    id: 'microphone',
    label: 'Microphone',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    available: true,
  },
  {
    id: 'file',
    label: 'Local File',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
    available: true,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    available: true,
  },
  {
    id: 'screen',
    label: 'Screen Share',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    available: false,
    comingSoon: true,
  },
];

export default function MediaSourceSelector({
  selectedSource,
  onSourceChange,
  onSourceReady,
  isRecording,
  disableWhileRecording = true,
}: MediaSourceSelectorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);

  const isDisabled = disableWhileRecording && isRecording;

  const handleTabClick = (tab: SourceTabConfig) => {
    if (!tab.available || tab.comingSoon || isDisabled) return;

    onSourceChange(tab.id);

    // Create default microphone source when switching to mic
    if (tab.id === 'microphone') {
      onSourceReady(new MicrophoneSource());
    }
  };

  const handleFileSelect = useCallback(
    (file: File) => {
      setSelectedFile(file);
      const source = new LocalFileSource({ file });
      onSourceReady(source);
    },
    [onSourceReady]
  );

  const handleYoutubeSubmit = useCallback(
    async (url: string) => {
      setIsYoutubeLoading(true);
      try {
        setYoutubeUrl(url);
        const source = new YouTubeSource({ url });
        onSourceReady(source);
      } catch (error) {
        console.error('Failed to create YouTube source:', error);
      } finally {
        setIsYoutubeLoading(false);
      }
    },
    [onSourceReady]
  );

  return (
    <div className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-700/50 p-4">
      {/* Tab buttons */}
      <div className="flex gap-2 mb-4">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            disabled={!tab.available || tab.comingSoon || isDisabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedSource === tab.id
                ? 'bg-blue-600 text-white'
                : tab.available && !tab.comingSoon
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.comingSoon && (
              <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">Soon</span>
            )}
          </button>
        ))}
      </div>

      {/* Source-specific content */}
      <div className="min-h-[60px]">
        {selectedSource === 'microphone' && (
          <MicrophoneSourceContent isRecording={isRecording} />
        )}

        {selectedSource === 'file' && (
          <FileSourceContent
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            isRecording={isRecording}
          />
        )}

        {selectedSource === 'youtube' && (
          <YouTubeSourceContent
            youtubeUrl={youtubeUrl}
            onSubmit={handleYoutubeSubmit}
            isLoading={isYoutubeLoading}
            isRecording={isRecording}
          />
        )}

        {selectedSource === 'screen' && (
          <div className="text-gray-400 text-sm text-center py-4">
            Screen capture coming soon! Share your screen to fact-check video calls or browser tabs.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Content for microphone source tab
 */
function MicrophoneSourceContent({ isRecording }: { isRecording: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-3 h-3 rounded-full ${
          isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'
        }`}
      />
      <span className="text-gray-300 text-sm">
        {isRecording
          ? 'Recording from microphone...'
          : 'Click "Start Recording" to begin. Use spacebar to switch speakers.'}
      </span>
    </div>
  );
}

/**
 * Content for file source tab
 */
function FileSourceContent({
  selectedFile,
  onFileSelect,
  isRecording,
}: {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  isRecording: boolean;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-3">
      {!selectedFile ? (
        <label
          className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isRecording
              ? 'border-gray-700 bg-gray-800/30 cursor-not-allowed'
              : 'border-gray-600 hover:border-blue-500 bg-gray-800/50 hover:bg-gray-800'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-8 h-8 mb-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm text-gray-400">
              <span className="font-semibold text-blue-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">MP4, MP3, WAV, WebM</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="video/*,audio/*,.mp4,.mp3,.wav,.webm,.mkv,.ogg"
            onChange={handleFileChange}
            disabled={isRecording}
          />
        </label>
      ) : (
        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <svg
              className="w-8 h-8 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <div className="text-white text-sm font-medium">{selectedFile.name}</div>
              <div className="text-gray-400 text-xs">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            </div>
          </div>

          {!isRecording && (
            <label className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer">
              Change
              <input
                type="file"
                className="hidden"
                accept="video/*,audio/*,.mp4,.mp3,.wav,.webm,.mkv,.ogg"
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>
      )}

      {selectedFile && !isRecording && (
        <p className="text-gray-400 text-xs">
          Click "Start Recording" to begin fact-checking this file.
        </p>
      )}

      {selectedFile && isRecording && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400 text-sm">Processing audio...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Content for YouTube source tab
 */
function YouTubeSourceContent({
  youtubeUrl,
  onSubmit,
  isLoading,
  isRecording,
}: {
  youtubeUrl: string | null;
  onSubmit: (url: string) => void;
  isLoading: boolean;
  isRecording: boolean;
}) {
  if (isRecording && youtubeUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400 text-sm">Processing YouTube audio...</span>
        </div>
        <p className="text-gray-400 text-xs">
          Audio is being extracted and fact-checked in real-time.
        </p>
      </div>
    );
  }

  if (youtubeUrl && !isRecording) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <div className="flex-1">
            <div className="text-white text-sm font-medium">YouTube video loaded</div>
            <div className="text-gray-400 text-xs truncate max-w-md">{youtubeUrl}</div>
          </div>
        </div>
        <p className="text-gray-400 text-xs">
          Click "Start Recording" to begin fact-checking this video.
        </p>
      </div>
    );
  }

  return (
    <YouTubeInput
      onSubmit={onSubmit}
      disabled={isRecording}
      isLoading={isLoading}
    />
  );
}

/**
 * Export individual source configs for use elsewhere
 */
export { SOURCE_TABS };
export type { SourceTabConfig };
