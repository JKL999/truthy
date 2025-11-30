/**
 * TranscriptSubtitle - Real-time caption overlay for video
 *
 * Displays live transcription as subtitles at the bottom of video.
 * Color-coded by speaker with smooth transitions.
 */

'use client';

import { Speaker } from '@/types';

interface TranscriptSubtitleProps {
  /** Current transcription text for Speaker A */
  textA: string;
  /** Current transcription text for Speaker B */
  textB: string;
  /** Currently active speaker */
  activeSpeaker: Speaker;
  /** Whether subtitles are enabled */
  enabled?: boolean;
  /** Position from bottom of container */
  bottomOffset?: string;
}

const SPEAKER_STYLES = {
  A: {
    bg: 'bg-blue-600/80',
    text: 'text-white',
    label: 'Speaker A',
    labelColor: 'text-blue-300',
    indicator: 'bg-blue-400',
  },
  B: {
    bg: 'bg-purple-600/80',
    text: 'text-white',
    label: 'Speaker B',
    labelColor: 'text-purple-300',
    indicator: 'bg-purple-400',
  },
};

export default function TranscriptSubtitle({
  textA,
  textB,
  activeSpeaker,
  enabled = true,
  bottomOffset = '6rem',
}: TranscriptSubtitleProps) {
  if (!enabled) return null;

  // Get active text and style
  const activeText = activeSpeaker === 'A' ? textA : textB;
  const style = SPEAKER_STYLES[activeSpeaker];

  // Don't show if no text
  if (!activeText.trim()) return null;

  return (
    <div
      className="absolute left-0 right-0 flex justify-center pointer-events-none z-40"
      style={{ bottom: bottomOffset }}
    >
      <div
        className={`${style.bg} backdrop-blur-sm rounded-lg px-6 py-3 max-w-[85%] shadow-xl transition-all duration-200`}
      >
        {/* Speaker indicator */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${style.indicator} animate-pulse`} />
          <span className={`text-xs font-semibold ${style.labelColor}`}>{style.label}</span>
        </div>

        {/* Transcription text */}
        <div className={`${style.text} text-lg font-medium leading-relaxed`}>
          {activeText}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact subtitle variant for smaller displays
 */
export function TranscriptSubtitleCompact({
  textA,
  textB,
  activeSpeaker,
  enabled = true,
}: Omit<TranscriptSubtitleProps, 'bottomOffset'>) {
  if (!enabled) return null;

  const activeText = activeSpeaker === 'A' ? textA : textB;
  const style = SPEAKER_STYLES[activeSpeaker];

  if (!activeText.trim()) return null;

  return (
    <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-40">
      <div
        className={`${style.bg} backdrop-blur-sm rounded px-4 py-2 max-w-[90%] shadow-lg`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${style.indicator}`} />
          <span className={`${style.text} text-sm font-medium`}>{activeText}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Dual-speaker subtitle showing both speakers side by side
 */
export function TranscriptSubtitleDual({
  textA,
  textB,
  activeSpeaker,
  enabled = true,
}: Omit<TranscriptSubtitleProps, 'bottomOffset'>) {
  if (!enabled) return null;

  const hasTextA = textA.trim().length > 0;
  const hasTextB = textB.trim().length > 0;

  if (!hasTextA && !hasTextB) return null;

  return (
    <div className="absolute bottom-8 left-4 right-4 flex justify-between gap-4 pointer-events-none z-40">
      {/* Speaker A - Left */}
      <div
        className={`flex-1 max-w-[45%] transition-opacity duration-200 ${
          hasTextA ? 'opacity-100' : 'opacity-0'
        } ${activeSpeaker === 'A' ? '' : 'opacity-50'}`}
      >
        {hasTextA && (
          <div className={`${SPEAKER_STYLES.A.bg} backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg`}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${SPEAKER_STYLES.A.indicator} ${
                  activeSpeaker === 'A' ? 'animate-pulse' : ''
                }`}
              />
              <span className={`text-xs font-semibold ${SPEAKER_STYLES.A.labelColor}`}>
                Speaker A
              </span>
            </div>
            <div className="text-white text-sm font-medium">{textA}</div>
          </div>
        )}
      </div>

      {/* Speaker B - Right */}
      <div
        className={`flex-1 max-w-[45%] transition-opacity duration-200 ${
          hasTextB ? 'opacity-100' : 'opacity-0'
        } ${activeSpeaker === 'B' ? '' : 'opacity-50'}`}
      >
        {hasTextB && (
          <div
            className={`${SPEAKER_STYLES.B.bg} backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg ml-auto`}
          >
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className={`text-xs font-semibold ${SPEAKER_STYLES.B.labelColor}`}>
                Speaker B
              </span>
              <span
                className={`w-2 h-2 rounded-full ${SPEAKER_STYLES.B.indicator} ${
                  activeSpeaker === 'B' ? 'animate-pulse' : ''
                }`}
              />
            </div>
            <div className="text-white text-sm font-medium text-right">{textB}</div>
          </div>
        )}
      </div>
    </div>
  );
}
