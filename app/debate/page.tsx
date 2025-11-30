/**
 * Debate Page - Main UI for two-speaker live debate fact-checking
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useDebateCore } from '@/app/hooks/useDebateCore';
import SpeakerToggle from '@/app/components/SpeakerToggle';
import LiveTranscriptDisplay from '@/app/components/LiveTranscriptDisplay';
import VerdictCard from '@/app/components/VerdictCard';
import DebugPanel from '@/app/components/DebugPanel';
import MediaSourceSelector, { MediaSourceTab } from '@/app/components/MediaSourceSelector';
import VideoOverlayContainer from '@/app/components/VideoOverlayContainer';
import type { AudioSourceProvider } from '@/lib/audio';
import { MicrophoneSource } from '@/lib/audio';

export default function DebatePage() {
  // Media source state
  const [selectedSource, setSelectedSource] = useState<MediaSourceTab>('microphone');
  const [audioSource, setAudioSource] = useState<AudioSourceProvider | null>(null);
  const [showVideoOverlay, setShowVideoOverlay] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Initialize default microphone source
  useEffect(() => {
    if (!audioSource) {
      setAudioSource(new MicrophoneSource());
    }
  }, [audioSource]);

  const { state, actions } = useDebateCore({ audioSource: audioSource ?? undefined });
  const {
    isRecording,
    isConnectedA,
    isConnectedB,
    activeSpeaker,
    transcripts,
    verdicts,
    currentTranscriptionA,
    currentTranscriptionB,
    audioLevelA,
    audioLevelB,
    isPlayingA,
    isPlayingB,
    status,
    error,
    debugMode,
    videoElement,
    mediaSourceType,
  } = state;

  // Handle source changes
  const handleSourceReady = useCallback((provider: AudioSourceProvider) => {
    setAudioSource(provider);
  }, []);

  // Determine if we should show video overlay (only for file/youtube/screen sources)
  const hasVideoSource = videoElement !== null && selectedSource !== 'microphone';

  // Determine if media is loading (for YouTube extraction, etc.)
  const isMediaLoading = isRecording && (
    status.toLowerCase().includes('connecting') ||
    status.toLowerCase().includes('extracting') ||
    status.toLowerCase().includes('loading')
  );

const verdictContainerRef = useRef<HTMLDivElement>(null);

  // Spacebar hotkey for speaker toggle
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only toggle if recording and not typing in an input
      if (
        e.code === 'Space' &&
        isRecording &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        const newSpeaker = activeSpeaker === 'A' ? 'B' : 'A';
        actions.setActiveSpeaker(newSpeaker);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRecording, activeSpeaker, actions]);

  // Auto-scroll verdicts to bottom when new ones arrive
  useEffect(() => {
    if (verdictContainerRef.current) {
      verdictContainerRef.current.scrollTop = verdictContainerRef.current.scrollHeight;
    }
  }, [verdicts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-black/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-xl">⚖️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Truthy</h1>
                <p className="text-sm text-gray-400">Real-Time Debate Fact Checker</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnectedA ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
                  }`}
                />
                <span className="text-gray-400">Speaker A</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnectedB ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
                  }`}
                />
                <span className="text-gray-400">Speaker B</span>
              </div>

              {/* Overlay Toggles (only show when video source active) */}
              {hasVideoSource && (
                <div className="flex items-center gap-2 mr-2">
                  <button
                    onClick={() => setShowVideoOverlay(!showVideoOverlay)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showVideoOverlay
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                    title="Toggle video overlay"
                  >
                    {showVideoOverlay ? '🎬 Video: ON' : '🎬 Video'}
                  </button>
                  <button
                    onClick={() => setShowSubtitles(!showSubtitles)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showSubtitles
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                    title="Toggle subtitles"
                  >
                    {showSubtitles ? '📝 Subs: ON' : '📝 Subs'}
                  </button>
                </div>
              )}

              {/* Debug Mode Toggle */}
              <button
                onClick={actions.toggleDebugMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  debugMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title="Toggle debug mode for text input testing"
              >
                {debugMode ? '🐛 Debug: ON' : '🐛 Debug'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Screen Transcript Display */}
      <div className="relative h-[calc(100vh-80px)]">
        {/* Video Overlay Container (when video source is active) */}
        {hasVideoSource && showVideoOverlay && (
          <div className="absolute inset-0 z-20 pr-[360px] pb-[200px]">
            <VideoOverlayContainer
              videoElement={videoElement}
              verdicts={verdicts}
              currentTranscriptionA={currentTranscriptionA}
              currentTranscriptionB={currentTranscriptionB}
              activeSpeaker={activeSpeaker}
              showSubtitles={showSubtitles}
              showVerdicts={true}
              isYouTube={selectedSource === 'youtube'}
              isLoading={isMediaLoading}
              loadingStatus={status || 'Preparing media...'}
              className="h-full"
            />
          </div>
        )}

        {/* Live Transcript Display (Center) - Add right padding to prevent overlap with verdict panel */}
        {/* Hide completely when video overlay is active */}
        <div className={`pr-[360px] ${hasVideoSource && showVideoOverlay ? 'hidden' : ''}`}>
          <LiveTranscriptDisplay
            transcripts={transcripts}
            currentTranscriptionA={currentTranscriptionA}
            currentTranscriptionB={currentTranscriptionB}
            activeSpeaker={activeSpeaker}
            isRecording={isRecording}
          />
        </div>

        {/* Controls (Bottom Overlay) */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="container mx-auto px-6 pb-6 space-y-4">
            {/* Media Source Selector */}
            <MediaSourceSelector
              selectedSource={selectedSource}
              onSourceChange={setSelectedSource}
              onSourceReady={handleSourceReady}
              isRecording={isRecording}
            />

            <div className="bg-gray-900/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                {/* Left: Speaker Toggle */}
                <SpeakerToggle
                  activeSpeaker={activeSpeaker}
                  onToggle={actions.setActiveSpeaker}
                  disabled={!isRecording}
                />

                {/* Center: Status */}
                <div className="flex-1 mx-6">
                  {error && (
                    <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm text-center">
                      {error}
                    </div>
                  )}
                  {status && !error && (
                    <div className="text-gray-300 px-4 py-2 text-sm text-center">
                      {status}
                    </div>
                  )}
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={actions.reset}
                    disabled={isRecording}
                    className="p-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-full transition-all shadow-lg"
                    title="Reset"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="24px"
                      viewBox="0 -960 960 960"
                      width="24px"
                      fill="currentColor"
                    >
                      <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
                    </svg>
                  </button>

                  {!isRecording ? (
                    <button
                      onClick={actions.startRecording}
                      disabled={!isConnectedA || !isConnectedB}
                      className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-full transition-all shadow-lg flex items-center justify-center"
                      title="Start Recording"
                    >
                      <div className="w-6 h-6 bg-white rounded-full"></div>
                    </button>
                  ) : (
                    <button
                      onClick={actions.stopRecording}
                      className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-full transition-all shadow-lg flex items-center justify-center"
                      title="Stop Recording"
                    >
                      <div className="w-5 h-5 bg-white rounded-sm"></div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verdicts (Right Side Overlay) */}
        <div className="absolute top-6 right-6 z-10 w-80">
          <div className="bg-gray-900/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4 shadow-2xl max-h-[calc(100vh-200px)]">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span>🔍</span>
              Fact Checks
            </h2>

            <div
              ref={verdictContainerRef}
              className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
            >
              {verdicts.length === 0 ? (
                <div className="text-gray-500 text-xs italic text-center py-6">
                  Verdicts will appear here as claims are detected...
                </div>
              ) : (
                verdicts.map((verdict, idx) => <VerdictCard key={idx} verdict={verdict} />)
              )}
            </div>
          </div>
        </div>

        {/* Debug Panel (Bottom Left) */}
        {debugMode && (
          <DebugPanel
            activeSpeaker={activeSpeaker}
            setActiveSpeaker={actions.setActiveSpeaker}
            sendTextInput={actions.sendTextInput}
            isConnected={isConnectedA && isConnectedB}
          />
        )}
      </div>
    </div>
  );
}
