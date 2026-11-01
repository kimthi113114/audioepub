import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ConfigProvider, App as AntdApp, theme as antdTheme, message } from 'antd';
import type { Book } from './types';
import { db } from './db';
import { useSettingsStore } from './store/useSettingsStore';
import { useTTS } from './hooks/useTTS';
import { Navbar } from './components/Navbar';
import { BookShelf } from './components/BookShelf';
import { ReaderView, type ChapterControls } from './components/ReaderView';
import { Player } from './components/Player';
import { SleepTimerModal } from './components/SleepTimerModal';
import { IOSGuideModal } from './components/iOSGuideModal';
import { VoiceModal } from './components/VoiceModal';
import { VoiceDrawer } from './components/VoiceDrawer';
import { ReaderSettingsSheet } from './components/ReaderSettingsSheet';
import { AudioLogModal } from './components/AudioLogModal';
import { StorageModal } from './components/StorageModal';
import { getPalette } from './theme/palettes';

export const App: React.FC = () => {
  const { theme } = useSettingsStore();

  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState<boolean>(false);
  const [isIOSGuideOpen, setIsIOSGuideOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState<boolean>(false);
  const [isStorageOpen, setIsStorageOpen] = useState<boolean>(false);
  const [isAudioLogOpen, setIsAudioLogOpen] = useState<boolean>(false);
  const [isReaderSettingsOpen, setIsReaderSettingsOpen] = useState<boolean>(false);
  const [chromeVisible, setChromeVisible] = useState<boolean>(true);
  const [isPlayerSheetOpen, setIsPlayerSheetOpen] = useState<boolean>(false);
  const [chapterInfo, setChapterInfo] = useState({ title: '', index: 0, total: 0 });

  const handleOpenVoiceSettings = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsVoiceDrawerOpen(true);
    } else {
      setIsVoiceModalOpen(true);
    }
  }, []);

  // References to chapter controls for auto next chapter transition
  const chapterControlsRef = useRef<ChapterControls | null>(null);
  const autoPlayNextChapterRef = useRef<boolean>(false);

  // Auto transition to next chapter when current chapter finishes reading
  const handleChapterComplete = useCallback(() => {
    if (chapterControlsRef.current) {
      autoPlayNextChapterRef.current = true;
      chapterControlsRef.current.nextChapter();
    }
  }, []);

  // Core TTS hook
  const {
    playbackState,
    voices,
    vietnameseVoices,
    currentSentenceIndex,
    sentences,
    sleepTimer,
    play,
    pause,
    stop,
    nextSentence,
    prevSentence,
    jumpToSentence,
    setSentencesList,
    startSleepTimer,
    cancelSleepTimer,
    previewVoice,
    isKokoroReady,
    kokoroProgress,
    isDownloadingKokoro,
    downloadKokoroModel,
  } = useTTS({
    onChapterComplete: handleChapterComplete,
    bookTitle: currentBook?.title,
    bookCoverUrl: currentBook?.coverUrl,
  });

  // Static hosting (e.g. GitHub Pages) has no /api/tts: probe once and fall back to an on-device voice
  const [serverTTS, setServerTTS] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/tts?health=1')
      .then((r) => r.ok && (r.headers.get('content-type') || '').includes('json'))
      .catch(() => false)
      .then((ok) => setServerTTS(ok));
  }, []);

  const { selectedVoiceURI, setSelectedVoiceURI } = useSettingsStore();
  useEffect(() => {
    if (serverTTS !== false || vietnameseVoices.length === 0) return;
    if (voices.some((v) => v.voiceURI === selectedVoiceURI)) return; // already an on-device voice
    setSelectedVoiceURI(vietnameseVoices[0].voiceURI);
    message.info('Bản web tĩnh không có giọng AI từ server. Đã chuyển sang giọng Tiếng Việt của thiết bị.');
  }, [serverTTS, vietnameseVoices, voices, selectedVoiceURI, setSelectedVoiceURI]);

  // Load books from IndexedDB
  const loadBooks = useCallback(async () => {
    try {
      const list = await db.books.toArray();
      setBooks(list);
    } catch (err) {
      console.error('Error loading books:', err);
      message.error('Không thể nạp danh sách sách từ IndexedDB');
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Publish the palette as CSS variables (shared by every component, including inline styles)
  useEffect(() => {
    const p = getPalette(theme);
    const style = document.documentElement.style;
    style.setProperty('--bg', p.page);
    style.setProperty('--surface', p.surface);
    style.setProperty('--surface-alt', p.surfaceAlt);
    style.setProperty('--border', p.border);
    style.setProperty('--text', p.text);
    style.setProperty('--muted', p.muted);
    style.setProperty('--primary', p.primary);
    style.setProperty('--primary-soft', p.primarySoft);
    style.setProperty('--highlight', p.highlight);
    style.setProperty('--shadow', p.shadow);
    style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    document.body.className = `theme-${theme}`;
    // Safari ignores in-place changes of theme-color: replace the elements so the toolbar / status bar
    // area (which is painted outside the page on iOS) follows the current theme
    document.querySelectorAll('meta[name="theme-color"], meta[name="color-scheme"]').forEach((m) => m.remove());
    const themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    themeColor.content = p.page;
    const colorScheme = document.createElement('meta');
    colorScheme.name = 'color-scheme';
    colorScheme.content = theme === 'dark' ? 'dark' : 'light';
    document.head.append(themeColor, colorScheme);
    style.backgroundColor = p.page;
  }, [theme]);

  // Handle select book to read
  const handleSelectBook = (book: Book) => {
    stop(); // stop any current speech
    setChromeVisible(true);
    setIsPlayerSheetOpen(false);
    setCurrentBook(book);
  };

  const handleBackToShelf = () => {
    stop();
    setIsPlayerSheetOpen(false);
    setCurrentBook(null);
    loadBooks(); // refresh progress
  };

  // Callback when ReaderView extracts new sentences from current chapter
  const handleSentencesReady = useCallback(
    (newSentences: string[], keepIndex?: number) => {
      const start = Math.min(keepIndex ?? 0, Math.max(0, newSentences.length - 1));
      setSentencesList(newSentences, start);
      if (autoPlayNextChapterRef.current) {
        autoPlayNextChapterRef.current = false;
        play(newSentences, start);
      }
    },
    [setSentencesList, play]
  );

  // Listen mode is "on" whenever the player has something loaded/playing/paused
  const playerActive = playbackState !== 'idle';

  const startListen = useCallback(
    (startIndex: number) => {
      setChromeVisible(false);
      play(sentences, startIndex);
    },
    [play, sentences]
  );

  // Tap toggles the chrome; while listening a double tap on a sentence jumps there (see ReaderView)
  const handleSentenceTap = useCallback(() => {
    setChromeVisible((v) => !v);
  }, []);

  const registerChapterControls = useCallback((ctrls: ChapterControls) => {
    chapterControlsRef.current = ctrls;
  }, []);

  const handleChapterChanged = useCallback((title: string, index: number, total: number) => {
    setChapterInfo({ title, index, total });
  }, []);

  const barBg = getPalette(theme).surface;

  // Ant Design v5 Theme Configuration
  const getThemeConfig = () => {
    const p = getPalette(theme);
    return {
      algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: p.primary,
        colorLink: p.primary,
        colorInfo: p.primary,
        colorBgBase: p.page,
        colorBgLayout: p.page,
        colorBgContainer: p.surface,
        colorBgElevated: p.surface,
        colorFillSecondary: p.surfaceAlt,
        colorBorder: p.border,
        colorBorderSecondary: p.border,
        colorText: p.text,
        colorTextBase: p.text,
        colorTextSecondary: p.muted,
        colorTextDescription: p.muted,
        borderRadius: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      },
      components: {
        Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
        Drawer: { colorBgElevated: p.surface },
      },
    };
  };

  return (
    <ConfigProvider theme={getThemeConfig()}>
      <AntdApp>
        <div
          style={{
            width: '100%',
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            background: 'inherit',
            color: 'inherit',
            position: 'relative',
          }}
        >
          {/* Top Header Navbar */}
          <div
            style={
              currentBook
                ? {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: barBg,
                    transform: chromeVisible ? 'translateY(0)' : 'translateY(-100%)',
                    transition: 'transform 0.2s ease',
                    pointerEvents: chromeVisible ? 'auto' : 'none',
                  }
                : undefined
            }
          >
          <Navbar
            currentBookTitle={currentBook?.title}
            onBackToShelf={currentBook ? handleBackToShelf : undefined}
            onOpenTimerModal={() => setIsTimerModalOpen(true)}
            onOpenIOSGuide={() => setIsIOSGuideOpen(true)}
            onOpenReaderSettings={currentBook ? () => setIsReaderSettingsOpen(true) : undefined}
            onOpenAudioLog={() => setIsAudioLogOpen(true)}
            onOpenStorage={() => setIsStorageOpen(true)}
            onOpenVoiceModal={handleOpenVoiceSettings}
            onOpenUpload={currentBook ? undefined : () => setIsUploadModalOpen(true)}
            sleepTimer={sleepTimer}
          />
          </div>

          {/* Content View: Shelf or Reader */}
          <main
            style={{
              flex: 1,
              minHeight: 0,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              // Reserve room for the mini-player so it never covers the text
              paddingBottom: currentBook && playerActive ? 'calc(64px + var(--sab, 0px))' : 0,
              transition: 'padding-bottom 0.2s ease',
            }}
          >
            {currentBook ? (
              <ReaderView
                book={currentBook}
                currentSentenceIndex={currentSentenceIndex}
                onSentencesReady={handleSentencesReady}
                onChapterChanged={handleChapterChanged}
                onSentenceTap={handleSentenceTap}
                onSentenceLongPress={startListen}
                onSentenceDoubleTap={jumpToSentence}
                onStartListen={startListen}
                chromeVisible={chromeVisible}
                playerActive={playerActive}
                registerChapterControls={registerChapterControls}
              />
            ) : (
              <BookShelf
                books={books}
                onSelectBook={handleSelectBook}
                onRefreshBooks={loadBooks}
                isUploadModalOpen={isUploadModalOpen}
                onCloseUploadModal={() => setIsUploadModalOpen(false)}
              />
            )}
          </main>

          {/* Listen mode: mini-player + full player sheet (only while audio is active) */}
          {currentBook && playerActive && (
            <Player
              playbackState={playbackState}
              onPlay={() => play()}
              onPause={pause}
              onNextSentence={nextSentence}
              onPrevSentence={prevSentence}
              onNextChapter={() => chapterControlsRef.current?.nextChapter()}
              onPrevChapter={() => chapterControlsRef.current?.prevChapter()}
              onClose={stop}
              onOpenTimer={() => setIsTimerModalOpen(true)}
              onOpenVoice={handleOpenVoiceSettings}
              sheetOpen={isPlayerSheetOpen}
              onSheetOpenChange={setIsPlayerSheetOpen}
              chapterTitle={chapterInfo.title}
              chapterIndex={chapterInfo.index}
              totalChapters={chapterInfo.total}
              sentenceIndex={currentSentenceIndex}
              totalSentences={sentences.length}
              bookTitle={currentBook.title}
              bookCoverUrl={currentBook.coverUrl}
              sleepTimer={sleepTimer}
            />
          )}

          <StorageModal
            open={isStorageOpen}
            onClose={() => setIsStorageOpen(false)}
            onLibraryChanged={loadBooks}
            onLibraryCleared={() => {
              setIsStorageOpen(false);
              handleBackToShelf();
            }}
          />
          <AudioLogModal open={isAudioLogOpen} onClose={() => setIsAudioLogOpen(false)} />
          <ReaderSettingsSheet open={isReaderSettingsOpen} onClose={() => setIsReaderSettingsOpen(false)} />

          {/* Sleep Timer Modal */}
          <SleepTimerModal
            open={isTimerModalOpen}
            onClose={() => setIsTimerModalOpen(false)}
            sleepTimer={sleepTimer}
            onStartTimer={startSleepTimer}
            onCancelTimer={cancelSleepTimer}
          />

          {/* iOS Safari Guide Modal */}
          <IOSGuideModal
            open={isIOSGuideOpen}
            onClose={() => setIsIOSGuideOpen(false)}
          />

          {/* Vietnamese & International Voice Settings Modal (Desktop) */}
          <VoiceModal
            open={isVoiceModalOpen}
            onClose={() => setIsVoiceModalOpen(false)}
            voices={voices}
            vietnameseVoices={vietnameseVoices}
            onPreviewVoice={previewVoice}
            isKokoroReady={isKokoroReady}
            kokoroProgress={kokoroProgress}
            isDownloadingKokoro={isDownloadingKokoro}
            onDownloadKokoroModel={downloadKokoroModel}
          />

          {/* Mobile Bottom Sheet Voice Drawer */}
          <VoiceDrawer
            open={isVoiceDrawerOpen}
            onClose={() => setIsVoiceDrawerOpen(false)}
            voices={voices}
            vietnameseVoices={vietnameseVoices}
            onPreviewVoice={previewVoice}
            isKokoroReady={isKokoroReady}
            kokoroProgress={kokoroProgress}
            isDownloadingKokoro={isDownloadingKokoro}
            onDownloadKokoroModel={downloadKokoroModel}
          />
        </div>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
