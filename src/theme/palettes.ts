import type { ReaderSettings } from '../types';

export type ThemeName = ReaderSettings['theme'];

export interface Palette {
  /** App / page background */
  page: string;
  /** Cards, bars, sheets */
  surface: string;
  /** Subtle fills (chips, placeholders, selected rows) */
  surfaceAlt: string;
  border: string;
  text: string;
  /** Long-form reading text (slightly softer than UI text) */
  reading: string;
  muted: string;
  primary: string;
  primarySoft: string;
  /** Highlight of the sentence being spoken */
  highlight: string;
  highlightText?: string;
  /** Translucent bar background for overlays */
  bar: string;
  shadow: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  // Warm paper white with a calm indigo accent
  light: {
    page: '#fbfaf7',
    surface: '#ffffff',
    surfaceAlt: '#f3f0e9',
    border: '#e8e3d9',
    text: '#22252b',
    reading: '#2b2f36',
    muted: '#6d717a',
    primary: '#4a5fd8',
    primarySoft: 'rgba(74, 95, 216, 0.10)',
    highlight: 'rgba(255, 205, 86, 0.55)',
    bar: 'rgba(255, 255, 255, 0.85)',
    shadow: '0 6px 24px rgba(40, 36, 28, 0.10)',
  },
  // Old book paper, brown ink, terracotta accent
  sepia: {
    page: '#f3ead7',
    surface: '#faf3e3',
    surfaceAlt: '#ebe0c6',
    border: '#dccfae',
    text: '#43362a',
    reading: '#4a3b2b',
    muted: '#86745b',
    primary: '#b4561f',
    primarySoft: 'rgba(180, 86, 31, 0.12)',
    highlight: 'rgba(205, 124, 42, 0.32)',
    bar: 'rgba(250, 243, 227, 0.88)',
    shadow: '0 6px 24px rgba(90, 62, 24, 0.14)',
  },
  // Deep blue-black, easy on the eyes at night
  dark: {
    page: '#0f1115',
    surface: '#171a21',
    surfaceAlt: '#1f232c',
    border: '#2b303b',
    text: '#dde1e8',
    reading: '#cdd2db',
    muted: '#8a92a2',
    primary: '#8aa8ff',
    primarySoft: 'rgba(138, 168, 255, 0.14)',
    highlight: 'rgba(138, 168, 255, 0.34)',
    highlightText: '#ffffff',
    bar: 'rgba(23, 26, 33, 0.85)',
    shadow: '0 6px 24px rgba(0, 0, 0, 0.5)',
  },
};

export const getPalette = (theme: ThemeName): Palette => PALETTES[theme] ?? PALETTES.light;
