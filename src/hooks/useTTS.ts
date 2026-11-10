import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { useSettingsStore } from '../store/useSettingsStore';
import type { PlaybackState, SleepTimerState, VivosVoice } from '../types';
import {
  checkModelReady,
  downloadModel,
  synthesize,
  VIVOS_VOICES,
  getVoiceById,
  parseSpeakerIdFromURI,
} from '../services/piperService';
import {
  EDGE_VOICES,
  getEdgeVoiceById,
  getDefaultEdgeVoice,
  fetchEdgeTTSBlob,
  type EdgeVoice,
} from '../services/edgeTTSService';
import {
  KOKORO_VOICES,
  getKokoroVoiceById,
  kokoroService,
  type KokoroVoiceItem,
} from '../services/kokoroClientService';
import {
  VIENEU_VOICES,
  getVieNeuVoiceById,
  fetchVieNeuTTSBlob,
  type VieNeuVoiceItem,
} from '../services/vieneuService';
import { TTSConnectionError } from '../services/ttsRequest';
import { LookaheadQueue } from '../services/lookaheadQueue';
import { logAudio } from '../utils/audioDebugLog';
import { normalizeSentenceForTTS } from '../utils/epubHelper';


// A valid 1s mono PCM WAV that is silent but not all zeros (some engines skip pure digital silence)
const makeSilentWavUrl = (): string => {
  const sampleRate = 8000;
  const samples = sampleRate;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 50) v.setInt16(44 + i * 2, 1, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
};

// pause events are asynchronous: playback intent may already be true again when an
// intentional source swap's pause event arrives. Account for each actual pause.
const internalPauses = new WeakMap<HTMLAudioElement, number>();
const pauseAudioInternally = (audio: HTMLAudioElement) => {
  if (!audio.paused) {
    internalPauses.set(audio, (internalPauses.get(audio) || 0) + 1);
    audio.pause();
  }
};

// iOS 16.4+: declare this page as media playback so audio survives the silent switch and screen lock
const setPlaybackAudioSession = () => {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {}
};

export interface UseTTSReturn {
  playbackState: PlaybackState;
  engineMode: 'edge' | 'kokoro' | 'vieneu' | 'neural' | 'system';
  setEngineMode: (mode: 'edge' | 'kokoro' | 'vieneu' | 'neural' | 'system') => void;
  edgeVoices: EdgeVoice[];
  selectedEdgeVoice: EdgeVoice | null;
  kokoroVoices: KokoroVoiceItem[];
  selectedKokoroVoice: KokoroVoiceItem | null;
  vieneuVoices: VieNeuVoiceItem[];
  selectedVieNeuVoice: VieNeuVoiceItem | null;
  isKokoroReady: boolean;
  kokoroProgress: number;
  isDownloadingKokoro: boolean;
  downloadKokoroModel: (onProgress?: (percent: number) => void) => Promise<void>;
  isModelReady: boolean;
  downloadProgress: number;
  isDownloadingModel: boolean;
  downloadNeuralModel: (onProgress?: (percent: number) => void) => Promise<void>;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  vivosVoices: VivosVoice[];
  selectedVivosVoice: VivosVoice | null;
  sentences: string[];
  currentSentenceIndex: number;
  currentSentence: string;
  sleepTimer: SleepTimerState;
  play: (textList?: string[], startIndex?: number) => void;
  prepareChapterTransition: () => void;
  continueChapter: (textList: string[], startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextSentence: () => void;
  prevSentence: () => void;
  jumpToSentence: (index: number) => void;
  setSentencesList: (list: string[], initialIndex?: number) => void;
  startSleepTimer: (minutes: number | 'chapter') => void;
  cancelSleepTimer: () => void;
  previewVoice: (voiceURI: string, sampleText?: string) => void;
  isIOS: boolean;
}

export interface UseTTSOptions {
  onPlaybackCancelled?: () => void;
  onSentenceChange?: (index: number, sentence: string) => void;
  onChapterComplete?: () => boolean | void;
  onPrefetchNextChapter?: () => Promise<string[] | undefined>;
  bookTitle?: string;
  chapterTitle?: string;
  bookCoverUrl?: string;
}

export function useTTS(
  optionsOrSentenceChange?: ((index: number, sentence: string) => void) | UseTTSOptions
): UseTTSReturn {
  const onSentenceChange =
    typeof optionsOrSentenceChange === 'function'
      ? optionsOrSentenceChange
      : optionsOrSentenceChange?.onSentenceChange;
  const onChapterComplete =
    typeof optionsOrSentenceChange === 'object'
      ? optionsOrSentenceChange?.onChapterComplete
      : undefined;
  const onPrefetchNextChapter =
    typeof optionsOrSentenceChange === 'object'
      ? optionsOrSentenceChange?.onPrefetchNextChapter
      : undefined;
  const bookTitle =
    typeof optionsOrSentenceChange === 'object'
      ? optionsOrSentenceChange?.bookTitle
      : undefined;
  const chapterTitle =
    typeof optionsOrSentenceChange === 'object'
      ? optionsOrSentenceChange?.chapterTitle
      : undefined;
  const bookCoverUrl =
    typeof optionsOrSentenceChange === 'object'
      ? optionsOrSentenceChange?.bookCoverUrl
      : undefined;

  const onPlaybackCancelled = typeof optionsOrSentenceChange === 'object'
    ? optionsOrSentenceChange.onPlaybackCancelled : undefined;
  const onPlaybackCancelledRef = useRef(onPlaybackCancelled);
  useEffect(() => { onPlaybackCancelledRef.current = onPlaybackCancelled; }, [onPlaybackCancelled]);

  const onChapterCompleteRef = useRef(onChapterComplete);
  useEffect(() => {
    onChapterCompleteRef.current = onChapterComplete;
  }, [onChapterComplete]);

  const onPrefetchNextChapterRef = useRef(onPrefetchNextChapter);
  useEffect(() => {
    onPrefetchNextChapterRef.current = onPrefetchNextChapter;
  }, [onPrefetchNextChapter]);

  const onSentenceChangeRef = useRef(onSentenceChange);
  useEffect(() => {
    onSentenceChangeRef.current = onSentenceChange;
  }, [onSentenceChange]);

  const {
    speechRate,
    speechPitch,
    volume,
    selectedVoiceURI,
    setSelectedVoiceURI,
    engineMode,
    setEngineMode,
    neuralSpeakerId,
    neuralModelDownloaded,
    setNeuralModelDownloaded,
  } = useSettingsStore();

  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  // Piper Model Download States
  const [isModelReady, setIsModelReady] = useState<boolean>(neuralModelDownloaded);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloadingModel, setIsDownloadingModel] = useState<boolean>(false);

  // Kokoro Client-side WebGPU/WASM Model States
  const [isKokoroReady, setIsKokoroReady] = useState<boolean>(false);
  const [kokoroProgress, setKokoroProgress] = useState<number>(0);
  const [isDownloadingKokoro, setIsDownloadingKokoro] = useState<boolean>(false);

  useEffect(() => {
    kokoroService.isModelReady().then(setIsKokoroReady);
  }, []);

  const downloadKokoroModel = useCallback(async (onProgress?: (percent: number) => void) => {
    setIsDownloadingKokoro(true);
    setKokoroProgress(0);
    try {
      await kokoroService.loadModel((pct) => {
        setKokoroProgress(pct);
        if (onProgress) onProgress(pct);
      });
      setIsKokoroReady(true);
    } catch (err) {
      console.error('[Kokoro Download Error]:', err);
      throw err;
    } finally {
      setIsDownloadingKokoro(false);
    }
  }, []);

  // Sleep timer state
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({
    isActive: false,
    totalSeconds: 0,
    remainingSeconds: 0,
    targetMode: 'time',
    fadeAudio: true,
  });

  // Dual-Engine Audio Elements and References
  const timerIntervalRef = useRef<number | null>(null);
  const keepAliveIntervalRef = useRef<number | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const neuralAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const lookaheadQueueRef = useRef<LookaheadQueue>(new LookaheadQueue());
  const currentBlobUrlRef = useRef<string | null>(null);

  // Cross-Chapter Lookahead Buffer (Prefetches first 2 sentences of next chapter for 0ms transition)
  interface CrossChapterItem {
    sentence: string;
    blobUrl: string | null;
    promise: Promise<string>;
  }
  const crossChapterPrefetchRef = useRef<{
    sentences: string[];
    items: Map<number, CrossChapterItem>;
  } | null>(null);
  const isPrefetchingCrossChapterRef = useRef<boolean>(false);
  const crossChapterGenerationRef = useRef(0);
  const clearCrossChapterPrefetch = useCallback(() => {
    crossChapterGenerationRef.current++;
    const prefetched = crossChapterPrefetchRef.current;
    crossChapterPrefetchRef.current = null;
    isPrefetchingCrossChapterRef.current = false;
    prefetched?.items.forEach((item) => {
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
      else item.promise.then((url) => { if (url) URL.revokeObjectURL(url); }).catch(() => {});
    });
  }, []);


  const isPlayingRef = useRef<boolean>(false);
  const currentSentenceIndexRef = useRef<number>(0);
  const sentencesRef = useRef<string[]>([]);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sleepTimerRef = useRef<SleepTimerState>(sleepTimer);
  const playCurrentSentenceRef = useRef<() => void>(() => {});
  const playbackGenerationRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentenceGapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingGapNextIndexRef = useRef<number | null>(null);
  const retryPendingRef = useRef(false);
  const retryCountRef = useRef(0);
  const resumePositionRef = useRef<number | null>(null);
  const chapterTransitionRef = useRef(false);
  const userGesturePrimeRef = useRef(false);
  const invalidatePlayback = useCallback(() => {
    playbackGenerationRef.current += 1;
    if (sentenceGapTimerRef.current !== null) clearTimeout(sentenceGapTimerRef.current);
    sentenceGapTimerRef.current = null;
    pendingGapNextIndexRef.current = null;
    if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    retryPendingRef.current = false;
  }, []);

  useEffect(() => {
    const recover = (event: Event) => {
      if (!isPlayingRef.current || !retryPendingRef.current ||
          (event.type === 'visibilitychange' && document.hidden)) return;
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      retryPendingRef.current = false;
      playCurrentSentenceRef.current();
    };
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
      isPlayingRef.current = false;
      invalidatePlayback();
    };
  }, [invalidatePlayback]);


  // Detect iOS Safari
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  // Sync state refs to prevent re-render loops in event callbacks
  useEffect(() => {
    currentSentenceIndexRef.current = currentSentenceIndex;
  }, [currentSentenceIndex]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    sleepTimerRef.current = sleepTimer;
  }, [sleepTimer]);

  // Check model status in OPFS on mount
  useEffect(() => {
    checkModelReady().then((ready) => {
      setIsModelReady(ready);
      setNeuralModelDownloaded(ready);
    });
  }, [setNeuralModelDownloaded]);

  // 1. Initialize System Web Speech voices with fallback polling for iOS Safari
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices && availableVoices.length > 0) {
        setVoices(availableVoices);

        // Auto select Vietnamese voice if not set and engine is system
        if (!selectedVoiceURI) {
          const vnVoices = availableVoices.filter(
            (v) =>
              v.lang.toLowerCase().startsWith('vi') ||
              v.name.toLowerCase().includes('vietnam') ||
              v.name.toLowerCase().includes('tiếng việt') ||
              v.name.toLowerCase().includes('hoaimy') ||
              v.name.toLowerCase().includes('hoài my') ||
              v.name.toLowerCase().includes('namminh') ||
              v.name.toLowerCase().includes('nam minh')
          );
          const naturalVoice =
            vnVoices.find((v) =>
              /online|natural|neural|hoài|hoaimy|namminh|nam minh/i.test(v.name)
            ) || vnVoices[0];

          if (naturalVoice) {
            setSelectedVoiceURI(naturalVoice.voiceURI);
          }
        }
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    const interval = setInterval(loadVoices, 1000);
    const timeout = setTimeout(() => clearInterval(interval), 5000);

    return () => {
      synth.onvoiceschanged = null;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [selectedVoiceURI, setSelectedVoiceURI]);

  // Helper: List Vietnamese system voices with Natural/Studio voices at top
  const vietnameseVoices = useMemo(() => {
    const list = voices.filter(
      (v) =>
        v.lang.toLowerCase().startsWith('vi') ||
        v.name.toLowerCase().includes('vietnam') ||
        v.name.toLowerCase().includes('tiếng việt') ||
        v.name.toLowerCase().includes('hoaimy') ||
        v.name.toLowerCase().includes('hoài my') ||
        v.name.toLowerCase().includes('namminh') ||
        v.name.toLowerCase().includes('nam minh')
    );
    return [...list].sort((a, b) => {
      const aIsStudio = /online|natural|neural|hoài|hoaimy|namminh|nam minh|linh|\ban\b/i.test(a.name) ? 1 : 0;
      const bIsStudio = /online|natural|neural|hoài|hoaimy|namminh|nam minh|linh|\ban\b/i.test(b.name) ? 1 : 0;
      return bIsStudio - aIsStudio;
    });
  }, [voices]);

  const selectedVoice =
    voices.find((v) => v.voiceURI === selectedVoiceURI) ||
    vietnameseVoices[0] ||
    voices[0] ||
    null;

  const edgeVoices = EDGE_VOICES;
  const selectedEdgeVoice = getEdgeVoiceById(selectedVoiceURI) || getDefaultEdgeVoice();

  const kokoroVoices = KOKORO_VOICES;
  const selectedKokoroVoice = getKokoroVoiceById(selectedVoiceURI) || KOKORO_VOICES[0];

  const vieneuVoices = VIENEU_VOICES;
  const selectedVieNeuVoice = getVieNeuVoiceById(selectedVoiceURI) || VIENEU_VOICES[0];

  const vivosVoices = VIVOS_VOICES;
  const currentSpeakerId = selectedVoiceURI.startsWith('piper:')
    ? parseSpeakerIdFromURI(selectedVoiceURI)
    : neuralSpeakerId;
  const selectedVivosVoice = getVoiceById(selectedVoiceURI) || vivosVoices[currentSpeakerId] || vivosVoices[0];

  // 2. Setup HTML5 Audio Elements for Neural Engine and Silent Audio
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Silent audio element for iOS Safari background keep-alive in system mode
    setPlaybackAudioSession();
    const silentUrl = makeSilentWavUrl();
    const silentAudio = new Audio(silentUrl);
    silentAudio.loop = true;
    silentAudio.setAttribute('playsinline', 'true');
    (silentAudio as any).playsInline = true;
    silentAudioRef.current = silentAudio;

    // Standard HTML5 Audio Element for Neural Piper / Edge Engine
    const neuralAudio = new Audio();
    neuralAudio.setAttribute('playsinline', 'true');
    (neuralAudio as any).playsInline = true;
    neuralAudioRef.current = neuralAudio;

    const markPaused = () => {
      onPlaybackCancelledRef.current?.();
      invalidatePlayback();
      chapterTransitionRef.current = false;
      userGesturePrimeRef.current = false;
      isPlayingRef.current = false;
      silentAudio.pause();
      setPlaybackState('paused');
      try {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      } catch {}
    };

    // OS-level interruption (call, Siri, screen lock, headphones unplugged)
    const onSystemPause = () => {
      logAudio('audio.pause', `hidden=${document.hidden} ended=${neuralAudio.ended}`);
      const internal = internalPauses.get(neuralAudio) || 0;
      if (internal > 0) {
        internalPauses.set(neuralAudio, internal - 1);
        return;
      }
      if (!neuralAudio.paused || !isPlayingRef.current || chapterTransitionRef.current ||
          neuralAudio.ended || !neuralAudio.src) return;
      const generation = playbackGenerationRef.current;
      const source = neuralAudio.src;
      const ownsResume = () => isPlayingRef.current && generation === playbackGenerationRef.current &&
        source === neuralAudio.src && !chapterTransitionRef.current;
      if (document.hidden) {
        // Safari may pause on lock: try once to keep going, otherwise reflect it in the UI
        neuralAudio
          .play()
          .then(() => logAudio('audio.resumed-in-background'))
          .catch((e) => {
            logAudio('audio.resume-failed', e?.name);
            if (ownsResume()) markPaused();
          });
        return;
      }
      markPaused();
    };
    neuralAudio.addEventListener('pause', onSystemPause);

    const mediaEvents = ['play', 'playing', 'ended', 'error', 'waiting', 'stalled', 'emptied', 'suspend'] as const;
    const onMedia = (ev: Event) => {
      const err = ev.type === 'error' ? neuralAudio.error : null;
      logAudio(`audio.${ev.type}`, `hidden=${document.hidden}${err ? ` code=${err.code} src=${neuralAudio.getAttribute('src') ? 'set' : 'empty'}` : ''}`);
    };
    mediaEvents.forEach((n) => neuralAudio.addEventListener(n, onMedia));
    silentAudio.addEventListener('pause', () => logAudio('silent.pause', `hidden=${document.hidden}`));
    silentAudio.addEventListener('error', () => {
      if (silentAudio.getAttribute('src')) logAudio('silent.error', silentAudio.error?.code);
    });

    const onVisibility = () => {
      logAudio('vis', document.visibilityState);
      if (!document.hidden && isPlayingRef.current && !chapterTransitionRef.current &&
          neuralAudio.paused && neuralAudio.src && !neuralAudio.ended) {
        const generation = playbackGenerationRef.current;
        const source = neuralAudio.src;
        neuralAudio.play().catch(() => {
          if (isPlayingRef.current && generation === playbackGenerationRef.current &&
              source === neuralAudio.src && !chapterTransitionRef.current) markPaused();
        });
      }
    };
    const onPageHide = () => logAudio('pagehide');
    const onFreeze = () => logAudio('freeze');
    const onResume = () => logAudio('resume');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('freeze', onFreeze);
    document.addEventListener('resume', onResume);

    const queue = lookaheadQueueRef.current;

    return () => {
      neuralAudio.removeEventListener('pause', onSystemPause);
      mediaEvents.forEach((n) => neuralAudio.removeEventListener(n, onMedia));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('freeze', onFreeze);
      document.removeEventListener('resume', onResume);
      silentAudio.pause();
      silentAudio.removeAttribute('src');
      silentAudio.load();
      URL.revokeObjectURL(silentUrl);
      neuralAudio.pause();
      silentAudioRef.current = null;
      neuralAudioRef.current = null;
      queue.clear();
      clearCrossChapterPrefetch();
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [clearCrossChapterPrefetch, invalidatePlayback]);

  // Update MediaSession metadata
  const updateMediaSession = useCallback(
    (textToSpeak: string) => {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.playbackState = 'playing';
        const isKokoro = selectedVoiceURI.startsWith('kokoro:') || engineMode === 'kokoro';
        const isVieNeu = selectedVoiceURI.startsWith('vieneu:') || engineMode === 'vieneu';
        const isEdge =
          selectedVoiceURI === 'vi-VN-HoaiMyNeural' ||
          selectedVoiceURI === 'vi-VN-NamMinhNeural' ||
          selectedVoiceURI.endsWith('Neural') ||
          engineMode === 'edge';
        const isNeural = selectedVoiceURI.startsWith('piper:') || engineMode === 'neural';

        let voiceName = 'AudioEpub Reader';
        if (isKokoro) {
          const kVoice = getKokoroVoiceById(selectedVoiceURI) || KOKORO_VOICES[0];
          voiceName = `${kVoice.name} (Kokoro Client AI)`;
        } else if (isVieNeu) {
          const vVoice = getVieNeuVoiceById(selectedVoiceURI) || VIENEU_VOICES[0];
          voiceName = `${vVoice.name} (VieNeu 48kHz)`;
        } else if (isEdge) {
          const edgeVoice = getEdgeVoiceById(selectedVoiceURI) || getDefaultEdgeVoice();
          voiceName = `${edgeVoice.name} (Studio AI)`;
        } else if (isNeural) {
          voiceName = selectedVivosVoice?.name || 'VIVOS AI Tiếng Việt';
        } else {
          voiceName = selectedVoice?.name || 'AudioEpub Reader';
        }

        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: textToSpeak.length > 60 ? `${textToSpeak.slice(0, 60)}...` : textToSpeak,
          artist: voiceName,
          album: chapterTitle || bookTitle || 'Sách nói EPUB Tiếng Việt',
          artwork: bookCoverUrl
            ? [
                {
                  src: bookCoverUrl,
                  sizes: '512x512',
                  type: /^data:(image\/[a-z+.-]+)/i.exec(bookCoverUrl)?.[1] || 'image/jpeg',
                },
              ]
            : [
                { src: new URL(`${import.meta.env.BASE_URL}icon-512.png`, document.baseURI).href, sizes: '512x512', type: 'image/png' },
                { src: new URL(`${import.meta.env.BASE_URL}icon-192.png`, document.baseURI).href, sizes: '192x192', type: 'image/png' },
              ],
        });
      } catch (err) {
        console.warn('Failed to update MediaSession metadata:', err);
      }
    },
    [selectedVoiceURI, engineMode, selectedVivosVoice, selectedVoice, chapterTitle, bookTitle, bookCoverUrl]
  );

  // 3. Keep-alive for Chrome 15s freeze bug in System Web Speech Mode
  const startKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
    keepAliveIntervalRef.current = window.setInterval(() => {
      if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
  }, []);

  // Download Neural Model from CDN / Hugging Face with progress
  const downloadNeuralModel = useCallback(
    async (onProgress?: (percent: number) => void) => {
      setIsDownloadingModel(true);
      setDownloadProgress(0);
      try {
        await downloadModel((percent) => {
          setDownloadProgress(percent);
          if (onProgress) onProgress(percent);
        });
        const ready = await checkModelReady();
        setIsModelReady(ready);
        setNeuralModelDownloaded(ready);
      } catch (err) {
        console.error('Error downloading Neural model:', err);
        throw err;
      } finally {
        setIsDownloadingModel(false);
      }
    },
    [setNeuralModelDownloaded]
  );

  // Advance to next sentence helper (handles chapter complete & sleep timer)
  const advanceToNext = useCallback(
    (currentIdx: number, naturalCompletion = false) => {
      const list = sentencesRef.current;
      if (currentIdx >= list.length - 1) {
        // Last sentence in chapter
        const timerState = sleepTimerRef.current;
        if (timerState.isActive && timerState.targetMode === 'chapter') {
          onPlaybackCancelledRef.current?.();
          setPlaybackState('idle');
          isPlayingRef.current = false;
          setSleepTimer((prev) => ({ ...prev, isActive: false, remainingSeconds: 0 }));
          return;
        }

        // A false result means there is no next chapter (end of book).
        const completeChapter = () => {
          if (onChapterCompleteRef.current?.() !== false) return;
          onPlaybackCancelledRef.current?.();
          isPlayingRef.current = false;
          chapterTransitionRef.current = false;
          setPlaybackState('idle');
          if (silentAudioRef.current) silentAudioRef.current.pause();
          const audio = neuralAudioRef.current;
          if (audio) {
            audio.onended = null;
            audio.onerror = null;
            audio.loop = false;
            pauseAudioInternally(audio);
            audio.removeAttribute('src');
            audio.load();
          }
          lookaheadQueueRef.current.clear();
          clearCrossChapterPrefetch();
          if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
          stopKeepAlive();
          try { navigator.mediaSession.playbackState = 'none'; } catch {}
        };
        // Auto trigger next chapter transition with natural audio pause (Decision 1: Option A, 450ms)
        if (onChapterCompleteRef.current) {
          // Ensure silent audio continues running to preserve background MediaSession
          if (silentAudioRef.current && silentAudioRef.current.paused) {
            silentAudioRef.current.play().catch(() => {});
          }

          // If tab is currently hidden/in background, trigger chapter change synchronously (0ms)
          // to bypass aggressive browser background timer throttling and keep audio stream alive
          const isHidden = typeof document !== 'undefined' && document.hidden;
          if (isHidden) {
            completeChapter();
            return;
          }

          setPlaybackState('loading');
          const generation = playbackGenerationRef.current;
          window.setTimeout(() => {
            if (isPlayingRef.current && generation === playbackGenerationRef.current && onChapterCompleteRef.current) {
              completeChapter();
            }
          }, 450);
          return;
        }

        setPlaybackState('idle');
        isPlayingRef.current = false;
        return;
      }

      // Only a naturally completed spoken sentence receives the configured pause.
      // Keep the completed sentence highlighted until the next one actually dispatches.
      const generation = playbackGenerationRef.current;
      const dispatchNext = () => {
        if (!isPlayingRef.current || generation !== playbackGenerationRef.current ||
            currentSentenceIndexRef.current !== currentIdx) return;
        sentenceGapTimerRef.current = null;
        pendingGapNextIndexRef.current = null;
        const nextIdx = currentIdx + 1;
        currentSentenceIndexRef.current = nextIdx;
        setCurrentSentenceIndex(nextIdx);
        playCurrentSentenceRef.current();
      };
      const configuredGap = useSettingsStore.getState().sentenceGapMs;
      const gap = naturalCompletion && [100, 200, 300].includes(configuredGap) ? configuredGap : 0;
      if (sentenceGapTimerRef.current !== null) clearTimeout(sentenceGapTimerRef.current);
      if (gap > 0) {
        pendingGapNextIndexRef.current = currentIdx + 1;
        sentenceGapTimerRef.current = setTimeout(dispatchNext, gap);
      } else dispatchNext();
    },
    [stopKeepAlive, clearCrossChapterPrefetch]
  );

  // Transport loss retains playback intent and retries the SAME sentence. navigator.onLine
  // often stays true during a Tailscale route change, so the timer is always the fallback.
  const handleEngineFailure = useCallback(
    (idx: number, error: unknown, label: string) => {
      if (!isPlayingRef.current || idx !== currentSentenceIndexRef.current) return;
      if ((error as { message?: string })?.message === 'cancelled') return;
      if (error instanceof TTSConnectionError) {
        if (retryPendingRef.current) return;
        setPlaybackState('loading');
        retryPendingRef.current = true;
        if (retryCountRef.current === 0) {
          message.info('Kết nối âm thanh bị gián đoạn. Đang tự kết nối lại…');
        }
        const delay = Math.min(15000, 1000 * 2 ** Math.min(retryCountRef.current++, 4));
        const generation = playbackGenerationRef.current;
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          retryPendingRef.current = false;
          if (isPlayingRef.current && generation === playbackGenerationRef.current &&
              currentSentenceIndexRef.current === idx) playCurrentSentenceRef.current();
        }, delay);
        return;
      }
      onPlaybackCancelledRef.current?.();
      invalidatePlayback();
      chapterTransitionRef.current = false;
      userGesturePrimeRef.current = false;
      isPlayingRef.current = false;
      if (neuralAudioRef.current) {
        neuralAudioRef.current.loop = false;
        pauseAudioInternally(neuralAudioRef.current);
      }
      if (silentAudioRef.current) silentAudioRef.current.pause();
      stopKeepAlive();
      setPlaybackState('paused');
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
      message.warning(['NotAllowedError', 'AbortError'].includes((error as { name?: string })?.name || '')
        ? 'Chạm nút ▶ để tiếp tục nghe trên điện thoại.'
        : `Giọng ${label} đang lỗi. Chạm ▶ để thử lại hoặc chọn giọng khác.`);
    }, [invalidatePlayback, stopKeepAlive]
  );

  // Trigger prefetching of the next chapter's first 2 sentences (Decision 2: Option B)
  const triggerCrossChapterPrefetch = useCallback(async () => {
    if (isPrefetchingCrossChapterRef.current || !onPrefetchNextChapterRef.current) return;
    isPrefetchingCrossChapterRef.current = true;
    const generation = crossChapterGenerationRef.current;
    try {
      const nextSentences = await onPrefetchNextChapterRef.current();
      if (generation !== crossChapterGenerationRef.current || !nextSentences?.length) return;

      const voice = selectedVoiceURI || 'vi-VN-HoaiMyNeural';
      const rate = speechRate;
      const pitch = speechPitch;

      const items = new Map<number, CrossChapterItem>();
      nextSentences.slice(0, 2).forEach((txt, cIdx) => {
        const clean = txt.trim();
        if (!clean) return;
        const promise = fetchEdgeTTSBlob(clean, voice, rate, pitch)
          .then((blob) => {
            if (generation !== crossChapterGenerationRef.current) return '';
            const url = URL.createObjectURL(blob);
            const it = items.get(cIdx);
            if (it) it.blobUrl = url;
            return url;
          })
          .catch((e) => {
            console.warn('[CrossChapter Lookahead] Prefetch warning:', e);
            items.delete(cIdx);
            return '';
          });
        items.set(cIdx, { sentence: clean, blobUrl: null, promise });
      });

      crossChapterPrefetchRef.current = {
        sentences: nextSentences,
        items,
      };
    } catch (err) {
      console.warn('[CrossChapter Lookahead] Failed:', err);
    } finally {
      if (generation === crossChapterGenerationRef.current) isPrefetchingCrossChapterRef.current = false;
    }
  }, [selectedVoiceURI, speechRate, speechPitch]);

  // 4. Core Speech Engines
  // A0. Microsoft Edge-TTS Studio Neural Engine (24kHz MP3 + Lookahead Queue)
  const playEdgeSentence = useCallback(
    async (idx: number) => {
      const generation = playbackGenerationRef.current;
      const ownsPlayback = () => isPlayingRef.current && generation === playbackGenerationRef.current;
      const audio = neuralAudioRef.current;
      if (!audio) return;

      const list = sentencesRef.current;
      if (idx >= list.length || idx < 0) {
        setPlaybackState('idle');
        isPlayingRef.current = false;
        return;
      }

      const rawText = list[idx].trim();
      if (!rawText || !/[\p{L}\p{N}]/u.test(rawText)) {
        advanceToNext(idx);
        return;
      }
      const textToSpeak = normalizeSentenceForTTS(rawText);

      setPlaybackState('loading');
      const voice = selectedVoiceURI || 'vi-VN-HoaiMyNeural';
      const queue = lookaheadQueueRef.current;

      try {
        let blobUrl = '';
        if (queue.hasReady(idx)) {
          blobUrl = (await queue.get(idx)?.promise) || '';
        } else {
          blobUrl = await queue.prefetch(idx, textToSpeak, (txt) =>
            fetchEdgeTTSBlob(txt, voice, speechRate, speechPitch)
          );
        }

        if (!ownsPlayback()) return;

        // Revoke previously playing blob URL to prevent RAM leak
        if (currentBlobUrlRef.current && currentBlobUrlRef.current !== blobUrl) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
        }
        currentBlobUrlRef.current = blobUrl;
        queue.markPlaying(idx);

        // Apply volume with Sleep Timer fade-out
        const currentTimer = sleepTimerRef.current;
        let effectiveVolume = volume;
        if (currentTimer.isActive && currentTimer.fadeAudio && currentTimer.remainingSeconds <= 30) {
          effectiveVolume = volume * Math.max(0, currentTimer.remainingSeconds / 30);
        }

        audio.loop = false;
        audio.src = blobUrl;
        if (resumePositionRef.current !== null) {
          audio.currentTime = resumePositionRef.current;
          resumePositionRef.current = null;
        }
        audio.playbackRate = speechRate;
        audio.volume = effectiveVolume;

        // Lookahead Prefetching: Start synthesizing next sentence (idx + 1) right away
        // Keep two sentences ahead so network jitter never leaves a gap (also helps with the screen locked)
        for (let ahead = 1; ahead <= 2; ahead++) {
          const nextIdx = idx + ahead;
          const rawAhead = list[nextIdx]?.trim();
          if (nextIdx < list.length && rawAhead && /[\p{L}\p{N}]/u.test(rawAhead)) {
            const cleanAhead = normalizeSentenceForTTS(rawAhead);
            queue
              .prefetch(nextIdx, cleanAhead, (txt) =>
                fetchEdgeTTSBlob(txt, voice, speechRate, speechPitch)
              )
              .catch((err) => {
                console.warn('[Edge Lookahead] Prefetch warning:', err);
              });
          }
        }

        // Cross-Chapter Lookahead: If nearing end of chapter, prefetch next chapter's intro
        if (idx >= list.length - 2) {
          triggerCrossChapterPrefetch();
        }

        audio.onended = () => {
          if (!ownsPlayback()) return;
          queue.revoke(idx);
          if (currentBlobUrlRef.current === blobUrl) {
            URL.revokeObjectURL(blobUrl);
            currentBlobUrlRef.current = null;
          }

          if (!ownsPlayback()) return;
          advanceToNext(idx, true);
        };

        audio.onerror = (e) => {
          if (!ownsPlayback()) return;
          console.warn('[Edge Audio] Playback error on sentence:', idx, e);
          queue.revoke(idx);
          handleEngineFailure(idx, new Error('Audio playback failed'), 'âm thanh');
        };

        await audio.play();
        if (!ownsPlayback()) return;
        retryCountRef.current = 0;
        setPlaybackState('playing');
        isPlayingRef.current = true;

        if (onSentenceChangeRef.current) {
          onSentenceChangeRef.current(idx, textToSpeak);
        }

        updateMediaSession(textToSpeak);
        queue.pruneOlderThan(idx);
      } catch (error) {
        if (!ownsPlayback()) return;
        console.error('[Edge TTS] Error synthesizing sentence:', error);
        handleEngineFailure(idx, error, 'AI Studio');
      }
    },
    [advanceToNext, handleEngineFailure, selectedVoiceURI, speechRate, speechPitch, volume, updateMediaSession, triggerCrossChapterPrefetch]
  );

  // A1. Kokoro Client-side WebGPU/WASM Engine (HTML5 <audio> + Lookahead Queue)
  const playKokoroSentence = useCallback(
    async (idx: number) => {
      const generation = playbackGenerationRef.current;
      const ownsPlayback = () => isPlayingRef.current && generation === playbackGenerationRef.current;
      const audio = neuralAudioRef.current;
      if (!audio) return;

      const list = sentencesRef.current;
      if (idx >= list.length || idx < 0) {
        setPlaybackState('idle');
        isPlayingRef.current = false;
        return;
      }

      const rawText = list[idx].trim();
      if (!rawText || !/[\p{L}\p{N}]/u.test(rawText)) {
        advanceToNext(idx);
        return;
      }
      const textToSpeak = normalizeSentenceForTTS(rawText);

      setPlaybackState('loading');
      const voiceKey = selectedVoiceURI.startsWith('kokoro:')
        ? selectedVoiceURI.replace('kokoro:', '')
        : 'diem_trinh';
      const queue = lookaheadQueueRef.current;

      try {
        let blobUrl = '';
        if (queue.hasReady(idx)) {
          blobUrl = (await queue.get(idx)?.promise) || '';
        } else {
          blobUrl = await queue.prefetch(idx, textToSpeak, (txt) =>
            kokoroService.synthesize(txt, voiceKey, speechRate)
          );
        }

        if (!ownsPlayback()) return;

        if (currentBlobUrlRef.current && currentBlobUrlRef.current !== blobUrl) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
        }
        currentBlobUrlRef.current = blobUrl;
        queue.markPlaying(idx);

        const currentTimer = sleepTimerRef.current;
        let effectiveVolume = volume;
        if (currentTimer.isActive && currentTimer.fadeAudio && currentTimer.remainingSeconds <= 30) {
          effectiveVolume = volume * Math.max(0, currentTimer.remainingSeconds / 30);
        }

        audio.loop = false;
        audio.src = blobUrl;
        if (resumePositionRef.current !== null) {
          audio.currentTime = resumePositionRef.current;
          resumePositionRef.current = null;
        }
        audio.playbackRate = speechRate;
        audio.volume = effectiveVolume;

        // Lookahead Prefetching: Start synthesizing next sentence (idx + 1)
        const nextIdx = idx + 1;
        const rawAhead = list[nextIdx]?.trim();
        if (nextIdx < list.length && rawAhead && /[\p{L}\p{N}]/u.test(rawAhead)) {
          const cleanAhead = normalizeSentenceForTTS(rawAhead);
          queue
            .prefetch(nextIdx, cleanAhead, (txt) =>
              kokoroService.synthesize(txt, voiceKey, speechRate)
            )
            .catch((err) => {
              console.warn('[Kokoro Lookahead] Prefetch error:', err);
            });
        }

        audio.onended = () => {
          if (!ownsPlayback()) return;
          queue.revoke(idx);
          if (currentBlobUrlRef.current === blobUrl) {
            URL.revokeObjectURL(blobUrl);
            currentBlobUrlRef.current = null;
          }
          if (!ownsPlayback()) return;
          advanceToNext(idx, true);
        };

        audio.onerror = (e) => {
          if (!ownsPlayback()) return;
          console.warn('[Kokoro Audio] Playback error on sentence:', idx, e);
          queue.revoke(idx);
          handleEngineFailure(idx, new Error('Audio playback failed'), 'âm thanh');
        };

        await audio.play();
        if (!ownsPlayback()) return;
        retryCountRef.current = 0;
        setPlaybackState('playing');
        isPlayingRef.current = true;

        if (onSentenceChangeRef.current) {
          onSentenceChangeRef.current(idx, textToSpeak);
        }

        updateMediaSession(textToSpeak);
        queue.pruneOlderThan(idx);
      } catch (error) {
        if (!ownsPlayback()) return;
        console.error('[Kokoro TTS] Error synthesizing sentence:', error);
        handleEngineFailure(idx, error, 'Kokoro');
      }
    },
    [advanceToNext, handleEngineFailure, selectedVoiceURI, speechRate, volume, updateMediaSession]
  );

  // A2. VieNeu-TTS 48kHz Engine (HTML5 <audio> + Lookahead Queue)
  const playVieNeuSentence = useCallback(
    async (idx: number) => {
      const generation = playbackGenerationRef.current;
      const ownsPlayback = () => isPlayingRef.current && generation === playbackGenerationRef.current;
      const audio = neuralAudioRef.current;
      if (!audio) return;

      const list = sentencesRef.current;
      if (idx >= list.length || idx < 0) {
        setPlaybackState('idle');
        isPlayingRef.current = false;
        return;
      }

      const rawText = list[idx].trim();
      if (!rawText || !/[\p{L}\p{N}]/u.test(rawText)) {
        advanceToNext(idx);
        return;
      }
      const textToSpeak = normalizeSentenceForTTS(rawText);

      setPlaybackState('loading');
      const voiceKey = selectedVoiceURI.startsWith('vieneu:')
        ? selectedVoiceURI.replace('vieneu:', '')
        : 'minh_quan';
      const queue = lookaheadQueueRef.current;

      // The current sentence and the next ones are synthesised in order, one at a time, so the model never
      // works on a later sentence while the one we are waiting for is still pending.
      const VIENEU_LOOKAHEAD = 4;
      const kickLookahead = () => {
        for (let ahead = 0; ahead <= VIENEU_LOOKAHEAD; ahead++) {
          const i = idx + ahead;
          const rawAhead = list[i]?.trim();
          if (i >= list.length || !rawAhead || !/[\p{L}\p{N}]/u.test(rawAhead)) continue;
          const cleanAhead = normalizeSentenceForTTS(rawAhead);
          queue
            .prefetchSerial(i, cleanAhead, (txt) =>
              fetchVieNeuTTSBlob(txt, voiceKey, speechRate, speechPitch)
            )
            .catch((err) => {
              if (err?.message !== 'cancelled') console.warn('[VieNeu Lookahead] Prefetch error:', err);
            });
        }
      };

      try {
        kickLookahead();
        const blobUrl = (await queue.get(idx)?.promise) || '';

        if (!ownsPlayback()) return;

        if (currentBlobUrlRef.current && currentBlobUrlRef.current !== blobUrl) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
        }
        currentBlobUrlRef.current = blobUrl;
        queue.markPlaying(idx);

        const currentTimer = sleepTimerRef.current;
        let effectiveVolume = volume;
        if (currentTimer.isActive && currentTimer.fadeAudio && currentTimer.remainingSeconds <= 30) {
          effectiveVolume = volume * Math.max(0, currentTimer.remainingSeconds / 30);
        }

        audio.loop = false;
        audio.src = blobUrl;
        if (resumePositionRef.current !== null) {
          audio.currentTime = resumePositionRef.current;
          resumePositionRef.current = null;
        }
        audio.playbackRate = speechRate;
        audio.volume = effectiveVolume;

        // Slide the window: keep VIENEU_LOOKAHEAD sentences synthesised ahead
        kickLookahead();

        audio.onended = () => {
          if (!ownsPlayback()) return;
          queue.revoke(idx);
          if (currentBlobUrlRef.current === blobUrl) {
            URL.revokeObjectURL(blobUrl);
            currentBlobUrlRef.current = null;
          }
          if (!ownsPlayback()) return;
          advanceToNext(idx, true);
        };

        audio.onerror = (e) => {
          if (!ownsPlayback()) return;
          console.warn('[VieNeu Audio] Playback error on sentence:', idx, e);
          queue.revoke(idx);
          handleEngineFailure(idx, new Error('Audio playback failed'), 'âm thanh');
        };

        await audio.play();
        if (!ownsPlayback()) return;
        retryCountRef.current = 0;
        setPlaybackState('playing');
        isPlayingRef.current = true;

        if (onSentenceChangeRef.current) {
          onSentenceChangeRef.current(idx, textToSpeak);
        }

        updateMediaSession(textToSpeak);
        queue.pruneOlderThan(idx);
      } catch (error) {
        if (!ownsPlayback()) return;
        console.error('[VieNeu TTS] Error synthesizing sentence:', error);
        handleEngineFailure(idx, error, 'VieNeu');
      }
    },
    [advanceToNext, handleEngineFailure, selectedVoiceURI, speechRate, speechPitch, volume, updateMediaSession]
  );

  // A. Neural Piper WASM Engine (HTML5 <audio> + Lookahead Queue)
  const playNeuralSentence = useCallback(
    async (idx: number) => {
      const generation = playbackGenerationRef.current;
      const ownsPlayback = () => isPlayingRef.current && generation === playbackGenerationRef.current;
      const audio = neuralAudioRef.current;
      if (!audio) return;

      const list = sentencesRef.current;
      if (idx >= list.length || idx < 0) {
        setPlaybackState('idle');
        isPlayingRef.current = false;
        return;
      }

      const textToSpeak = list[idx].trim();
      if (!textToSpeak) {
        // Empty sentence: skip immediately
        advanceToNext(idx);
        return;
      }

      setPlaybackState('loading');
      const speakerId = selectedVoiceURI.startsWith('piper:')
        ? parseSpeakerIdFromURI(selectedVoiceURI)
        : neuralSpeakerId;

      const queue = lookaheadQueueRef.current;

      try {
        // 1. Get current sentence audio URL from Lookahead Queue or synthesize
        let blobUrl = '';
        if (queue.hasReady(idx)) {
          blobUrl = (await queue.get(idx)?.promise) || '';
        } else {
          blobUrl = await queue.prefetch(idx, textToSpeak, (txt) => synthesize(txt, speakerId));
        }

        if (!ownsPlayback()) return;

        // Revoke previously playing blob URL to prevent RAM leak (TC-45)
        if (currentBlobUrlRef.current && currentBlobUrlRef.current !== blobUrl) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
        }
        currentBlobUrlRef.current = blobUrl;
        queue.markPlaying(idx);

        // Apply volume with Sleep Timer fade-out
        const currentTimer = sleepTimerRef.current;
        let effectiveVolume = volume;
        if (currentTimer.isActive && currentTimer.fadeAudio && currentTimer.remainingSeconds <= 30) {
          effectiveVolume = volume * Math.max(0, currentTimer.remainingSeconds / 30);
        }

        audio.loop = false;
        audio.src = blobUrl;
        if (resumePositionRef.current !== null) {
          audio.currentTime = resumePositionRef.current;
          resumePositionRef.current = null;
        }
        audio.playbackRate = speechRate;
        audio.volume = effectiveVolume;

        // Lookahead Prefetching: Start synthesizing next sentence (idx + 1) right away
        const nextIdx = idx + 1;
        const rawAhead = list[nextIdx]?.trim();
        if (nextIdx < list.length && rawAhead && /[\p{L}\p{N}]/u.test(rawAhead)) {
          const cleanAhead = normalizeSentenceForTTS(rawAhead);
          queue.prefetch(nextIdx, cleanAhead, (txt) => synthesize(txt, speakerId)).catch((err) => {
            console.warn('[Piper Lookahead] Prefetch next sentence warning:', err);
          });
        }

        // Bind onended with instant zero-latency swap
        audio.onended = () => {
          if (!ownsPlayback()) return;
          // Revoke memory of finished sentence immediately (TC-45)
          queue.revoke(idx);
          if (currentBlobUrlRef.current === blobUrl) {
            URL.revokeObjectURL(blobUrl);
            currentBlobUrlRef.current = null;
          }

          if (!ownsPlayback()) return;
          advanceToNext(idx, true);
        };

        audio.onerror = (e) => {
          if (!ownsPlayback()) return;
          console.warn('[Piper Audio] Playback error on sentence:', idx, e);
          queue.revoke(idx);
          handleEngineFailure(idx, new Error('Audio playback failed'), 'âm thanh');
        };

        await audio.play();
        if (!ownsPlayback()) return;
        retryCountRef.current = 0;
        setPlaybackState('playing');
        isPlayingRef.current = true;

        if (onSentenceChangeRef.current) {
          onSentenceChangeRef.current(idx, textToSpeak);
        }

        updateMediaSession(textToSpeak);

        // Also prune older sentences from memory
        queue.pruneOlderThan(idx);
      } catch (error) {
        if (!ownsPlayback()) return;
        console.error('[Piper Neural TTS] Error synthesizing sentence:', error);
        // Fallback to system voice if model fails
        handleEngineFailure(idx, error, 'Piper');
      }
    },
    [
      advanceToNext,
      handleEngineFailure,
      selectedVoiceURI,
      neuralSpeakerId,
      volume,
      speechRate,
      updateMediaSession,
    ]
  );

  // B. System Web Speech API Engine
  const playSystemSentence = useCallback(
    (idx: number) => {
      const generation = playbackGenerationRef.current;
      const ownsPlayback = () => isPlayingRef.current && generation === playbackGenerationRef.current;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      const list = sentencesRef.current;

      if (idx >= list.length || idx < 0) {
        setPlaybackState('idle');
        isPlayingRef.current = false;
        stopKeepAlive();
        if (silentAudioRef.current) silentAudioRef.current.pause();
        return;
      }

      const rawText = list[idx].trim();
      if (!rawText || !/[\p{L}\p{N}]/u.test(rawText)) {
        advanceToNext(idx);
        return;
      }
      const textToSpeak = normalizeSentenceForTTS(rawText);

      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      // Pin to global references to defeat WebKit Garbage Collector (ADR-02)
      activeUtteranceRef.current = utterance;
      (window as any).__activeUtterance = utterance;

      utterance.rate = speechRate;
      utterance.pitch = speechPitch;

      const currentTimer = sleepTimerRef.current;
      let effectiveVolume = volume;
      if (currentTimer.isActive && currentTimer.fadeAudio && currentTimer.remainingSeconds <= 30) {
        effectiveVolume = volume * Math.max(0, currentTimer.remainingSeconds / 30);
      }
      utterance.volume = effectiveVolume;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }

      utterance.onstart = () => {
        if (!ownsPlayback()) return;
        setPlaybackState('playing');
        isPlayingRef.current = true;
        if (onSentenceChangeRef.current) {
          onSentenceChangeRef.current(idx, textToSpeak);
        }
        updateMediaSession(textToSpeak);
      };

      utterance.onend = () => {
        if (!ownsPlayback()) return;
        activeUtteranceRef.current = null;
        (window as any).__activeUtterance = null;

        if (!ownsPlayback()) return;
        advanceToNext(idx, true);
      };

      utterance.onerror = (event) => {
        if (!ownsPlayback()) return;
        activeUtteranceRef.current = null;
        (window as any).__activeUtterance = null;

        console.warn('SpeechSynthesis error:', event);
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          handleEngineFailure(idx, new Error('Audio playback failed'), 'âm thanh');
        }
      };

      synth.speak(utterance);
      startKeepAlive();
    },
    [
      advanceToNext,
      handleEngineFailure,
      speechRate,
      speechPitch,
      volume,
      selectedVoice,
      updateMediaSession,
      startKeepAlive,
      stopKeepAlive,
    ]
  );

  // Unified Play Current Sentence Dispatcher
  const playCurrentSentence = useCallback(() => {
    invalidatePlayback();
    if (!isPlayingRef.current) return;
    const audio = neuralAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      // Replacing media is intentional; do not treat this pause as an OS interruption.
      if (!userGesturePrimeRef.current) {
        isPlayingRef.current = false;
        pauseAudioInternally(audio);
        isPlayingRef.current = true;
      }
      userGesturePrimeRef.current = false;
    }
    const isKokoro =
      selectedVoiceURI.startsWith('kokoro:') ||
      engineMode === 'kokoro';

    const isVieNeu =
      selectedVoiceURI.startsWith('vieneu:') ||
      engineMode === 'vieneu';

    const isEdge =
      selectedVoiceURI === 'vi-VN-HoaiMyNeural' ||
      selectedVoiceURI === 'vi-VN-NamMinhNeural' ||
      selectedVoiceURI.endsWith('Neural') ||
      selectedVoiceURI.startsWith('vi-') ||
      selectedVoiceURI.startsWith('en-US') ||
      selectedVoiceURI.startsWith('zh-CN') ||
      selectedVoiceURI.startsWith('ja-JP') ||
      engineMode === 'edge';

    const isNeural =
      selectedVoiceURI.startsWith('piper:') ||
      (engineMode === 'neural' && isModelReady);

    const idx = currentSentenceIndexRef.current;

    if (isKokoro) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopKeepAlive();
      playKokoroSentence(idx);
    } else if (isVieNeu) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopKeepAlive();
      playVieNeuSentence(idx);
    } else if (isEdge) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopKeepAlive();
      playEdgeSentence(idx);
    } else if (isNeural) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopKeepAlive();
      playNeuralSentence(idx);
    } else {
      if (neuralAudioRef.current) {
        pauseAudioInternally(neuralAudioRef.current);
      }
      playSystemSentence(idx);
    }
  }, [
    invalidatePlayback,
    selectedVoiceURI,
    engineMode,
    isModelReady,
    playKokoroSentence,
    playVieNeuSentence,
    playEdgeSentence,
    playNeuralSentence,
    playSystemSentence,
    stopKeepAlive,
  ]);

  useEffect(() => {
    playCurrentSentenceRef.current = playCurrentSentence;
  }, [playCurrentSentence]);

  // 5. Controls: Play, Pause, Resume, Stop
  const play = useCallback(
    (textList?: string[], startIndex?: number) => {
      // Unlock iOS Safari Audio in user gesture stack
      setPlaybackAudioSession();
      logAudio('play()', startIndex);
      if (silentAudioRef.current) {
        silentAudioRef.current.play().catch(() => {});
      }
      if (neuralAudioRef.current && silentAudioRef.current?.src) {
        const audio = neuralAudioRef.current;
        audio.onended = null;
        audio.onerror = null;
        // Unlock this SAME persistent media element with valid media while the tap
        // gesture is active. Never replay the previous ended/revoked chapter URL.
        isPlayingRef.current = false;
        pauseAudioInternally(audio);
        audio.src = silentAudioRef.current.src;
        audio.loop = true;
        userGesturePrimeRef.current = true;
        audio.play().catch(() => {});
      }
      chapterTransitionRef.current = false;

      if (textList && textList.length > 0) {
        setSentences(textList);
        sentencesRef.current = textList;
      }

      resumePositionRef.current = null;
      const targetIdx = startIndex !== undefined ? startIndex : currentSentenceIndexRef.current;
      currentSentenceIndexRef.current = targetIdx;
      setCurrentSentenceIndex(targetIdx);

      isPlayingRef.current = true;
      setPlaybackState('playing');

      playCurrentSentence();
    },
    [playCurrentSentence]
  );

  const prepareChapterTransition = useCallback(() => {
    invalidatePlayback();
    resumePositionRef.current = null;
    userGesturePrimeRef.current = false;
    chapterTransitionRef.current = true;
    isPlayingRef.current = true;
    const audio = neuralAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      pauseAudioInternally(audio);
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    // Keep the audio session alive across asynchronous EPUB layout/fetch. Public
    // pause() intentionally stops this session and is reserved for user cancellation.
    if (silentAudioRef.current?.paused) silentAudioRef.current.play().catch(() => {});
    setPlaybackState('loading');
    try { navigator.mediaSession.playbackState = 'playing'; } catch {}
  }, [invalidatePlayback]);

  const pause = useCallback(() => {
    onPlaybackCancelledRef.current?.();
    chapterTransitionRef.current = false;
    userGesturePrimeRef.current = false;
    const nextAfterGap = pendingGapNextIndexRef.current;
    invalidatePlayback();
    const audio = neuralAudioRef.current;
    if (nextAfterGap !== null) {
      // The preceding sentence finished already; resume at the waiting sentence.
      currentSentenceIndexRef.current = nextAfterGap;
      setCurrentSentenceIndex(nextAfterGap);
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.removeAttribute('src');
        audio.load();
      }
    }
    resumePositionRef.current = audio && !audio.paused && !audio.ended && !audio.error
      ? audio.currentTime : null;
    isPlayingRef.current = false;

    // Pause Neural / Edge audio
    if (neuralAudioRef.current) {
      pauseAudioInternally(neuralAudioRef.current);
    }

    // Pause System synth
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setPlaybackState('paused');
    stopKeepAlive();
    if (silentAudioRef.current) silentAudioRef.current.pause();

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }, [stopKeepAlive, invalidatePlayback]);

  const resume = useCallback(() => {
    isPlayingRef.current = true;
    setPlaybackState('playing');

    setPlaybackAudioSession();
    if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
    playCurrentSentence();
  }, [playCurrentSentence]);

  const stop = useCallback(() => {
    onPlaybackCancelledRef.current?.();
    chapterTransitionRef.current = false;
    userGesturePrimeRef.current = false;
    const nextAfterGap = pendingGapNextIndexRef.current;
    invalidatePlayback();
    if (nextAfterGap !== null) {
      currentSentenceIndexRef.current = nextAfterGap;
      setCurrentSentenceIndex(nextAfterGap);
    }
    clearCrossChapterPrefetch();
    resumePositionRef.current = null;
    isPlayingRef.current = false;

    if (neuralAudioRef.current) {
      pauseAudioInternally(neuralAudioRef.current);
      neuralAudioRef.current.removeAttribute('src');
      neuralAudioRef.current.load();
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    lookaheadQueueRef.current.clear();
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }

    setPlaybackState('idle');
    stopKeepAlive();
    if (silentAudioRef.current) silentAudioRef.current.pause();

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }, [stopKeepAlive, invalidatePlayback, clearCrossChapterPrefetch]);

  const nextSentence = useCallback(() => {
    resumePositionRef.current = null;
    const nextIdx = Math.min(sentencesRef.current.length - 1, currentSentenceIndexRef.current + 1);
    currentSentenceIndexRef.current = nextIdx;
    setCurrentSentenceIndex(nextIdx);
    if (isPlayingRef.current) {
      playCurrentSentence();
    }
  }, [playCurrentSentence]);

  const prevSentence = useCallback(() => {
    resumePositionRef.current = null;
    const prevIdx = Math.max(0, currentSentenceIndexRef.current - 1);
    lookaheadQueueRef.current.clear(); // going back: the queued sentences are for the wrong direction
    currentSentenceIndexRef.current = prevIdx;
    setCurrentSentenceIndex(prevIdx);
    if (isPlayingRef.current) {
      playCurrentSentence();
    }
  }, [playCurrentSentence]);

  const jumpToSentence = useCallback(
    (index: number) => {
      resumePositionRef.current = null;
      const clamped = Math.max(0, Math.min(sentencesRef.current.length - 1, index));
      // A jump outside the prefetched window: drop the queue so stale synthesis does not delay the new spot
      const cur = currentSentenceIndexRef.current;
      if (clamped < cur || clamped > cur + 5) lookaheadQueueRef.current.clear();
      currentSentenceIndexRef.current = clamped;
      setCurrentSentenceIndex(clamped);
      if (isPlayingRef.current) {
        playCurrentSentence();
      }
    },
    [playCurrentSentence]
  );

  const setSentencesList = useCallback((list: string[], initialIndex: number = 0) => {
    if (initialIndex === currentSentenceIndexRef.current && list.length === sentencesRef.current.length &&
        list.every((text, index) => text === sentencesRef.current[index])) return;
    invalidatePlayback();
    resumePositionRef.current = null;
    setSentences(list);
    sentencesRef.current = list;
    currentSentenceIndexRef.current = initialIndex;
    setCurrentSentenceIndex(initialIndex);

    // Check if we have pre-fetched cross-chapter audio ready for the new chapter
    const crossPrefetch = crossChapterPrefetchRef.current;
    crossChapterPrefetchRef.current = null;
    isPrefetchingCrossChapterRef.current = false;

    lookaheadQueueRef.current.clear();

    const matches = crossPrefetch && initialIndex === 0 &&
      crossPrefetch.sentences.length <= list.length &&
      crossPrefetch.sentences.every((text, index) => text === list[index]);
    if (matches) {
      crossPrefetch.items.forEach((item, cIdx) => {
        // A pending failed cross-chapter request returns an empty URL; fresh synthesis owns retries.
        if (item.blobUrl) lookaheadQueueRef.current.injectItem(cIdx, list[cIdx], item.promise, item.blobUrl);
        else item.promise.then((url) => { if (url) URL.revokeObjectURL(url); }).catch(() => {});
      });
    } else {
      crossChapterPrefetchRef.current = crossPrefetch;
      clearCrossChapterPrefetch();
    }
  }, [invalidatePlayback, clearCrossChapterPrefetch]);

  const continueChapter = useCallback((textList: string[], startIndex = 0) => {
    // A pause/stop while the chapter was loading cancels automatic continuation.
    if (!isPlayingRef.current || !chapterTransitionRef.current) return;
    setSentencesList(textList, startIndex);
    chapterTransitionRef.current = false;
    resumePositionRef.current = null;
    setPlaybackAudioSession();
    setPlaybackState('loading');
    playCurrentSentenceRef.current();
  }, [setSentencesList]);

  // 6. Sleep Timer Handler
  const startSleepTimer = useCallback((duration: number | 'chapter') => {
    if (duration === 'chapter') {
      setSleepTimer({
        isActive: true,
        totalSeconds: 0,
        remainingSeconds: 0,
        targetMode: 'chapter',
        fadeAudio: true,
      });
      return;
    }

    const totalSec = Math.floor(duration * 60);
    setSleepTimer({
      isActive: true,
      totalSeconds: totalSec,
      remainingSeconds: totalSec,
      targetMode: 'time',
      fadeAudio: true,
    });
  }, []);

  const cancelSleepTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setSleepTimer((prev) => ({ ...prev, isActive: false, remainingSeconds: 0 }));
  }, []);

  // Sleep Timer countdown tick
  useEffect(() => {
    if (!sleepTimer.isActive || sleepTimer.targetMode !== 'time') return;

    timerIntervalRef.current = window.setInterval(() => {
      setSleepTimer((prev) => {
        if (!prev.isActive || prev.remainingSeconds <= 1) {
          stop();
          return { ...prev, isActive: false, remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [sleepTimer.isActive, sleepTimer.targetMode, stop]);

  // Setup MediaSession handlers for iOS Lock Screen / Apple Watch / AirPods
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextSentence());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevSentence());
      navigator.mediaSession.setActionHandler('seekforward', () => nextSentence());
      navigator.mediaSession.setActionHandler('seekbackward', () => prevSentence());
    } catch (e) {
      console.warn('MediaSession handler error:', e);
    }
  }, [resume, pause, nextSentence, prevSentence]);

  // Seamless switch when selectedVoiceURI changes while playing
  const vieneuMode = useSettingsStore((st) => st.vieneuMode);
  const prevVoiceRef = useRef<string>(`${selectedVoiceURI}|${vieneuMode}`);
  useEffect(() => {
    const key = `${selectedVoiceURI}|${vieneuMode}`;
    if (prevVoiceRef.current !== key) {
      prevVoiceRef.current = key;
      clearCrossChapterPrefetch();
      lookaheadQueueRef.current.clear();
      if (isPlayingRef.current) {
        playCurrentSentence();
      }
    }
  }, [selectedVoiceURI, vieneuMode, playCurrentSentence, clearCrossChapterPrefetch]);

  // Rate and volume update for active HTML5 audio
  useEffect(() => {
    if (neuralAudioRef.current) {
      neuralAudioRef.current.playbackRate = speechRate;
      neuralAudioRef.current.volume = volume;
    }
  }, [speechRate, volume]);

  // Preview Voice Sample Text (Multi-Engine Preview)
  const previewVoice = useCallback(
    async (
      voiceURI: string,
      sampleText: string = 'Xin chào, đây là giọng đọc tiếng Việt thử nghiệm trên AudioEpub.'
    ) => {
      // 0. Ensure persistent preview <audio> element exists & prime it in synchronous click context
      if (!previewAudioRef.current && typeof document !== 'undefined') {
        const el = document.createElement('audio');
        el.id = 'audioepub-preview-player';
        el.setAttribute('playsinline', 'true');
        (el as any).playsInline = true;
        document.body.appendChild(el);
        previewAudioRef.current = el;
      }
      const pAudio = previewAudioRef.current;
      if (pAudio) {
        try {
          pAudio.pause();
        } catch {}
      }

      // Helper function for Web Speech preview with robust cancellation delay and gender matching
      const playWebSpeechPreview = (
        targetVoiceURI: string,
        gender: 'female' | 'male' = 'female',
        pitchMod: number = 1.0,
        isFallbackMsg?: string
      ) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        const synth = window.speechSynthesis;
        synth.cancel();

        const currentVoices = synth.getVoices();
        const availableVoices = currentVoices.length > 0 ? currentVoices : voices;
        let targetVoice = availableVoices.find((v) => v.voiceURI === targetVoiceURI);

        if (!targetVoice) {
          const viVoices = availableVoices.filter(
            (v) => v.lang.toLowerCase().startsWith('vi') || v.name.toLowerCase().includes('vietnam')
          );
          if (gender === 'male' || pitchMod < 1.0) {
            targetVoice = viVoices.find((v) => /nam|minh|male|man/i.test(v.name)) || viVoices[0];
          } else {
            targetVoice = viVoices.find((v) => /hoài|my|linh|an|female|woman/i.test(v.name)) || viVoices[0];
          }
        }
        if (!targetVoice) {
          targetVoice = availableVoices[0];
        }

        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.rate = speechRate;
        utterance.pitch = Math.max(0.5, Math.min(2.0, speechPitch * pitchMod));
        utterance.volume = volume;
        utterance.lang = targetVoice?.lang || 'vi-VN';
        if (targetVoice) {
          utterance.voice = targetVoice;
        }

        activeUtteranceRef.current = utterance;
        (window as any).__activeUtterance = utterance;

        utterance.onend = () => {
          activeUtteranceRef.current = null;
          (window as any).__activeUtterance = null;
        };
        utterance.onerror = () => {
          activeUtteranceRef.current = null;
          (window as any).__activeUtterance = null;
        };

        if (isFallbackMsg) {
          message.info(isFallbackMsg);
        }

        setTimeout(() => {
          try {
            synth.resume();
            synth.speak(utterance);
          } catch (e) {
            console.error('[WebSpeech Preview] speak error:', e);
          }
        }, 70);
      };

      // 1. Preview Kokoro Client WebGPU/WASM Voice
      if (voiceURI.startsWith('kokoro:')) {
        const voiceKey = voiceURI.replace('kokoro:', '');
        try {
          const blob = await kokoroService.synthesize(sampleText, voiceKey, speechRate);
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
          }
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;

          if (pAudio) {
            pAudio.src = url;
            pAudio.playbackRate = speechRate;
            pAudio.volume = volume;
            pAudio.onended = () => {
              if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
              }
            };
            pAudio.onerror = () => {
              if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
              }
            };
            await pAudio.play();
            return;
          }
        } catch (err) {
          console.warn('[Kokoro Preview] Failed, falling back:', err);
          message.error('Không thể phát nghe thử giọng Kokoro');
          return;
        }
      }

      // 2. Preview VieNeu 48kHz Voice
      if (voiceURI.startsWith('vieneu:')) {
        const voiceKey = voiceURI.replace('vieneu:', '');
        try {
          const blob = await fetchVieNeuTTSBlob(sampleText, voiceKey, speechRate, speechPitch);
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
          }
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;

          if (pAudio) {
            pAudio.src = url;
            pAudio.playbackRate = speechRate;
            pAudio.volume = volume;
            pAudio.onended = () => {
              if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
              }
            };
            pAudio.onerror = () => {
              if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
              }
            };
            await pAudio.play();
            return;
          }
        } catch (err) {
          console.warn('[VieNeu Preview] Failed, falling back:', err);
          message.error('Không thể phát nghe thử giọng VieNeu');
          return;
        }
      }

      // 3. Preview Edge Studio Neural Voice via /api/tts proxy
      const isEdge =
        voiceURI === 'vi-VN-HoaiMyNeural' ||
        voiceURI === 'vi-VN-NamMinhNeural' ||
        voiceURI.endsWith('Neural') ||
        voiceURI.startsWith('vi-') ||
        voiceURI.startsWith('en-US') ||
        voiceURI.startsWith('zh-CN') ||
        voiceURI.startsWith('ja-JP') ||
        EDGE_VOICES.some((ev) => ev.id === voiceURI);

      if (isEdge) {
        try {
          const blob = await fetchEdgeTTSBlob(sampleText, voiceURI, speechRate, speechPitch);
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
          }
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;

          if (pAudio) {
            pAudio.src = url;
            pAudio.playbackRate = speechRate;
            pAudio.volume = volume;
            pAudio.onended = () => {
              if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
              }
            };
            pAudio.onerror = () => {
              if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
              }
            };
            await pAudio.play();
            return;
          }
        } catch (err) {
          console.warn('[Edge Preview] /api/tts failed, falling back:', err);
          message.error('Không thể phát nghe thử từ server Edge-TTS');
          return;
        }
      }

      // 4. Preview Neural Piper Voice via Audio Blob
      if (voiceURI.startsWith('piper:')) {
        const speakerId = parseSpeakerIdFromURI(voiceURI);
        const voiceInfo = getVoiceById(voiceURI);
        const gender: 'female' | 'male' = voiceInfo?.gender || 'female';
        const isFemale = gender === 'female';
        const ready = await checkModelReady();

        if (ready) {
          try {
            const blob = await synthesize(sampleText, speakerId);
            if (previewUrlRef.current) {
              URL.revokeObjectURL(previewUrlRef.current);
              previewUrlRef.current = null;
            }
            const url = URL.createObjectURL(blob);
            previewUrlRef.current = url;

            if (pAudio) {
              pAudio.src = url;
              pAudio.playbackRate = speechRate;
              pAudio.volume = volume;
              pAudio.onended = () => {
                if (previewUrlRef.current) {
                  URL.revokeObjectURL(previewUrlRef.current);
                  previewUrlRef.current = null;
                }
              };
              pAudio.onerror = () => {
                if (previewUrlRef.current) {
                  URL.revokeObjectURL(previewUrlRef.current);
                  previewUrlRef.current = null;
                }
              };
              await pAudio.play();
              return;
            }
          } catch (err) {
            console.warn('[Piper Preview] Direct neural synthesis failed, using speech preview fallback:', err);
          }
        }

        // Graceful preview when model is not yet downloaded or initializing
        playWebSpeechPreview(
          '',
          gender,
          isFemale ? 1.15 : 0.85,
          !ready ? 'Đang phát giọng nghe thử. Vui lòng bấm "Tải Mô Hình AI (27.8MB)" để nghe giọng AI tự nhiên hoàn chỉnh!' : undefined
        );
        return;
      }

      // 5. Preview System Web Speech Voice
      const sysVoice = voices.find((v) => v.voiceURI === voiceURI);
      const isMaleSys = sysVoice ? /nam|minh|male/i.test(sysVoice.name) : false;
      playWebSpeechPreview(voiceURI, isMaleSys ? 'male' : 'female', 1.0);
    },
    [voices, speechRate, speechPitch, volume]
  );

  return {
    playbackState,
    engineMode,
    setEngineMode,
    edgeVoices,
    selectedEdgeVoice,
    kokoroVoices,
    selectedKokoroVoice,
    vieneuVoices,
    selectedVieNeuVoice,
    isKokoroReady,
    kokoroProgress,
    isDownloadingKokoro,
    downloadKokoroModel,
    isModelReady,
    downloadProgress,
    isDownloadingModel,
    downloadNeuralModel,
    voices,
    vietnameseVoices,
    selectedVoice,
    vivosVoices,
    selectedVivosVoice,
    sentences,
    currentSentenceIndex,
    currentSentence: sentences[currentSentenceIndex] || '',
    sleepTimer,
    play,
    prepareChapterTransition,
    continueChapter,
    pause,
    resume,
    stop,
    nextSentence,
    prevSentence,
    jumpToSentence,
    setSentencesList,
    startSleepTimer,
    cancelSleepTimer,
    previewVoice,
    isIOS,
  };
}
