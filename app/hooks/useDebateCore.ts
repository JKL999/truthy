/**
 * useDebateCore - Core logic for two-speaker debate fact-checking
 * Manages two Gemini Live sessions (Speaker A & B), audio routing, and verdict parsing
 */

'use client';

import { GoogleGenAI, LiveServerMessage, Modality, Session } from '@google/genai';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createBlob, decode, decodeAudioData, AudioSourceProvider, MicrophoneSource } from '@/lib/audio';
import { Analyser } from '@/lib/analyser';
import { Speaker, Transcript, Verdict, DebateCoreState, DebateCoreActions } from '@/types';

const SYSTEM_INSTRUCTION = `You are Truthy, a neutral, real-time fact-checking agent for live debates. Your verdicts are displayed to a live audience.

TASKS:
1) Listen to incoming audio (automatically transcribed)
2) DETECT check-worthy factual claims (numbers, dates, rates, comparisons, attributions, named entities), or even things that can be checked with a quick Google search
3) USE GOOGLE SEARCH to find recent, authoritative evidence from official sources
4) Output ONLY a VERDICT as strict JSON:
   {
     "speaker": "A",
     "claim": "...",
     "label": "True|Mostly True|Mixed|Mostly False|False|Unverifiable",
     "confidence": 0.00-1.00,
     "rationale": "1-2 clear sentences with specific facts, numbers, and dates. Written for a live audience to understand quickly.",
     "sources": [{"name":"Clean source name","url":"...","as_of":"YYYY-MM-DD"}]
   }

RATIONALE WRITING GUIDELINES:
- Write for a LIVE AUDIENCE who needs to understand in <3 seconds
- Include SPECIFIC numbers, percentages, dates, or metrics
- Example GOOD: "Chicago reported 465 violent crimes YTD 2025 vs 557 in 2024, a 16.5% decrease according to CPD data."
- Example BAD: "The claim is mostly accurate based on recent data."
- For "Mixed" verdicts, explain BOTH sides briefly
- For "False" verdicts, state the CORRECT information

SOURCE GUIDELINES:
- Prioritize .gov, .edu, official dashboards, reputable news
- Use clean, recognizable names: "Chicago Police Dept" not "data.cityofchicago.org"
- Include 2-3 top sources maximum
- Always include publication/update dates

RULES:
- Penalize scope mismatches (violent vs total crime, per-capita vs absolute, YTD vs full year)
- If sources conflict, label "Mixed" and cite both perspectives
- If search yields insufficient evidence, return "Unverifiable"
- Maintain strict neutrality - no opinion or policy advocacy`;

export interface UseDebateCoreOptions {
  /** Optional audio source provider. If not provided, defaults to MicrophoneSource */
  audioSource?: AudioSourceProvider;
}

export function useDebateCore(options: UseDebateCoreOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isConnectedA, setIsConnectedA] = useState(false);
  const [isConnectedB, setIsConnectedB] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('A');
  const activeSpeakerRef = useRef<Speaker>('A'); // Ref to avoid closure issues in audio callback
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [currentTranscriptionA, setCurrentTranscriptionA] = useState('');
  const [currentTranscriptionB, setCurrentTranscriptionB] = useState('');
  const [audioLevelA, setAudioLevelA] = useState(0);
  const [audioLevelB, setAudioLevelB] = useState(0);
  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [mediaSourceType, setMediaSourceType] = useState<string>('microphone');

  // Audio source provider ref
  const audioSourceRef = useRef<AudioSourceProvider | null>(null);

  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionARef = useRef<Session | null>(null);
  const sessionBRef = useRef<Session | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const inputAnalyserRef = useRef<Analyser | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const sessionStartTimeRef = useRef<number>(0);
  const textBufferARef = useRef<string>('');
  const textBufferBRef = useRef<string>('');

  const updateStatus = (msg: string) => setStatus(msg);
  const updateError = (msg: string) => setError(msg);

  const initAudio = () => {
    if (outputAudioContextRef.current) {
      nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
    }
  };

  const initClient = async () => {
    initAudio();
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      updateError('NEXT_PUBLIC_GEMINI_API_KEY not found in environment');
      return;
    }

    clientRef.current = new GoogleGenAI({ apiKey });

    if (outputNodeRef.current && outputAudioContextRef.current) {
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);
    }

    await initSessions();
  };

  const handleMessage = (message: LiveServerMessage, speaker: Speaker, session: Session | null) => {
    // ===== DEBUG LOGGING START =====
    console.group(`[${speaker}] Gemini Message`);
    console.log('Full message:', message);

    if (message.toolCall) {
      console.warn('🔧 TOOL CALL DETECTED:', message.toolCall);
      if (message.toolCall.functionCalls) {
        console.warn('  Function calls:', message.toolCall.functionCalls);
      }
    }

    if (message.serverContent?.groundingMetadata) {
      console.warn('🔍 GROUNDING METADATA (Google Search Results):', message.serverContent.groundingMetadata);
    }

    if (message.serverContent?.modelTurn?.parts) {
      console.log('📝 Model parts:', message.serverContent.modelTurn.parts);
    }

    if (message.serverContent?.inputTranscription) {
      console.log('🎤 Input transcription:', message.serverContent.inputTranscription);
    }

    console.groupEnd();
    // ===== DEBUG LOGGING END =====

    if (message.setupComplete) {
      updateStatus(`Speaker ${speaker} connected to Truthy AI`);
    }

    // Handle live audio transcription
    if (message.serverContent?.inputTranscription) {
      const transcriptionText = message.serverContent.inputTranscription.text || '';
      if (speaker === 'A') {
        setCurrentTranscriptionA((prev) => prev + transcriptionText);
      } else {
        setCurrentTranscriptionB((prev) => prev + transcriptionText);
      }
    }

    // Handle turn completion - finalize transcription
    if (message.serverContent?.turnComplete) {
      const currentTranscription = speaker === 'A' ? currentTranscriptionA : currentTranscriptionB;

      if (currentTranscription.trim()) {
        const transcript: Transcript = {
          speaker,
          text: currentTranscription.trim(),
          timestamp: Date.now() - sessionStartTimeRef.current,
        };
        setTranscripts((prev) => [...prev, transcript]);

        // Clear current transcription
        if (speaker === 'A') {
          setCurrentTranscriptionA('');
        } else {
          setCurrentTranscriptionB('');
        }
      }

      // Clear text buffer to prevent accumulated non-JSON text from interfering with future verdicts
      const bufferRef = speaker === 'A' ? textBufferARef : textBufferBRef;
      bufferRef.current = '';
    }

    // Handle audio playback
    const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
    if (audio && outputAudioContextRef.current) {
      nextStartTimeRef.current = Math.max(
        nextStartTimeRef.current,
        outputAudioContextRef.current.currentTime
      );
      decodeAudioData(decode(audio.data!), outputAudioContextRef.current, 24000, 1)
        .then((audioBuffer) => {
          const source = outputAudioContextRef.current!.createBufferSource();
          source.buffer = audioBuffer;
          if (outputNodeRef.current) source.connect(outputNodeRef.current);
          source.addEventListener('ended', () => sourcesRef.current.delete(source));
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
          sourcesRef.current.add(source);

          if (speaker === 'A') setIsPlayingA(true);
          else setIsPlayingB(true);

          source.addEventListener('ended', () => {
            if (sourcesRef.current.size === 1) {
              if (speaker === 'A') setIsPlayingA(false);
              else setIsPlayingB(false);
            }
          });
        });
    }

    // Parse text: verdict JSON or transcript
    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.text) {
        // Add to appropriate buffer
        const bufferRef = speaker === 'A' ? textBufferARef : textBufferBRef;
        bufferRef.current += part.text;

        console.log(`[${speaker}] 📨 Model text received:`, part.text);
        console.log(`[${speaker}] 📝 Buffer state:`, bufferRef.current);

        // Remove markdown code fences
        let cleanText = bufferRef.current.replace(/```json\s*|\s*```/g, '').trim();

        // Try to find a complete JSON object with balanced braces
        const startIdx = cleanText.indexOf('{');
        if (startIdx !== -1) {
          console.log(`[${speaker}] 🔍 Found JSON start at index ${startIdx}`);
          let braceCount = 0;
          let endIdx = -1;

          for (let i = startIdx; i < cleanText.length; i++) {
            if (cleanText[i] === '{') braceCount++;
            if (cleanText[i] === '}') braceCount--;
            if (braceCount === 0) {
              endIdx = i + 1;
              break;
            }
          }

          if (endIdx !== -1) {
            const jsonStr = cleanText.substring(startIdx, endIdx);
            console.log(`[${speaker}] 📦 Extracted JSON string:`, jsonStr);
            try {
              const parsed = JSON.parse(jsonStr);
              console.log(`[${speaker}] ✅ JSON parsed successfully:`, parsed);
              if (parsed.claim && parsed.label && parsed.confidence !== undefined) {
                const verdict: Verdict = {
                  speaker,
                  claim: parsed.claim,
                  label: parsed.label,
                  confidence: parsed.confidence,
                  rationale: parsed.rationale || '',
                  sources: parsed.sources || [],
                  timestamp: Date.now() - sessionStartTimeRef.current,
                };
                setVerdicts((prev) => [...prev, verdict]);
                updateStatus(`Verdict: ${verdict.label} (${(verdict.confidence * 100).toFixed(0)}%)`);
                console.log(`[${speaker}] ⚖️ Verdict created and added to UI:`, verdict);

                // Remove the parsed JSON from buffer (use original buffer, not cleanText)
                const jsonInOriginal = bufferRef.current.indexOf('{');
                if (jsonInOriginal !== -1) {
                  // Find the end in the original buffer
                  let origBraceCount = 0;
                  let origEndIdx = -1;
                  for (let i = jsonInOriginal; i < bufferRef.current.length; i++) {
                    if (bufferRef.current[i] === '{') origBraceCount++;
                    if (bufferRef.current[i] === '}') origBraceCount--;
                    if (origBraceCount === 0) {
                      origEndIdx = i + 1;
                      break;
                    }
                  }
                  if (origEndIdx !== -1) {
                    bufferRef.current = bufferRef.current.substring(origEndIdx).trim();
                  }
                }
              } else {
                console.warn(`[${speaker}] ⚠️ Parsed JSON missing required fields:`, {
                  hasClaim: !!parsed.claim,
                  hasLabel: !!parsed.label,
                  hasConfidence: parsed.confidence !== undefined,
                  parsed
                });
              }
            } catch (e) {
              // JSON parsing failed, keep accumulating
              console.warn(`[${speaker}] ❌ JSON parsing failed:`, e);
              console.warn(`[${speaker}] Failed JSON string:`, jsonStr);
            }
          } else {
            console.log(`[${speaker}] ⏳ JSON incomplete, waiting for more data...`);
          }
        } else {
          console.log(`[${speaker}] 📄 No JSON found in buffer (plain text response)`);
        }
      }
    }

    // Handle interruption
    if (message.serverContent?.interrupted) {
      sourcesRef.current.forEach((s) => s.stop());
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }
  };

  const initSessions = async () => {
    if (!clientRef.current) return;

    // ===== DEBUG: Log session config =====
    const sessionConfig = {
      model: 'gemini-live-2.5-flash-preview',
      config: {
        responseModalities: [Modality.TEXT],
        tools: [{ googleSearch: {} }],
        inputAudioTranscription: {},
        systemInstruction: SYSTEM_INSTRUCTION.substring(0, 300) + '...',
      },
    };
    console.group('🚀 Initializing Gemini Sessions');
    console.log('Session config:', sessionConfig);
    console.log('Full system instruction:', SYSTEM_INSTRUCTION);
    console.groupEnd();
    // ===== END DEBUG =====

    try {
      // Session A
      sessionARef.current = await clientRef.current.live.connect({
        model: 'gemini-live-2.5-flash-preview',
        callbacks: {
          onopen: () => {
            setIsConnectedA(true);
            updateStatus('Speaker A session connected');
          },
          onmessage: (msg: LiveServerMessage) => handleMessage(msg, 'A', sessionARef.current),
          onerror: (e: ErrorEvent) => updateError(`Speaker A error: ${e.message}`),
          onclose: (e: CloseEvent) => {
            setIsConnectedA(false);
            updateStatus(`Speaker A disconnected: ${e.reason}`);
          },
        },
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} } as any],
          inputAudioTranscription: {},
        },
      });

      // Session B
      sessionBRef.current = await clientRef.current.live.connect({
        model: 'gemini-live-2.5-flash-preview',
        callbacks: {
          onopen: () => {
            setIsConnectedB(true);
            updateStatus('Speaker B session connected');
          },
          onmessage: (msg: LiveServerMessage) => handleMessage(msg, 'B', sessionBRef.current),
          onerror: (e: ErrorEvent) => updateError(`Speaker B error: ${e.message}`),
          onclose: (e: CloseEvent) => {
            setIsConnectedB(false);
            updateStatus(`Speaker B disconnected: ${e.reason}`);
          },
        },
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} } as any],
          inputAudioTranscription: {},
        },
      });
    } catch (e) {
      updateError(e instanceof Error ? e.message : 'Unknown error initializing sessions');
    }
  };

  const startRecording = async () => {
    if (isRecording) return;

    if (!sessionARef.current || !sessionBRef.current) {
      await initSessions();
    }

    if (inputAudioContextRef.current) inputAudioContextRef.current.resume();

    sessionStartTimeRef.current = Date.now();

    try {
      // Use provided audio source or create default MicrophoneSource
      const audioSource = options.audioSource ?? new MicrophoneSource();
      audioSourceRef.current = audioSource;

      updateStatus(`Connecting to ${audioSource.type} source...`);

      // Connect the audio source with callbacks
      await audioSource.connect({
        onAudioData: (pcmData: Float32Array) => {
          if (!isRecordingRef.current) return;

          // Route to active speaker session (use ref to avoid closure issues)
          const activeSession = activeSpeakerRef.current === 'A' ? sessionARef.current : sessionBRef.current;
          activeSession?.sendRealtimeInput({ media: createBlob(pcmData) });
        },
        onStart: () => {
          updateStatus(`${audioSource.type} source connected. Recording...`);
        },
        onStop: () => {
          updateStatus(`${audioSource.type} source stopped.`);
        },
        onError: (err) => {
          updateError(`${audioSource.type} error: ${err.message}`);
        },
        onEnded: () => {
          // For file sources, stop recording when playback ends
          updateStatus('Media playback ended.');
          stopRecording();
        },
      });

      // Get video element if available (for file/YouTube/screen sources)
      const video = audioSource.getVideoElement();
      if (video) {
        setVideoElement(video);
      }

      // Update media source type for UI
      setMediaSourceType(audioSource.type);

      // Connect gain node for level monitoring if available
      const gainNode = audioSource.getGainNode();
      if (gainNode && inputAnalyserRef.current) {
        inputAnalyserRef.current = new Analyser(gainNode);
      }

      setIsRecording(true);
      isRecordingRef.current = true;
      updateStatus(`Recording for Speaker ${activeSpeaker}...`);
    } catch (err) {
      updateStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      stopRecording();
    }
  };

  const stopRecording = () => {
    // Always allow stopping - don't early return to prevent stuck state
    console.log('[stopRecording] Called, isRecording:', isRecording, 'audioSourceRef:', !!audioSourceRef.current);

    setIsRecording(false);
    isRecordingRef.current = false;

    // Close Gemini sessions to stop any ongoing transcription
    // They will be reinitialized on next recording start
    if (sessionARef.current) {
      console.log('[stopRecording] Closing session A');
      try {
        sessionARef.current.close();
      } catch (e) {
        console.warn('[stopRecording] Error closing session A:', e);
      }
      sessionARef.current = null;
      setIsConnectedA(false);
    }

    if (sessionBRef.current) {
      console.log('[stopRecording] Closing session B');
      try {
        sessionBRef.current.close();
      } catch (e) {
        console.warn('[stopRecording] Error closing session B:', e);
      }
      sessionBRef.current = null;
      setIsConnectedB(false);
    }

    // Disconnect audio source provider
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.disconnect();
      } catch (e) {
        console.warn('[stopRecording] Error disconnecting audio source:', e);
      }
      audioSourceRef.current = null;
    }

    // Legacy cleanup for backward compatibility
    if (scriptProcessorNodeRef.current) {
      try {
        scriptProcessorNodeRef.current.disconnect();
      } catch (e) {
        console.warn('[stopRecording] Error disconnecting script processor:', e);
      }
      scriptProcessorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {
        console.warn('[stopRecording] Error disconnecting source node:', e);
      }
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // Clear video element when stopping
    setVideoElement(null);

    updateStatus('Recording stopped.');
    updateError(''); // Clear any error messages

    // Reinitialize sessions for next recording
    initSessions();
  };

  const reset = () => {
    sessionARef.current?.close();
    sessionBRef.current?.close();
    setTranscripts([]);
    setVerdicts([]);
    initSessions();
  };

  const handleSetActiveSpeaker = (speaker: Speaker) => {
    // Flush current transcription from the previous speaker before switching
    if (speaker === 'A' && currentTranscriptionB.trim()) {
      // Switching TO A, so finalize B's current transcription
      const transcript: Transcript = {
        speaker: 'B',
        text: currentTranscriptionB.trim(),
        timestamp: Date.now() - sessionStartTimeRef.current,
      };
      setTranscripts((prev) => [...prev, transcript]);
      setCurrentTranscriptionB('');
    } else if (speaker === 'B' && currentTranscriptionA.trim()) {
      // Switching TO B, so finalize A's current transcription
      const transcript: Transcript = {
        speaker: 'A',
        text: currentTranscriptionA.trim(),
        timestamp: Date.now() - sessionStartTimeRef.current,
      };
      setTranscripts((prev) => [...prev, transcript]);
      setCurrentTranscriptionA('');
    }

    // Update both state and ref (ref is used by audio routing callback)
    setActiveSpeaker(speaker);
    activeSpeakerRef.current = speaker;

    if (isRecording) {
      updateStatus(`Switched to Speaker ${speaker}`);
    }
  };

  const toggleDebugMode = () => {
    setDebugMode((prev) => !prev);
  };

  const sendTextInput = (text: string) => {
    if (!text.trim()) return;

    console.group('📤 Debug Text Input');
    console.log('Speaker:', activeSpeaker);
    console.log('Text:', text);
    console.groupEnd();

    // Add text directly to transcripts to simulate spoken input
    const transcript: Transcript = {
      speaker: activeSpeaker,
      text: text.trim(),
      timestamp: Date.now() - sessionStartTimeRef.current,
    };
    setTranscripts((prev) => [...prev, transcript]);

    // Also send to the session for processing
    const activeSession = activeSpeaker === 'A' ? sessionARef.current : sessionBRef.current;

    if (!activeSession) {
      updateError('Session not connected');
      return;
    }

    // Send text message to the session using sendClientContent (per Live API docs)
    try {
      activeSession.sendClientContent({ turns: text });
      updateStatus(`Debug: Sent text for Speaker ${activeSpeaker}`);
      console.log(`✅ Text sent to Gemini session ${activeSpeaker}`);
    } catch (err) {
      updateError(`Failed to send text: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('❌ Failed to send text:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted) return;

      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });

      if (inputAudioContextRef.current && outputAudioContextRef.current) {
        inputNodeRef.current = inputAudioContextRef.current.createGain();
        outputNodeRef.current = outputAudioContextRef.current.createGain();

        if (inputNodeRef.current) {
          inputAnalyserRef.current = new Analyser(inputNodeRef.current);
        }
      }

      const updateLevels = () => {
        if (inputAnalyserRef.current) {
          inputAnalyserRef.current.update();
          const level = Math.max(...Array.from(inputAnalyserRef.current.data)) / 255;
          // Use ref to avoid closure issues
          if (activeSpeakerRef.current === 'A') {
            setAudioLevelA(level);
            setAudioLevelB(0);
          } else {
            setAudioLevelB(level);
            setAudioLevelA(0);
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();

      await initClient();
    };

    init();

    return () => {
      mounted = false;
      stopRecording();
      sessionARef.current?.close();
      sessionBRef.current?.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
    };
  }, []);

  const state: DebateCoreState = {
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
  };

  const actions: DebateCoreActions = {
    startRecording,
    stopRecording,
    setActiveSpeaker: handleSetActiveSpeaker,
    reset,
    toggleDebugMode,
    sendTextInput,
  };

  return { state, actions };
}
