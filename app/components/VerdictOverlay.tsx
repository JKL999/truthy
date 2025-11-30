/**
 * VerdictOverlay - Lower-third style overlay for video fact-checking
 *
 * Designed to be displayed over video content with minimal obstruction.
 * Shows verdict badge, claim, and brief rationale.
 */

'use client';

import { Verdict, VerdictLabel } from '@/types';
import { useEffect, useState } from 'react';

export type OverlayPosition = 'lower-third' | 'top' | 'bottom-right';

interface VerdictOverlayProps {
  verdict: Verdict | null;
  position?: OverlayPosition;
  /** Duration in ms to show the verdict (default: 8000) */
  displayDuration?: number;
  /** Whether to auto-hide after displayDuration */
  autoHide?: boolean;
  /** Callback when overlay is dismissed */
  onDismiss?: () => void;
}

const VERDICT_COLORS: Record<VerdictLabel, { bg: string; border: string; text: string }> = {
  True: {
    bg: 'bg-green-600',
    border: 'border-green-400',
    text: 'text-green-300',
  },
  'Mostly True': {
    bg: 'bg-lime-600',
    border: 'border-lime-400',
    text: 'text-lime-300',
  },
  Mixed: {
    bg: 'bg-amber-600',
    border: 'border-amber-400',
    text: 'text-amber-300',
  },
  'Mostly False': {
    bg: 'bg-orange-600',
    border: 'border-orange-400',
    text: 'text-orange-300',
  },
  False: {
    bg: 'bg-red-600',
    border: 'border-red-400',
    text: 'text-red-300',
  },
  Unverifiable: {
    bg: 'bg-gray-600',
    border: 'border-gray-400',
    text: 'text-gray-300',
  },
};

const POSITION_CLASSES: Record<OverlayPosition, string> = {
  'lower-third': 'bottom-8 left-0 right-0 mx-4',
  top: 'top-4 left-0 right-0 mx-4',
  'bottom-right': 'bottom-4 right-4 max-w-md',
};

export default function VerdictOverlay({
  verdict,
  position = 'lower-third',
  displayDuration = 8000,
  autoHide = true,
  onDismiss,
}: VerdictOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentVerdict, setCurrentVerdict] = useState<Verdict | null>(null);

  useEffect(() => {
    if (verdict) {
      setCurrentVerdict(verdict);
      setIsVisible(true);

      if (autoHide) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onDismiss?.();
          }, 300); // Wait for fade out animation
        }, displayDuration);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [verdict, displayDuration, autoHide, onDismiss]);

  if (!currentVerdict) return null;

  const colors = VERDICT_COLORS[currentVerdict.label];
  const positionClass = POSITION_CLASSES[position];

  return (
    <div
      className={`absolute ${positionClass} z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div
        className={`bg-black/85 backdrop-blur-md rounded-lg border-l-4 ${colors.border} p-4 shadow-2xl`}
      >
        <div className="flex items-start gap-4">
          {/* Verdict Badge */}
          <div
            className={`${colors.bg} text-white px-3 py-1.5 rounded-md text-sm font-black uppercase tracking-wide shadow-lg shrink-0`}
          >
            {currentVerdict.label}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Claim */}
            <div className="text-white font-semibold text-sm mb-1 line-clamp-2">
              "{currentVerdict.claim}"
            </div>

            {/* Rationale */}
            <div className={`${colors.text} text-xs leading-relaxed line-clamp-2`}>
              {currentVerdict.rationale}
            </div>

            {/* Source (first one only for compact view) */}
            {currentVerdict.sources && currentVerdict.sources.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                Source: {currentVerdict.sources[0].name}
                {currentVerdict.sources[0].as_of && (
                  <span className="text-gray-500"> ({currentVerdict.sources[0].as_of})</span>
                )}
              </div>
            )}
          </div>

          {/* Confidence */}
          <div className="text-right shrink-0">
            <div className="text-white text-lg font-bold">
              {Math.round(currentVerdict.confidence * 100)}%
            </div>
            <div className="text-gray-400 text-xs">confidence</div>
          </div>
        </div>

        {/* Speaker indicator */}
        <div
          className={`absolute top-2 right-2 flex items-center gap-1 text-xs ${
            currentVerdict.speaker === 'A' ? 'text-blue-400' : 'text-purple-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              currentVerdict.speaker === 'A' ? 'bg-blue-500' : 'bg-purple-500'
            }`}
          />
          Speaker {currentVerdict.speaker}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage verdict overlay queue
 * Shows verdicts one at a time with proper timing
 */
export function useVerdictOverlayQueue(
  verdicts: Verdict[],
  displayDuration: number = 8000
) {
  const [currentVerdict, setCurrentVerdict] = useState<Verdict | null>(null);
  const [displayedCount, setDisplayedCount] = useState(0);

  useEffect(() => {
    // Check if there's a new verdict to display
    if (verdicts.length > displayedCount && !currentVerdict) {
      const newVerdict = verdicts[displayedCount];
      setCurrentVerdict(newVerdict);
    }
  }, [verdicts, displayedCount, currentVerdict]);

  const handleDismiss = () => {
    setCurrentVerdict(null);
    setDisplayedCount((prev) => prev + 1);
  };

  const reset = () => {
    setCurrentVerdict(null);
    setDisplayedCount(0);
  };

  return {
    currentVerdict,
    onDismiss: handleDismiss,
    reset,
    pendingCount: verdicts.length - displayedCount - (currentVerdict ? 1 : 0),
  };
}
