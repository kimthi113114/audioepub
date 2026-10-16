export interface Book {
  id?: number;
  title: string;
  author: string;
  coverUrl?: string; // Data URL or base64
  fileBlob: Blob;
  fileSize: number;
  totalChapters?: number;
  currentCfi?: string;
  currentChapterIndex?: number;
  progressPercent: number;
  addedAt: Date;
  lastReadAt?: Date;
}

export interface Bookmark {
  id?: number;
  bookId: number;
  cfi: string;
  label: string;
  previewText: string;
  createdAt: Date;
}

export interface Chapter {
  id: string;
  href: string;
  label: string;
  subitems?: Chapter[];
}

export type AppTheme = 'light' | 'dark' | 'sepia';

export interface ReaderSettings {
  theme: AppTheme;
  fontSize: number; // in px: 14 to 32
  lineHeight: number; // 1.4 to 2.2
  fontFamily: string;
  speechRate: number; // 0.5 to 2.5
  speechPitch: number; // 0.5 to 1.5
  volume: number; // 0 to 1
  selectedVoiceURI: string;
  autoScroll: boolean;
  highlightSentence: boolean;
}

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'loading';

export interface TTSState {
  state: PlaybackState;
  currentSentence: string;
  currentSentenceIndex: number;
  totalSentences: number;
  chapterTitle: string;
}

export interface SleepTimerState {
  isActive: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  targetMode: 'time' | 'chapter';
  fadeAudio: boolean;
}
