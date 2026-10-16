import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReaderSettings } from '../types';

interface SettingsStore extends ReaderSettings {
  readingMode: 'continuous' | 'paginated';
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
  resetSettings: () => void;
}

const defaultSettings: ReaderSettings & { readingMode: 'continuous' | 'paginated' } = {
  theme: 'light',
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  speechRate: 1.0,
  speechPitch: 1.0,
  volume: 1.0,
  selectedVoiceURI: '',
  autoScroll: true,
  highlightSentence: true,
  readingMode: 'continuous',
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
      setSelectedVoiceURI: (selectedVoiceURI) => set({ selectedVoiceURI }),
      setAutoScroll: (autoScroll) => set({ autoScroll }),
      setHighlightSentence: (highlightSentence) => set({ highlightSentence }),
      setReadingMode: (readingMode) => set({ readingMode }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'audioepub-settings-v1',
    }
  )
);
