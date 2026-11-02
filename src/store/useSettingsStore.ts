import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReaderSettings, TTSEngineType, TTSEngineMode, VieNeuMode } from '../types';

interface SettingsStore extends ReaderSettings {
  readingMode: 'continuous' | 'paginated';
  vieneuMode: VieNeuMode;
  setVieneuMode: (mode: VieNeuMode) => void;
  engineMode: TTSEngineMode;
  ttsEngine: TTSEngineType;
  neuralSpeakerId: number;
  neuralModelDownloaded: boolean;
  setTheme: (theme: ReaderSettings['theme']) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setSpeechRate: (speechRate: number) => void;
  setSpeechPitch: (speechPitch: number) => void;
  setVolume: (volume: number) => void;
  setSelectedVoiceURI: (voiceURI: string) => void;
  setAutoScroll: (autoScroll: boolean) => void;
  setHighlightSentence: (highlight: boolean) => void;
  setReadingMode: (mode: 'continuous' | 'paginated') => void;
  setEngineMode: (mode: TTSEngineMode) => void;
  setTtsEngine: (engine: TTSEngineType) => void;
  setNeuralSpeakerId: (speakerId: number) => void;
  setNeuralModelDownloaded: (ready: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings: ReaderSettings & {
  readingMode: 'continuous' | 'paginated';
  vieneuMode: VieNeuMode;
  engineMode: TTSEngineMode;
  ttsEngine: TTSEngineType;
  neuralSpeakerId: number;
  neuralModelDownloaded: boolean;
} = {
  theme: 'light',
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  speechRate: 1.0,
  speechPitch: 1.0,
  volume: 1.0,
  selectedVoiceURI: 'vi-VN-HoaiMyNeural',
  autoScroll: true,
  highlightSentence: true,
  readingMode: 'continuous',
  vieneuMode: 'v3nano',
  engineMode: 'edge',
  ttsEngine: 'edge',
  neuralSpeakerId: 0,
  neuralModelDownloaded: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setSpeechRate: (speechRate) => set({ speechRate }),
      setSpeechPitch: (speechPitch) => set({ speechPitch }),
      setVolume: (volume) => set({ volume }),
      setSelectedVoiceURI: (selectedVoiceURI) => {
        if (selectedVoiceURI.startsWith('kokoro:')) {
          set({ selectedVoiceURI, engineMode: 'kokoro', ttsEngine: 'kokoro' });
        } else if (selectedVoiceURI.startsWith('vtts:')) {
          set({ selectedVoiceURI, engineMode: 'vtts', ttsEngine: 'vtts' });
        } else if (selectedVoiceURI.startsWith('vieneu:')) {
          set({ selectedVoiceURI, engineMode: 'vieneu', ttsEngine: 'vieneu' });
        } else if (
          selectedVoiceURI === 'vi-VN-HoaiMyNeural' ||
          selectedVoiceURI === 'vi-VN-NamMinhNeural' ||
          selectedVoiceURI.endsWith('Neural') ||
          selectedVoiceURI.startsWith('vi-') ||
          selectedVoiceURI.startsWith('en-US') ||
          selectedVoiceURI.startsWith('zh-CN') ||
          selectedVoiceURI.startsWith('ja-JP')
        ) {
          set({ selectedVoiceURI, engineMode: 'edge', ttsEngine: 'edge' });
        } else if (selectedVoiceURI.startsWith('piper:')) {
          set({ selectedVoiceURI, engineMode: 'neural', ttsEngine: 'neural' });
        } else {
          set({ selectedVoiceURI, engineMode: 'system', ttsEngine: 'system' });
        }
      },
      setAutoScroll: (autoScroll) => set({ autoScroll }),
      setHighlightSentence: (highlightSentence) => set({ highlightSentence }),
      setReadingMode: (readingMode) => set({ readingMode }),
      setVieneuMode: (vieneuMode) => set({ vieneuMode }),
      setEngineMode: (engineMode) => {
        set({
          engineMode,
          ttsEngine: engineMode as TTSEngineType,
        });
      },
      setTtsEngine: (ttsEngine) => {
        const engineMode =
          ttsEngine === 'webspeech'
            ? 'system'
            : ttsEngine === 'neural_piper'
            ? 'neural'
            : (ttsEngine as any);
        set({ ttsEngine, engineMode });
      },
      setNeuralSpeakerId: (neuralSpeakerId) => set({ neuralSpeakerId }),
      setNeuralModelDownloaded: (neuralModelDownloaded) => set({ neuralModelDownloaded }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'audioepub-settings-v2',
    }
  )
);

