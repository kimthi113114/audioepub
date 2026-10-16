import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import type { PlaybackState, SleepTimerState } from '../types';

// Silent 1-second MP3 data URI to keep iOS Safari background audio alive
const SILENT_AUDIO_URI =
  'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhACfn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn58AAAAATGFtZTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

export interface UseTTSReturn {
  playbackState: PlaybackState;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  sentences: string[];
  currentSentenceIndex: number;
  currentSentence: string;
  sleepTimer: SleepTimerState;
  play: (textList?: string[], startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  nextSentence: () => void;
  prevSentence: () => void;
  jumpToSentence: (index: number) => void;
  setSentencesList: (list: string[], initialIndex?: number) => void;
  startSleepTimer: (minutes: number | 'chapter') => void;
  cancelSleepTimer: () => void;
  isIOS: boolean;
}

export function useTTS(onSentenceChange?: (index: number, sentence: string) => void): UseTTSReturn {
  const {
    speechRate,
    speechPitch,
    volume,
    selectedVoiceURI,
    setSelectedVoiceURI,
  } = useSettingsStore();

  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  // Sleep timer state
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({
    isActive: false,
    totalSeconds: 0,
    remainingSeconds: 0,
    targetMode: 'time',
    fadeAudio: true,
  });

  const timerIntervalRef = useRef<number | null>(null);
  const keepAliveIntervalRef = useRef<number | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const currentSentenceIndexRef = useRef<number>(0);
  const sentencesRef = useRef<string[]>([]);

  // Detect iOS Safari
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  // Sync refs
  useEffect(() => {
    currentSentenceIndexRef.current = currentSentenceIndex;
  }, [currentSentenceIndex]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  // 1. Initialize voices with fallback polling for iOS Safari
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices && availableVoices.length > 0) {
        setVoices(availableVoices);

        // Auto select Vietnamese voice if not set
        if (!selectedVoiceURI) {
          const vnVoice = availableVoices.find(
            (v) => v.lang.includes('vi') || v.name.toLowerCase().includes('vietnam')
          );
          if (vnVoice) {
            setSelectedVoiceURI(vnVoice.voiceURI);
          }
        }
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    // iOS Safari sometimes doesn't trigger onvoiceschanged
    const interval = setInterval(loadVoices, 1000);
    const timeout = setTimeout(() => clearInterval(interval), 5000);

    return () => {
      synth.onvoiceschanged = null;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [selectedVoiceURI, setSelectedVoiceURI]);

  // Helper: List Vietnamese voices
  const vietnameseVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('vi') ||
      v.name.toLowerCase().includes('vietnam') ||
      v.name.toLowerCase().includes('linh') ||
      v.name.toLowerCase().includes('an') ||
      v.name.toLowerCase().includes('hoaimy') ||
      v.name.toLowerCase().includes('namminh')
  );

  const selectedVoice =
    voices.find((v) => v.voiceURI === selectedVoiceURI) ||
    vietnameseVoices[0] ||
    voices[0] ||
    null;

  // 2. iOS Safari Audio Keep-Alive Audio Element
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio(SILENT_AUDIO_URI);
    audio.loop = true;
    audio.setAttribute('playsinline', 'true');
    (audio as any).playsInline = true;
    silentAudioRef.current = audio;

    return () => {
      audio.pause();
      silentAudioRef.current = null;
    };
  }, []);

  // 3. Keep-alive for Chrome 15s freeze bug
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

  // 4. Core Speech Engine: Speak sentence at index
  const speakCurrentSentence = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const idx = currentSentenceIndexRef.current;
    const list = sentencesRef.current;

    if (idx >= list.length || idx < 0) {
      // Finished reading text
      setPlaybackState('idle');
      isPlayingRef.current = false;
      stopKeepAlive();
      if (silentAudioRef.current) silentAudioRef.current.pause();
      return;
    }

    const textToSpeak = list[idx].trim();
    if (!textToSpeak) {
      // Empty sentence, move to next
      currentSentenceIndexRef.current = idx + 1;
      setCurrentSentenceIndex(idx + 1);
      speakCurrentSentence();
      return;
    }

    // Cancel current speech before speaking next
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;

    // Calculate volume factoring in Sleep Timer fade-out
    let effectiveVolume = volume;
    if (sleepTimer.isActive && sleepTimer.fadeAudio && sleepTimer.remainingSeconds <= 30) {
      effectiveVolume = volume * Math.max(0, sleepTimer.remainingSeconds / 30);
    }
    utterance.volume = effectiveVolume;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }

    utterance.onstart = () => {
      setPlaybackState('playing');
      isPlayingRef.current = true;
      if (onSentenceChange) {
        onSentenceChange(idx, textToSpeak);
      }

      // Update MediaSession for iOS Control Center & lock screen
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    };

    utterance.onend = () => {
      if (!isPlayingRef.current) return;

      // Check if Sleep Timer mode is 'chapter' and this is the last sentence
      if (sleepTimer.isActive && sleepTimer.targetMode === 'chapter' && idx >= list.length - 1) {
        setPlaybackState('idle');
        isPlayingRef.current = false;
        synth.cancel();
        setSleepTimer((prev) => ({ ...prev, isActive: false, remainingSeconds: 0 }));
        return;
      }

      // Automatically speak next sentence
      const nextIdx = idx + 1;
      currentSentenceIndexRef.current = nextIdx;
      setCurrentSentenceIndex(nextIdx);
      speakCurrentSentence();
    };

    utterance.onerror = (event) => {
      console.warn('SpeechSynthesis error:', event);
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        // Retry next sentence on error
        const nextIdx = idx + 1;
        currentSentenceIndexRef.current = nextIdx;
        setCurrentSentenceIndex(nextIdx);
        speakCurrentSentence();
      }
    };

    synth.speak(utterance);
    startKeepAlive();
  }, [
    speechRate,
    speechPitch,
    volume,
    selectedVoice,
    sleepTimer,
    onSentenceChange,
    startKeepAlive,
    stopKeepAlive,
  ]);

  // 5. Controls: Play, Pause, Resume, Stop
  const play = useCallback(
    (textList?: string[], startIndex?: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // Unlock iOS Safari Audio
      if (silentAudioRef.current) {
        silentAudioRef.current.play().catch(() => {});
      }

      if (textList && textList.length > 0) {
        setSentences(textList);
        sentencesRef.current = textList;
      }

      const targetIdx = startIndex !== undefined ? startIndex : currentSentenceIndexRef.current;
      currentSentenceIndexRef.current = targetIdx;
      setCurrentSentenceIndex(targetIdx);

      isPlayingRef.current = true;
      setPlaybackState('playing');

      speakCurrentSentence();
    },
    [speakCurrentSentence]
  );

  const pause = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    isPlayingRef.current = false;
    window.speechSynthesis.cancel();
    setPlaybackState('paused');
    stopKeepAlive();
    if (silentAudioRef.current) silentAudioRef.current.pause();

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }, [stopKeepAlive]);

  const resume = useCallback(() => {
    isPlayingRef.current = true;
    setPlaybackState('playing');
    if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
    speakCurrentSentence();
  }, [speakCurrentSentence]);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    isPlayingRef.current = false;
    window.speechSynthesis.cancel();
    setPlaybackState('idle');
    stopKeepAlive();
    if (silentAudioRef.current) silentAudioRef.current.pause();

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }, [stopKeepAlive]);

  const nextSentence = useCallback(() => {
    const nextIdx = Math.min(sentencesRef.current.length - 1, currentSentenceIndexRef.current + 1);
    currentSentenceIndexRef.current = nextIdx;
    setCurrentSentenceIndex(nextIdx);
    if (isPlayingRef.current) {
      speakCurrentSentence();
    }
  }, [speakCurrentSentence]);

  const prevSentence = useCallback(() => {
    const prevIdx = Math.max(0, currentSentenceIndexRef.current - 1);
    currentSentenceIndexRef.current = prevIdx;
    setCurrentSentenceIndex(prevIdx);
    if (isPlayingRef.current) {
      speakCurrentSentence();
    }
  }, [speakCurrentSentence]);

  const jumpToSentence = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(sentencesRef.current.length - 1, index));
      currentSentenceIndexRef.current = clamped;
      setCurrentSentenceIndex(clamped);
      if (isPlayingRef.current) {
        speakCurrentSentence();
      }
    },
    [speakCurrentSentence]
  );

  const setSentencesList = useCallback((list: string[], initialIndex: number = 0) => {
    setSentences(list);
    sentencesRef.current = list;
    currentSentenceIndexRef.current = initialIndex;
    setCurrentSentenceIndex(initialIndex);
  }, []);

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
          // Time expired! Stop audio
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
    } catch (e) {
      console.warn('MediaSession handler error:', e);
    }
  }, [resume, pause, nextSentence, prevSentence]);

  return {
    playbackState,
    voices,
    vietnameseVoices,
    selectedVoice,
    sentences,
    currentSentenceIndex,
    currentSentence: sentences[currentSentenceIndex] || '',
    sleepTimer,
    play,
    pause,
    resume,
    stop,
    nextSentence,
    prevSentence,
    jumpToSentence,
    setSentencesList,
    startSleepTimer,
    cancelSleepTimer,
    isIOS,
  };
}
