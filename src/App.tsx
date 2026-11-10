import { setServerStatus } from './utils/serverStatus';
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
import { apiUrl } from './utils/apiBase';

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
      const advanced = chapterControlsRef.current.nextChapter();
      if (!advanced) autoPlayNextChapterRef.current = false;
      return advanced;
    }
    return false;
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
    continueChapter,
    prepareChapterTransition,
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
    onPlaybackCancelled: () => { autoPlayNextChapterRef.current = false; },
    onPrefetchNextChapter: useCallback(async () => {
      if (chapterControlsRef.current?.getNextChapterSentences) {
        return await chapterControlsRef.current.getNextChapterSentences(2);
      }
      return [];
    }, []),
    bookTitle: currentBook?.title,
    bookCoverUrl: currentBook?.coverUrl,
  });

  const handlePause = useCallback(() => {
    autoPlayNextChapterRef.current = false;
    pause();
  }, [pause]);

  const handleStop = useCallback(() => {
    autoPlayNextChapterRef.current = false;
    stop();
  }, [stop]);

  const handleChapterNavigation = useCallback(() => {
    const shouldResume = autoPlayNextChapterRef.current ||
      playbackState === 'playing' || playbackState === 'loading';
    if (shouldResume) prepareChapterTransition();
    autoPlayNextChapterRef.current = shouldResume;
  }, [playbackState, prepareChapterTransition]);

  // Static hosting (e.g. GitHub Pages) has no /api/tts: probe once and fall back to an on-device voice
  const [serverTTS, setServerTTS] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(apiUrl('/api/tts?health=1'))
      .then((r) => r.ok && (r.headers.get('content-type') || '').includes('json'))
      .catch(() => false)
      .then((ok) => {
        setServerTTS(ok);
        setServerStatus(ok);
      });
  }, []);

  const { selectedVoiceURI, setSelectedVoiceURI } = useSettingsStore();
  // V-TTS was removed: drop the stale selection and the ~175 MB model cache it left in the browser
  useEffect(() => {
    if (typeof caches !== 'undefined') caches.delete('audioepub-vtts-v1').catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!selectedVoiceURI.startsWith('vtts:') || serverTTS === null) return;
    const fallback = serverTTS ? 'vi-VN-HoaiMyNeural' : vietnameseVoices[0]?.voiceURI;
    if (fallback) setSelectedVoiceURI(fallback);
  }, [selectedVoiceURI, serverTTS, vietnameseVoices, setSelectedVoiceURI]);
  const serverFallbackDone = useRef<boolean>(false);
  useEffect(() => {
    if (serverFallbackDone.current || serverTTS !== false || vietnameseVoices.length === 0) return;
    // Only voices that need the server are replaced (Edge / Kokoro / VieNeu). On-device ones keep working.
    const needsServer =
      selectedVoiceURI.startsWith('kokoro:') ||
      selectedVoiceURI.startsWith('vieneu:') ||
      (/Neural$/.test(selectedVoiceURI) && !voices.some((v) => v.voiceURI === selectedVoiceURI));
    serverFallbackDone.current = true; // decide once per load; never fight a later manual choice
    if (!needsServer) return;
    setSelectedVoiceURI(vietnameseVoices[0].voiceURI);
    message.info('Bản web tĩnh không có giọng AI từ server. Đã chuyển sang giọng Tiếng Việt của thiết bị.');
  }, [serverTTS, vietnameseVoices, voices, selectedVoiceURI, setSelectedVoiceURI]);

  const ACTIVE_BOOK_KEY = 'audioepub_active_book_id';

  // Load books from IndexedDB
  const loadBooks = useCallback(async () => {
    try {
      const list = await db.books.toArray();
      setBooks(list);

      // Auto restore active reading book if page was reloaded or tab was discarded by browser
      const savedBookIdStr = localStorage.getItem(ACTIVE_BOOK_KEY);
      if (savedBookIdStr) {
        const savedBookId = Number(savedBookIdStr);
        const found = list.find((b) => b.id === savedBookId);
        if (found) {
          setCurrentBook((prev) => prev || found);
        }
      }
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
    autoPlayNextChapterRef.current = false;
    stop(); // stop any current speech
    setChromeVisible(true);
    setIsPlayerSheetOpen(false);
    if (book.id) {
      localStorage.setItem(ACTIVE_BOOK_KEY, String(book.id));
    }
    setCurrentBook(book);
  };

  const handleBackToShelf = () => {
    autoPlayNextChapterRef.current = false;
    stop();
    localStorage.removeItem(ACTIVE_BOOK_KEY);
    setIsPlayerSheetOpen(false);
    setCurrentBook(null);
    loadBooks(); // refresh progress
  };

  // Callback when ReaderView extracts new sentences from current chapter
  const handleSentencesReady = useCallback(
    (newSentences: string[], keepIndex?: number) => {
      if (autoPlayNextChapterRef.current && newSentences.length === 0) {
        // Image-only or empty spine sections must not silently end narration.
        if (!handleChapterComplete()) stop();
        return;
      }
      const start = Math.min(keepIndex ?? 0, Math.max(0, newSentences.length - 1));
      if (autoPlayNextChapterRef.current) {
        autoPlayNextChapterRef.current = false;
        continueChapter(newSentences, start);
      } else {
        setSentencesList(newSentences, start);
      }
    },
    [setSentencesList, continueChapter, handleChapterComplete, stop]
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
            className={`app-header-bar${currentBook && !chromeVisible ? ' reader-chrome-hidden' : ''}`}
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
            className={currentBook && playerActive ? 'has-active-player' : ''}
            style={{
              flex: 1,
              minHeight: 0,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'padding-bottom 0.2s ease',
            }}
          >
            {currentBook ? (
              <div className="reader-split-layout">
                {/* 30% Left Column Audio Player for Desktop */}
                {playerActive && (
                  <div className="reader-desktop-sidebar">
                    <Player
                      mode="sidebar"
                      playbackState={playbackState}
                      onPlay={() => play()}
                      onPause={handlePause}
                      onNextSentence={nextSentence}
                      onPrevSentence={prevSentence}
                      onNextChapter={() => chapterControlsRef.current?.nextChapter()}
                      onPrevChapter={() => chapterControlsRef.current?.prevChapter()}
                      onClose={handleStop}
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
                  </div>
                )}

                {/* 70% Right Column EPUB Reading Text */}
                <div className="reader-main-column">
                  <ReaderView
                    book={currentBook}
                    currentSentenceIndex={currentSentenceIndex}
                    onSentencesReady={handleSentencesReady}
                    onChapterNavigation={handleChapterNavigation}
                    onChapterNavigationFailed={handlePause}
                    onChapterChanged={handleChapterChanged}
                    onSentenceTap={handleSentenceTap}
                    onSentenceLongPress={startListen}
                    onSentenceDoubleTap={jumpToSentence}
                    onStartListen={startListen}
                    chromeVisible={chromeVisible}
                    playerActive={playerActive}
                    registerChapterControls={registerChapterControls}
                  />
                </div>
              </div>
            ) : (
              <BookShelf
                books={books}
                onSelectBook={handleSelectBook}
                onRefreshBooks={loadBooks}
                isUploadModalOpen={isUploadModalOpen}
                onCloseUploadModal={() => setIsUploadModalOpen(false)}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
              />
            )}
          </main>

          {/* Mobile Player: Mini-player docked at bottom + bottom sheet (hidden on desktop via CSS) */}
          {currentBook && playerActive && (
            <div className="mobile-only-player">
              <Player
                mode="mobile"
                playbackState={playbackState}
                onPlay={() => play()}
                onPause={handlePause}
                onNextSentence={nextSentence}
                onPrevSentence={prevSentence}
                onNextChapter={() => chapterControlsRef.current?.nextChapter()}
                onPrevChapter={() => chapterControlsRef.current?.prevChapter()}
                onClose={handleStop}
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
            </div>
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
