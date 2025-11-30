/**
 * VideoOverlayContainer - Main container for video with fact-checking overlays
 *
 * Combines video player with:
 * - VerdictOverlay (fact-check results)
 * - TranscriptSubtitle (real-time captions)
 * - Playback controls
 */

'use client';

import { useRef, useState, useEffect } from 'react';
import { Verdict, Speaker } from '@/types';
import VerdictOverlay, { OverlayPosition, useVerdictOverlayQueue } from './VerdictOverlay';
import TranscriptSubtitle, { TranscriptSubtitleDual } from './TranscriptSubtitle';

interface VideoOverlayContainerProps {
  /** Video element from audio source (can be video or iframe for YouTube) */
  videoElement: HTMLVideoElement | HTMLIFrameElement | null;
  /** All verdicts to display */
  verdicts: Verdict[];
  /** Current transcription for Speaker A */
  currentTranscriptionA: string;
  /** Current transcription for Speaker B */
  currentTranscriptionB: string;
  /** Active speaker */
  activeSpeaker: Speaker;
  /** Whether to show subtitles */
  showSubtitles?: boolean;
  /** Whether to show verdicts overlay */
  showVerdicts?: boolean;
  /** Subtitle display mode */
  subtitleMode?: 'single' | 'dual';
  /** Verdict overlay position */
  verdictPosition?: OverlayPosition;
  /** Class name for container */
  className?: string;
  /** Whether the source is YouTube (uses iframe) */
  isYouTube?: boolean;
  /** Whether the video is loading/buffering */
  isLoading?: boolean;
  /** Loading status message */
  loadingStatus?: string;
}

export default function VideoOverlayContainer({
  videoElement,
  verdicts,
  currentTranscriptionA,
  currentTranscriptionB,
  activeSpeaker,
  showSubtitles = true,
  showVerdicts = true,
  subtitleMode = 'single',
  verdictPosition = 'lower-third',
  className = '',
  isYouTube = false,
  isLoading = false,
  loadingStatus = 'Loading...',
}: VideoOverlayContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Detect if element is an iframe (YouTube)
  const isIframe = videoElement instanceof HTMLIFrameElement || isYouTube;

  // Verdict overlay queue
  const { currentVerdict, onDismiss, pendingCount } = useVerdictOverlayQueue(verdicts);

  // Attach video/iframe element to container
  useEffect(() => {
    if (videoElement && containerRef.current) {
      // Style the element
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';

      if (!isIframe) {
        (videoElement as HTMLVideoElement).style.objectFit = 'contain';
      }
      videoElement.style.backgroundColor = 'black';

      // Clear existing content and add new element
      const videoContainer = containerRef.current.querySelector('.video-wrapper');
      if (videoContainer) {
        videoContainer.innerHTML = '';
        videoContainer.appendChild(videoElement);
      }

      // Only set up event listeners for native video elements (not iframes)
      if (!isIframe && videoElement instanceof HTMLVideoElement) {
        const handleTimeUpdate = () => setCurrentTime(videoElement.currentTime);
        const handleDurationChange = () => setDuration(videoElement.duration);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        videoElement.addEventListener('durationchange', handleDurationChange);
        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('pause', handlePause);

        // Initialize state
        setDuration(videoElement.duration || 0);
        setIsPlaying(!videoElement.paused);

        return () => {
          videoElement.removeEventListener('timeupdate', handleTimeUpdate);
          videoElement.removeEventListener('durationchange', handleDurationChange);
          videoElement.removeEventListener('play', handlePlay);
          videoElement.removeEventListener('pause', handlePause);
        };
      } else {
        // For YouTube iframe, assume it's playing
        setIsPlaying(true);
      }
    }
  }, [videoElement, isIframe]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }

    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, [isPlaying, showControls]);

  const handlePlayPause = () => {
    if (videoElement && !isIframe && videoElement instanceof HTMLVideoElement) {
      if (videoElement.paused) {
        videoElement.play();
      } else {
        videoElement.pause();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoElement && !isIframe && videoElement instanceof HTMLVideoElement) {
      videoElement.currentTime = parseFloat(e.target.value);
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!videoElement) {
    return (
      <div className={`relative bg-gray-900 rounded-lg ${className}`}>
        <div className="aspect-video flex items-center justify-center text-gray-500">
          No video source
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden ${className}`}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video wrapper */}
      <div className="video-wrapper aspect-video" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
          {/* Spinning loader */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-700 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
          </div>

          {/* YouTube icon for YouTube sources */}
          {isYouTube && (
            <div className="mt-4">
              <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
          )}

          {/* Status text */}
          <div className="mt-4 text-white text-sm font-medium">{loadingStatus}</div>

          {/* Progress bar animation */}
          <div className="mt-3 w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Transcript Subtitles */}
      {showSubtitles && subtitleMode === 'single' && (
        <TranscriptSubtitle
          textA={currentTranscriptionA}
          textB={currentTranscriptionB}
          activeSpeaker={activeSpeaker}
          bottomOffset={showVerdicts ? '10rem' : '6rem'}
        />
      )}

      {showSubtitles && subtitleMode === 'dual' && (
        <TranscriptSubtitleDual
          textA={currentTranscriptionA}
          textB={currentTranscriptionB}
          activeSpeaker={activeSpeaker}
        />
      )}

      {/* Verdict Overlay */}
      {showVerdicts && (
        <VerdictOverlay
          verdict={currentVerdict}
          position={verdictPosition}
          onDismiss={onDismiss}
        />
      )}

      {/* Pending verdicts indicator */}
      {pendingCount > 0 && (
        <div className="absolute top-4 right-4 bg-black/70 rounded-full px-3 py-1 text-xs text-white">
          {pendingCount} verdict{pendingCount > 1 ? 's' : ''} pending
        </div>
      )}

      {/* Video Controls - Hide for YouTube iframes (they have their own controls) */}
      {!isIframe && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-white text-xs font-mono w-12">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-white text-xs font-mono w-12 text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="text-white hover:text-gray-300 transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7L8 5z" />
                  </svg>
                )}
              </button>

              {/* Active speaker indicator */}
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeSpeaker === 'A' ? 'bg-blue-500' : 'bg-purple-500'
                  }`}
                />
                <span className="text-gray-300">Speaker {activeSpeaker}</span>
              </div>
            </div>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="text-white hover:text-gray-300 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* YouTube Controls Bar - Speaker indicator and fullscreen for iframes */}
      {isIframe && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center justify-between">
            {/* Active speaker indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeSpeaker === 'A' ? 'bg-blue-500' : 'bg-purple-500'
                }`}
              />
              <span className="text-gray-300">Speaker {activeSpeaker}</span>
              <span className="text-gray-500 text-xs ml-2">(Use YouTube controls for playback)</span>
            </div>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="text-white hover:text-gray-300 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
