export interface Book {
  id?: number;
  title: string;
  author: string;
  coverUrl?: string; // Data URL or base64
  fileBlob: Blob;
  fileSize: number;
  totalChapters?: number;
  locationsData?: string; // Cached EPUB locations CFI for 0ms loading
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

export type TTSEngineMode = 'edge' | 'system' | 'neural';
export type TTSEngineType = 'edge' | 'system' | 'webspeech' | 'neural' | 'neural_piper';

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
  engineMode: TTSEngineMode;
  ttsEngine: TTSEngineType;
  neuralSpeakerId: number;
  neuralModelDownloaded: boolean;
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

export interface VivosVoice {
  id: string;
  speakerId: number;
  code: string;
  name: string;
  gender: 'female' | 'male';
  region: 'Bắc' | 'Trung' | 'Nam';
  description: string;
}

export interface VoiceOptionItem {
  id: string; // voiceURI hoặc 'piper:vivos:VIVOSSPK14'
  engine: TTSEngineType;
  name: string;
  lang: string;
  region: string;
  gender?: 'male' | 'female';
  badge: string;
  speakerId?: number;
  isOfflineReady?: boolean;
}

export interface ModelDownloadProgress {
  modelId: string;
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  status: 'idle' | 'downloading' | 'ready' | 'error';
  errorMessage?: string;
}

export interface PiperVoiceItem {
  id: string; // e.g. 'piper:vivos:VIVOSSPK14'
  speakerId: number;
  code: string; // 'VIVOSSPK14'
  name: string; // 'AI Ngọc Huyền'
  displayName: string;
  gender: 'female' | 'male';
  region: 'Bắc' | 'Trung' | 'Nam';
  badge: string;
  color: string;
  description: string;
}
