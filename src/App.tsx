import React, { useEffect, useState, useCallback } from 'react';
import { ConfigProvider, theme as antdTheme, message } from 'antd';
import type { Book } from './types';
import { db } from './db';
import { useSettingsStore } from './store/useSettingsStore';
import { useTTS } from './hooks/useTTS';
import { Navbar } from './components/Navbar';
import { BookShelf } from './components/BookShelf';
import { ReaderView } from './components/ReaderView';
import { PlayerBar } from './components/PlayerBar';
import { SleepTimerModal } from './components/SleepTimerModal';
import { IOSGuideModal } from './components/iOSGuideModal';

export const App: React.FC = () => {
  const { theme } = useSettingsStore();

  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState<boolean>(false);
  const [isIOSGuideOpen, setIsIOSGuideOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Core TTS hook
  const {
    playbackState,
    voices,
    vietnameseVoices,
    currentSentence,
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
  } = useTTS();

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

  // Update body theme class
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  // Handle select book to read
  const handleSelectBook = (book: Book) => {
    stop(); // stop any current speech
    setCurrentBook(book);
  };

  const handleBackToShelf = () => {
    stop();
    setCurrentBook(null);
    loadBooks(); // refresh progress
  };

  // Callback when ReaderView extracts new sentences from current chapter
  const handleSentencesReady = useCallback(
    (newSentences: string[]) => {
      setSentencesList(newSentences, 0);
    },
    [setSentencesList]
  );

  // Ant Design v5 Theme Configuration
  const getThemeConfig = () => {
    if (theme === 'dark') {
      return {
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          colorBgBase: '#0f172a',
          colorTextBase: '#f1f5f9',
          borderRadius: 8,
        },
      };
    }
    if (theme === 'sepia') {
      return {
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#d97706',
          colorBgBase: '#fbf0d9',
          colorTextBase: '#5f4b32',
          borderRadius: 8,
        },
      };
    }
    return {
      algorithm: antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        colorBgBase: '#f8fafc',
        colorTextBase: '#1e293b',
        borderRadius: 8,
      },
    };
  };

  return (
    <ConfigProvider theme={getThemeConfig()}>
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
        <Navbar
          currentBookTitle={currentBook?.title}
          onBackToShelf={currentBook ? handleBackToShelf : undefined}
          onOpenTimerModal={() => setIsTimerModalOpen(true)}
          onOpenIOSGuide={() => setIsIOSGuideOpen(true)}
          onOpenUpload={currentBook ? undefined : () => setIsUploadModalOpen(true)}
          sleepTimer={sleepTimer}
        />

        {/* Content View: Shelf or Reader */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {currentBook ? (
            <ReaderView
              book={currentBook}
              currentSentenceIndex={currentSentenceIndex}
              onSentencesReady={handleSentencesReady}
              onSentenceClick={jumpToSentence}
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

        {/* Fixed Player Bar at bottom (visible when reading book) */}
        {currentBook && (
          <PlayerBar
            playbackState={playbackState}
            onPlay={() => play()}
            onPause={pause}
            onNext={nextSentence}
            onPrev={prevSentence}
            currentSentence={currentSentence}
            currentSentenceIndex={currentSentenceIndex}
            totalSentences={sentences.length}
            voices={voices}
            vietnameseVoices={vietnameseVoices}
          />
        )}

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
      </div>
    </ConfigProvider>
  );
};

export default App;
