# Truthy Implementation Plan - Multi-Source Media Support

This plan tracks the implementation of multi-source media support, video overlays, and advanced features.

## Overview

**Goal**: Expand Truthy from local microphone-only to support multiple media sources with live fact-checking overlays.

---

## Phase 1: Media Source Abstraction + Video Overlay ✅ COMPLETED

### Tasks
- [x] P1-01: Create `AudioSourceProvider` interface
- [x] P1-02: Create `MicrophoneSource` class (extract from useDebateCore)
- [x] P1-03: Modify `useDebateCore` to accept `AudioSourceProvider`
- [x] P1-04: Create `LocalFileSource` for MP4/MP3/WAV files
- [x] P1-05: Create `VerdictOverlay` component (lower-third style)
- [x] P1-06: Create `TranscriptSubtitle` component (real-time captions)
- [x] P1-07: Create `VideoOverlayContainer` (combines video + overlays)
- [x] P1-08: Create `MediaSourceSelector` tab component
- [x] P1-09: Integrate into debate page
- [x] P1-10: Add Tailwind animations (slideUp, scaleIn)

### Files Created
- `lib/audio/AudioSourceProvider.ts`
- `lib/audio/sources/MicrophoneSource.ts`
- `lib/audio/sources/LocalFileSource.ts`
- `lib/audio/sources/index.ts`
- `lib/audio/index.ts`
- `app/components/VerdictOverlay.tsx`
- `app/components/TranscriptSubtitle.tsx`
- `app/components/VideoOverlayContainer.tsx`
- `app/components/MediaSourceSelector.tsx`

---

## Phase 2: YouTube Integration ✅ COMPLETED

### Tasks
- [x] P2-01: Create YouTube API route with URL validation
- [x] P2-02: Add yt-dlp spawn logic for audio extraction
- [x] P2-03: Add ffmpeg transcoding to 16kHz PCM
- [x] P2-04: Create SSE streaming endpoint
- [x] P2-05: Create `YouTubeSource` class
- [x] P2-06: Create `YouTubeInput` component
- [x] P2-07: Handle YouTube video display (iframe)
- [x] P2-08: Add loading/buffering states
- [x] P2-09: Test with YouTube VOD
- [x] P2-10: Test with YouTube livestream

### Files Created
- `app/api/media/youtube/route.ts`
- `app/api/media/stream/route.ts`
- `lib/audio/sources/YouTubeSource.ts`
- `lib/youtube/streams.ts`
- `app/components/YouTubeInput.tsx`

### Known Limitations
- **Seeking doesn't sync**: YouTube iframe and server-side extraction are independent streams. Seeking in the iframe doesn't affect the audio being sent to Gemini.
- **Workaround**: Don't seek - let video play from start for accurate fact-checking.

### Dependencies
- `yt-dlp` (install via `pip install yt-dlp` or `brew install yt-dlp`)
- `ffmpeg` (install via `brew install ffmpeg` or system package manager)

---

## Phase 3: Screen Capture ⏳ PENDING

### Tasks
- [ ] P3-01: Create `ScreenCaptureSource` class using `getDisplayMedia`
- [ ] P3-02: Add screen selection UI (share window/tab/screen)
- [ ] P3-03: Extract audio from screen capture stream
- [ ] P3-04: Handle system audio vs. microphone mixing
- [ ] P3-05: Test with Zoom/Google Meet

### Notes
- Uses Web API `navigator.mediaDevices.getDisplayMedia()`
- Need to handle both video and audio tracks
- System audio capture varies by OS/browser

---

## Phase 4: Tauri Desktop App ⏳ PENDING

### Tasks
- [ ] P4-01: Initialize Tauri v2 project
- [ ] P4-02: Configure window settings (frameless, always-on-top)
- [ ] P4-03: Add overlay window mode (transparent background)
- [ ] P4-04: Implement global hotkeys (start/stop, speaker toggle)
- [ ] P4-05: Add system tray integration
- [ ] P4-06: Create installer/DMG
- [ ] P4-07: Test audio capture permissions on macOS/Windows
- [ ] P4-08: Add auto-update mechanism
- [ ] P4-09: Create portable mode (no install required)
- [ ] P4-10: Sign application for distribution

### Notes
- Tauri v2 supports more permissive audio capture than browsers
- Can create floating overlay window that sits on top of other apps
- Global hotkeys work even when app is not focused

---

## Phase 5: Speaker Diarization ⏳ PENDING

### Tasks
- [ ] P5-01: Research Gemini's built-in speaker diarization
- [ ] P5-02: Add speaker identification to transcripts
- [ ] P5-03: Automatic speaker labeling (instead of manual A/B toggle)
- [ ] P5-04: Multi-speaker tracking (3+ speakers)
- [ ] P5-05: Speaker color coding in UI
- [ ] P5-06: Voice enrollment for named speakers (optional)

### Notes
- Gemini 2.0 Flash may have built-in diarization
- Alternative: pyannote.audio (requires server-side processing)
- May need to aggregate speaker segments

---

## Phase 6: Transcript Export & Session Analysis ⏳ PENDING

### Tasks
- [ ] P6-01: Create transcript data model (speaker, timestamp, text, verdicts)
- [ ] P6-02: Implement TXT export (plain text format)
- [ ] P6-03: Implement SRT export (SubRip subtitle format)
- [ ] P6-04: Implement VTT export (WebVTT for web players)
- [ ] P6-05: Add export button to UI
- [ ] P6-06: Create session summary component
- [ ] P6-07: Calculate factual accuracy score per speaker
- [ ] P6-08: Generate claim timeline visualization
- [ ] P6-09: Create verdict distribution chart (pie/bar)
- [ ] P6-10: Add source citation summary
- [ ] P6-11: Implement PDF export with charts
- [ ] P6-12: Add session history/storage
- [ ] P6-13: Create session comparison view

### Notes
- Store sessions in localStorage or IndexedDB for persistence
- Consider server-side storage for sharing sessions
- PDF generation using react-pdf or similar

---

## Bug Fixes & Improvements (Completed)

- [x] Fix hydration mismatch from browser extensions (suppressHydrationWarning)
- [x] Fix module path conflict (renamed lib/audio.ts to lib/audioUtils.ts)
- [x] Fix stop button not working (close Gemini sessions, kill processes)
- [x] Fix video blocked by transcript (z-index and hidden class)
- [x] Unmute YouTube iframe for user audio playback

---

## Architecture Notes

### Audio Flow
```
[Audio Source] → [16kHz PCM Float32] → [Gemini Live API] → [Transcription + Fact-check]
                         ↓
                 [VideoOverlayContainer]
                         ↓
              [VerdictOverlay + Subtitles]
```

### YouTube Architecture (Current)
```
┌─────────────────┐     ┌─────────────────┐
│  YouTube iframe │     │  yt-dlp+ffmpeg  │
│  (user sees &   │ ≠   │  (server-side)  │
│   hears video)  │     │  → SSE → Gemini │
└─────────────────┘     └─────────────────┘
Note: These are independent streams - seeking iframe doesn't affect extraction
```

### Source Provider Interface
```typescript
interface AudioSourceProvider {
  type: 'microphone' | 'youtube' | 'file' | 'screen';
  connect(events: AudioSourceEvents): Promise<void>;
  disconnect(): void;
  getVideoElement(): HTMLVideoElement | null;
  // ... other methods
}
```

---

## Commit History

- `ef874fb` - feat: Add multi-source media support and video overlay system (Phase 1 & 2)

---

**Last Updated**: 2024-11-30
