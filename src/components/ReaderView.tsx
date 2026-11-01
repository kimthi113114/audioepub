import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ePub, { type Book as EpubBook, type Rendition } from 'epubjs';
import { Button, Drawer, Typography, Space, Input, message } from 'antd';
import {
  UnorderedListOutlined,
  LeftOutlined,
  RightOutlined,
  BookOutlined,
  AimOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import type { Book, Chapter } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';
import { splitTextIntoSentences } from '../utils/epubHelper';
import { db, type BookWithResume } from '../db';

const { Text } = Typography;

export interface ChapterControls {
  nextChapter: () => void;
  getFirstVisibleSentence?: () => number;
  prevChapter: () => void;
  currentChapterIndex: number;
  totalChapters: number;
}

interface ReaderViewProps {
  book: Book;
  currentSentenceIndex: number;
  onSentencesReady: (sentences: string[], keepIndex?: number) => void;
  onChapterChanged?: (title: string, index: number, total: number) => void;
  /** Tap on text: sentence index, or null when tapping blank area */
  onSentenceTap?: (index: number | null) => void;
  onSentenceLongPress?: (index: number) => void;
  /** Double tap on a sentence while listening: jump there */
  onSentenceDoubleTap?: (index: number) => void;
  onStartListen?: (startIndex: number) => void;
  chromeVisible: boolean;
  playerActive: boolean;
  registerChapterControls?: (controls: ChapterControls) => void;
}

const ReaderViewImpl: React.FC<ReaderViewProps> = ({
  book,
  currentSentenceIndex,
  onSentencesReady,
  onChapterChanged,
  onSentenceTap,
  onSentenceLongPress,
  onSentenceDoubleTap,
  onStartListen,
  chromeVisible,
  playerActive,
  registerChapterControls,
}) => {
  const { theme, fontSize, lineHeight, fontFamily, readingMode, autoScroll, highlightSentence } =
    useSettingsStore();

  const viewerRef = useRef<HTMLDivElement>(null);
  const epubBookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>('Đang mở sách...');
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [tocSearch, setTocSearch] = useState<string>('');

  // Latest callbacks, read from iframe listeners that are bound once per render of a chapter
  const tapRef = useRef(onSentenceTap);
  const longPressRef = useRef(onSentenceLongPress);
  const doubleTapRef = useRef(onSentenceDoubleTap);
  const playerActiveRef = useRef(playerActive);
  const lastTapRef = useRef<{ t: number; timer: number } | null>(null);

  // While listening a single tap toggles the UI after a short wait; a second tap jumps to that sentence.
  const dispatchTap = useCallback((idx: number | null) => {
    if (!playerActiveRef.current || idx === null) {
      tapRef.current?.(idx);
      return;
    }
    const prev = lastTapRef.current;
    if (prev && Date.now() - prev.t < 320) {
      window.clearTimeout(prev.timer);
      lastTapRef.current = null;
      doubleTapRef.current?.(idx);
      return;
    }
    const timer = window.setTimeout(() => {
      lastTapRef.current = null;
      tapRef.current?.(idx);
    }, 320);
    lastTapRef.current = { t: Date.now(), timer };
  }, []);
  const readingModeRef = useRef(readingMode);
  const sentenceIdxRef = useRef(currentSentenceIndex);
  const keepSentenceRef = useRef<number | null>(null);
  // Resume point: current chapter href + sentence index, written to IndexedDB (debounced)
  const currentHrefRef = useRef<string | null>(null);
  const resumeScrollRef = useRef<number | null>(null);
  const pendingResumeRef = useRef<{ href: string; sentence: number } | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);

  const flushResume = useCallback(() => {
    window.clearTimeout(saveTimerRef.current);
    const pending = pendingResumeRef.current;
    pendingResumeRef.current = null;
    if (!pending || !book.id) return;
    db.books
      .update(book.id, { resumeHref: pending.href, resumeSentence: pending.sentence, lastReadAt: new Date() })
      .catch(() => {});
  }, [book.id]);

  const saveResume = useCallback(
    (sentence: number) => {
      const href = currentHrefRef.current;
      if (!href || !book.id) return;
      pendingResumeRef.current = { href, sentence };
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(flushResume, 400);
    },
    [book.id, flushResume]
  );
  const [renderTick, setRenderTick] = useState<number>(0);
  useEffect(() => {
    tapRef.current = onSentenceTap;
    longPressRef.current = onSentenceLongPress;
    doubleTapRef.current = onSentenceDoubleTap;
    playerActiveRef.current = playerActive;
    readingModeRef.current = readingMode;
    sentenceIdxRef.current = currentSentenceIndex;
  });

  const barBg =
    theme === 'dark' ? 'rgba(15,23,42,0.96)' : theme === 'sepia' ? 'rgba(251,240,217,0.96)' : 'rgba(255,255,255,0.96)';

  // References to rendered sentence elements for DOM highlighting
  const currentSentenceElementsRef = useRef<HTMLElement[]>([]);

  // Helper to remove accents for Vietnamese search
  const normalizeStr = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  // Filtered chapters for TOC search
  const filteredChapters = useMemo(() => {
    const all = chapters.map((c, idx) => ({ c, idx }));
    if (!tocSearch.trim()) return all;
    const q = normalizeStr(tocSearch.trim());
    return all.filter(({ c, idx }) => `${idx + 1}`.includes(q) || normalizeStr(c.label).includes(q));
  }, [chapters, tocSearch]);

  // Virtualized TOC: only rows in view are mounted (books can have thousands of chapters)
  const TOC_ROW_H = 44;
  const tocListRef = useRef<HTMLDivElement | null>(null);
  const [tocScrollTop, setTocScrollTop] = useState<number>(0);
  const [tocListH, setTocListH] = useState<number>(400);

  const scrollTocToCurrent = useCallback(() => {
    const el = tocListRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, currentChapterIndex * TOC_ROW_H - el.clientHeight / 2);
  }, [currentChapterIndex]);

  useEffect(() => {
    if (!isTocOpen) return;
    const t = window.setTimeout(() => {
      const el = tocListRef.current;
      if (el) setTocListH(el.clientHeight);
      scrollTocToCurrent();
    }, 350);
    return () => window.clearTimeout(t);
  }, [isTocOpen, scrollTocToCurrent]);

  // Navigate to next chapter (OOM Safe: single chapter lazy loaded)
  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      const nextIdx = currentChapterIndex + 1;
      const target = chapters[nextIdx];
      if (target && renditionRef.current) {
        currentSentenceElementsRef.current = [];
        viewerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
        renditionRef.current.display(target.href);
      }
    }
  }, [currentChapterIndex, chapters]);

  // Navigate to previous chapter (OOM Safe: single chapter lazy loaded)
  const handlePrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      const prevIdx = currentChapterIndex - 1;
      const target = chapters[prevIdx];
      if (target && renditionRef.current) {
        currentSentenceElementsRef.current = [];
        viewerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
        renditionRef.current.display(target.href);
      }
    }
  }, [currentChapterIndex, chapters]);

  // Paginated mode: a transparent layer in the parent document owns taps / swipes / long-press.
  // (Touch events inside the epub iframe are unreliable on iOS Safari.)
  const gestureRef = useRef<{ x: number; y: number; t: number; idx: number | null; long: boolean; timer?: number } | null>(null);
  const lastGestureAtRef = useRef<number>(0);

  const sentenceAtPoint = useCallback((clientX: number, clientY: number): number | null => {
    const frame = viewerRef.current?.querySelector('iframe');
    const doc = frame?.contentDocument;
    if (!frame || !doc) return null;
    const rect = frame.getBoundingClientRect();
    const el = doc.elementFromPoint(clientX - rect.left, clientY - rect.top) as HTMLElement | null;
    const hit = el?.closest?.('.tts-sentence') as HTMLElement | null;
    return hit ? Number(hit.dataset.ttsIdx) : null;
  }, []);

  const applyTap = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = viewerRef.current;
      if (!wrap) return;
      const ratio = (clientX - wrap.getBoundingClientRect().left) / (wrap.clientWidth || 1);
      if (ratio < 0.25) return void renditionRef.current?.prev();
      if (ratio > 0.75) return void renditionRef.current?.next();
      dispatchTap(sentenceAtPoint(clientX, clientY));
    },
    [sentenceAtPoint, dispatchTap]
  );

  const onGestureStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t || e.touches.length !== 1) return;
    const idx = sentenceAtPoint(t.clientX, t.clientY);
    const g = { x: t.clientX, y: t.clientY, t: Date.now(), idx, long: false } as NonNullable<typeof gestureRef.current>;
    if (idx !== null) {
      g.timer = window.setTimeout(() => {
        g.long = true;
        longPressRef.current?.(idx);
      }, 550);
    }
    gestureRef.current = g;
  };

  const onGestureMove = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    const t = e.touches[0];
    if (!g || !t) return;
    if (Math.abs(t.clientX - g.x) > 10 || Math.abs(t.clientY - g.y) > 10) window.clearTimeout(g.timer);
  };

  const onGestureEnd = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    const t = e.changedTouches[0];
    if (!g || !t) return;
    window.clearTimeout(g.timer);
    lastGestureAtRef.current = Date.now();
    if (g.long) return;
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) >= Math.abs(dy) * 1.5) {
      if (dx < 0) renditionRef.current?.next();
      else renditionRef.current?.prev();
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - g.t < 500) {
      applyTap(t.clientX, t.clientY);
    }
  };

  // First sentence whose top edge is on screen (used to start listening where the user is reading)
  const getFirstVisibleSentence = useCallback((): number => {
    const container = viewerRef.current;
    const iframe = container?.querySelector('iframe');
    if (!container || !iframe) return 0;
    const top = container.getBoundingClientRect().top;
    const offset = iframe.getBoundingClientRect().top;
    const elements = currentSentenceElementsRef.current;
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].getBoundingClientRect().top + offset >= top) return i;
    }
    return 0;
  }, []);

  // Register chapter controls with parent (App.tsx)
  useEffect(() => {
    if (registerChapterControls) {
      registerChapterControls({
        nextChapter: handleNextChapter,
        prevChapter: handlePrevChapter,
        getFirstVisibleSentence,
        currentChapterIndex,
        totalChapters: chapters.length,
      });
    }
  }, [registerChapterControls, handleNextChapter, handlePrevChapter, getFirstVisibleSentence, currentChapterIndex, chapters.length]);

  // Tag individual sentences inside DOM for 1:1 TTS highlight & Click-to-speak
  const tagAndExtractSentences = useCallback((doc: Document): string[] => {
    currentSentenceElementsRef.current = [];
    const elements: HTMLElement[] = [];
    const allSentences: string[] = [];

    // Target content block elements
    const blocks = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');

    blocks.forEach((block) => {
      if (block.querySelector('p, h1, h2, h3, h4, h5, h6, li, blockquote')) return;

      const rawText = block.textContent || '';
      if (!rawText.trim()) return;

      const sentences = splitTextIntoSentences(rawText);
      if (sentences.length === 0) return;

      block.innerHTML = '';
      sentences.forEach((sentenceText) => {
        const span = doc.createElement('span');
        const sentenceIndex = allSentences.length;
        span.className = 'tts-sentence';
        span.dataset.ttsIdx = `${sentenceIndex}`;
        span.textContent = `${sentenceText} `;

        block.appendChild(span);
        elements.push(span);
        allSentences.push(sentenceText);
      });
    });

    currentSentenceElementsRef.current = elements;
    return allSentences;
  }, []);

  // 1. Initialize EPUB Book & Rendition (Strict Single Chapter Isolation)
  useEffect(() => {
    if (!viewerRef.current || !book.fileBlob) return;

    let isMounted = true;
    let epubBook: EpubBook | null = null;
    let rendition: Rendition | null = null;

    const initBook = async () => {
      try {
        const arrayBuffer = await book.fileBlob.arrayBuffer();
        epubBook = (ePub as any)(arrayBuffer);
        epubBookRef.current = epubBook;

        if (!epubBook) return;

        await (epubBook as any).ready;
        if (!isMounted) return;

        // Load TOC navigation
        const nav = await epubBook.loaded.navigation;
        let loadedChapters: Chapter[] = [];
        if (nav?.toc) {
          const flatToc = (items: any[]): Chapter[] =>
            items.map((it, idx) => ({
              id: it.id || `toc-${idx}`,
              href: it.href,
              label: it.label?.trim() || `Chương ${idx + 1}`,
              subitems: it.subitems ? flatToc(it.subitems) : undefined,
            }));
          loadedChapters = flatToc(nav.toc);
          setChapters(loadedChapters);
        }

        // Load cached locations or generate and save to IndexedDB
        if (book.locationsData) {
          try {
            epubBook.locations.load(book.locationsData);
          } catch (e) {
            console.warn('Locations load error:', e);
          }
        } else {
          epubBook.locations.generate(1024).then(() => {
            const saved = epubBook?.locations.save();
            if (book.id && saved) {
              db.books.update(book.id, { locationsData: saved });
            }
          });
        }

        // Initialize Rendition
        const container = viewerRef.current;
        if (!container) return;

        // Clear previous render
        container.innerHTML = '';

        // MANDATORY OOM PREVENT RULE: manager MUST be 'default' to prevent section accumulation
        rendition = epubBook.renderTo(container, {
          width: '100%',
          height: '100%',
          flow: readingModeRef.current === 'continuous' ? 'scrolled-doc' : 'paginated',
          manager: 'default',
          spread: 'none',
        });
        renditionRef.current = rendition;

        // Theme registration with safety check
        try {
          rendition.themes.register('light', {
            body: {
              background: '#ffffff',
              color: '#1e293b',
              'font-family': fontFamily,
              'font-size': `${fontSize}px`,
              'line-height': `${lineHeight}`,
              padding: '20px 24px 56px',
              cursor: 'pointer',
              'touch-action': 'manipulation',
            },
            '.tts-active-sentence': {
              'background-color': 'rgba(250, 204, 21, 0.45) !important',
              'border-radius': '4px',
              'box-shadow': '0 0 0 2px rgba(250, 204, 21, 0.45) !important',
              transition: 'background-color 0.25s ease',
            },
            '.tts-sentence': {
              cursor: 'pointer',
              'touch-action': 'manipulation',
            },
          });

          rendition.themes.register('sepia', {
            body: {
              background: '#fbf0d9',
              color: '#5f4b32',
              'font-family': fontFamily,
              'font-size': `${fontSize}px`,
              'line-height': `${lineHeight}`,
              padding: '20px 24px 56px',
              cursor: 'pointer',
              'touch-action': 'manipulation',
            },
            '.tts-active-sentence': {
              'background-color': 'rgba(217, 119, 6, 0.35) !important',
              'border-radius': '4px',
              'box-shadow': '0 0 0 2px rgba(217, 119, 6, 0.35) !important',
              transition: 'background-color 0.25s ease',
            },
            '.tts-sentence': {
              cursor: 'pointer',
              'touch-action': 'manipulation',
            },
          });

          rendition.themes.register('dark', {
            body: {
              background: '#0f172a',
              color: '#cbd5e1',
              'font-family': fontFamily,
              'font-size': `${fontSize}px`,
              'line-height': `${lineHeight}`,
              padding: '20px 24px 56px',
              cursor: 'pointer',
              'touch-action': 'manipulation',
            },
            '.tts-active-sentence': {
              'background-color': 'rgba(234, 179, 8, 0.35) !important',
              'box-shadow': '0 0 0 2px rgba(234, 179, 8, 0.35) !important',
              color: '#fef08a !important',
              'border-radius': '4px',
              transition: 'background-color 0.25s ease',
            },
            '.tts-sentence': {
              cursor: 'pointer',
              'touch-action': 'manipulation',
            },
          });

          rendition.themes.select(theme);
        } catch (themeErr) {
          console.warn('Theme registration warning:', themeErr);
        }

        // Display at saved CFI or initial chapter
        // display() runs after the 'rendered' listener below is attached (see end of initBook)

        // Handle section/chapter rendered (Extract sentences of ONLY current chapter)
        rendition.on('rendered', (section: any, view: any) => {
          if (!view || !view.document) return;

          // Teardown previous chapter sentence elements to release memory
          currentSentenceElementsRef.current = [];

          const doc = view.document;
          const extractedSentences = tagAndExtractSentences(doc);

          // A freshly rendered chapter scrolls programmatically; do not mistake that for the user
          lastAutoScrollAtRef.current = Date.now();
          // epub.js may render the same document again (resize); bind listeners once per document
          const docAny = doc as Document & { __ttsBound?: boolean };
          if (!docAny.__ttsBound) {
            docAny.__ttsBound = true;
            doc.addEventListener('scroll', () => onUserScrollRef.current(), { passive: true });

            // Tap / long-press handling inside the chapter iframe
            const sentenceOf = (target: EventTarget | null): number | null => {
              const el = (target as HTMLElement | null)?.closest?.('.tts-sentence') as HTMLElement | null;
              return el ? Number(el.dataset.ttsIdx) : null;
            };
            let pressTimer: number | undefined;
            let longPressed = false;
            const clearPress = () => {
              if (pressTimer !== undefined) window.clearTimeout(pressTimer);
              pressTimer = undefined;
            };
            doc.addEventListener('touchstart', (e: TouchEvent) => {
              longPressed = false;
              const idx = sentenceOf(e.target);
              if (idx === null) return;
              pressTimer = window.setTimeout(() => {
                longPressed = true;
                longPressRef.current?.(idx);
              }, 550);
            }, { passive: true });
            doc.addEventListener('touchmove', clearPress, { passive: true });
            doc.addEventListener('touchend', clearPress, { passive: true });

            // iOS Safari zooms on double tap: swallow the second tap's default action
            let lastTouchEnd = 0;
            doc.addEventListener('touchend', (e: TouchEvent) => {
              const now = Date.now();
              if (now - lastTouchEnd < 320 && e.cancelable) e.preventDefault();
              lastTouchEnd = now;
            }, { passive: false });

            // Horizontal swipe flips pages in paginated mode (left = next, right = previous)
            let swipeStart: { x: number; y: number } | null = null;
            doc.addEventListener('touchstart', (e: TouchEvent) => {
              const t = e.touches[0];
              swipeStart = t ? { x: t.clientX, y: t.clientY } : null;
            }, { passive: true });
            doc.addEventListener('touchend', (e: TouchEvent) => {
              const start = swipeStart;
              swipeStart = null;
              const t = e.changedTouches[0];
              if (!start || !t || readingModeRef.current !== 'paginated' || !renditionRef.current) return;
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;
              if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
              longPressed = true; // swallow the synthetic click
              if (dx < 0) renditionRef.current.next();
              else renditionRef.current.prev();
            }, { passive: true });
            doc.addEventListener('keydown', (e: KeyboardEvent) => {
              if (readingModeRef.current !== 'paginated' || !renditionRef.current) return;
              if (e.key === 'ArrowRight') renditionRef.current.next();
              if (e.key === 'ArrowLeft') renditionRef.current.prev();
            });
            const handleTap = (clientX: number, target: EventTarget | null) => {
              if (doc.getSelection()?.toString()) return;
              if (readingModeRef.current === 'paginated' && renditionRef.current) {
                // In paginated flow the iframe spans every page; convert to coordinates of the visible page
                const wrap = viewerRef.current;
                const frame = wrap?.querySelector('iframe');
                if (wrap && frame) {
                  const x = clientX + frame.getBoundingClientRect().left - wrap.getBoundingClientRect().left;
                  const ratio = x / (wrap.clientWidth || 1);
                  if (ratio < 0.25) return void renditionRef.current.prev();
                  if (ratio > 0.75) return void renditionRef.current.next();
                }
              }
              dispatchTap(sentenceOf(target));
            };

            // iOS Safari only fires click on "clickable" elements, so also detect taps from touch events
            let touchTap: { x: number; y: number; t: number } | null = null;
            let lastTouchTapAt = 0;
            doc.addEventListener('touchstart', (e: TouchEvent) => {
              const t = e.touches[0];
              touchTap = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
            }, { passive: true });
            doc.addEventListener('touchend', (e: TouchEvent) => {
              const start = touchTap;
              touchTap = null;
              const t = e.changedTouches[0];
              if (!start || !t || longPressed) return;
              if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) return;
              if (Date.now() - start.t > 500) return;
              lastTouchTapAt = Date.now();
              handleTap(t.clientX, e.target);
            }, { passive: true });

            doc.addEventListener('click', (e: MouseEvent) => {
              if (Date.now() - lastTouchTapAt < 700) return; // already handled via touch
              if (longPressed) {
                longPressed = false;
                return;
              }
              handleTap(e.clientX, e.target);
            });
          }

          // Same chapter rendered again (resize, mini-player docking, rotation): keep the spoken sentence
          const sameChapter = !!section?.href && currentHrefRef.current === section.href;
          if (section?.href) currentHrefRef.current = section.href;
          const keepIndex = keepSentenceRef.current ?? (sameChapter ? sentenceIdxRef.current : undefined);
          keepSentenceRef.current = null;
          onSentencesReady(extractedSentences, keepIndex);
          setRenderTick((t) => t + 1);

          // Identify matching chapter index
          const foundIdx = loadedChapters.findIndex(
            (c) => section?.href && (section.href.includes(c.href) || c.href.includes(section.href))
          );
          const effectiveIdx = foundIdx !== -1 ? foundIdx : (section?.index ?? 0);
          setCurrentChapterIndex(effectiveIdx);

          const label =
            (foundIdx !== -1 && loadedChapters[foundIdx]?.label) ||
            `Chương ${effectiveIdx + 1}`;
          setCurrentChapterTitle(label);

          if (onChapterChanged) {
            onChapterChanged(label, effectiveIdx, loadedChapters.length);
          }
        });

        // Track reading location & progress
        rendition.on('relocated', (location: any) => {
          if (!location || !location.start) return;
          const cfi = location.start.cfi;
          let progress = book.progressPercent || 0;

          if (epubBook && epubBook.locations && (epubBook.locations as any).total) {
            progress = Math.min(100, Math.round(epubBook.locations.percentageFromCfi(cfi) * 100));
          }

          if (book.id) {
            db.books.update(book.id, {
              currentCfi: cfi,
              progressPercent: progress,
              lastReadAt: new Date(),
            });
          }
        });
        const startDisplay = async () => {
          const resume = book as BookWithResume;
          if (resume.resumeHref && typeof resume.resumeSentence === 'number') {
            keepSentenceRef.current = resume.resumeSentence;
            resumeScrollRef.current = resume.resumeSentence;
            try {
              await renditionRef.current?.display(resume.resumeHref);
            } catch {
              keepSentenceRef.current = null;
              resumeScrollRef.current = null;
              await renditionRef.current?.display(book.currentCfi || undefined);
            }
          } else {
            await renditionRef.current?.display(book.currentCfi || undefined);
          }
        };
        await startDisplay();
      } catch (err) {
        console.error('Error rendering book:', err);
        message.error('Lỗi khi nạp sách. Vui lòng thử lại!');
      }
    };

    initBook();

    return () => {
      isMounted = false;
      currentSentenceElementsRef.current = [];
      if (rendition) {
        try {
          rendition.destroy();
        } catch (_e) {}
      }
      if (epubBook) {
        try {
          epubBook.destroy();
        } catch (_e) {}
      }
    };
  }, [book]);

  // Switch scroll/page mode on the live rendition (no re-init); keep chapter position and active sentence
  const appliedModeRef = useRef(readingMode);
  useEffect(() => {
    if (appliedModeRef.current === readingMode) return;
    appliedModeRef.current = readingMode;
    const rendition = renditionRef.current;
    if (!rendition) return;
    const cfi = (rendition.currentLocation() as any)?.start?.cfi as string | undefined;
    keepSentenceRef.current = sentenceIdxRef.current;
    rendition.flow(readingMode === 'continuous' ? 'scrolled-doc' : 'paginated');
    rendition.display(cfi || undefined);
  }, [readingMode]);

  // Auto-follow: stays on while the user does not scroll by hand; a manual scroll pauses it
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const lastAutoScrollAtRef = useRef<number>(0);

  // Bring the active sentence into the comfortable band of the *visible* area (minus mini-player)
  const scrollToCurrent = useCallback(
    (force: boolean) => {
      const container = viewerRef.current;
      const iframe = container?.querySelector('iframe');
      const target = currentSentenceElementsRef.current[currentSentenceIndex];
      if (!container || !iframe || !target) return;

      if (readingModeRef.current === 'paginated') {
        // The iframe spans every page; flip to the page that holds the active sentence
        const wrap = (container.querySelector('.epub-container') as HTMLElement | null) || container;
        const docLeft = target.getBoundingClientRect().left;
        const viewLeft = docLeft + iframe.getBoundingClientRect().left - wrap.getBoundingClientRect().left;
        if (!force && viewLeft >= 0 && viewLeft < wrap.clientWidth) return;
        const delta = (renditionRef.current as any)?.manager?.layout?.delta || wrap.clientWidth;
        lastAutoScrollAtRef.current = Date.now();
        wrap.scrollTo({ left: Math.floor(docLeft / delta) * delta, behavior: 'auto' });
        return;
      }

      // The scroller is either our wrapper (tall iframe) or the chapter document inside the iframe
      const doc = iframe.contentDocument;
      const innerScroller = doc?.scrollingElement as HTMLElement | null | undefined;
      // epub.js scrolled flow scrolls one of the wrappers; otherwise the chapter document itself scrolls
      let scroller: HTMLElement | null | undefined = null;
      for (let el: HTMLElement | null = iframe.parentElement; el; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
          scroller = el;
          break;
        }
        if (el === container) break;
      }
      scroller = scroller || innerScroller;
      if (!scroller) return;

      const containerRect = container.getBoundingClientRect();
      const visibleH = Math.max(120, container.clientHeight);
      const elTop = target.getBoundingClientRect().top + iframe.getBoundingClientRect().top - containerRect.top;
      const inBand = elTop >= visibleH * 0.1 && elTop <= visibleH * 0.65;
      if (inBand && !force) return;

      lastAutoScrollAtRef.current = Date.now();
      scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + elTop - visibleH * 0.38), behavior: 'auto' });
    },
    [currentSentenceIndex]
  );

  // Highlight active sentence & follow it (skipped while the page is hidden / screen locked)
  useEffect(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const iframe = viewerRef.current?.querySelector('iframe');
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!doc) return;

    doc.querySelectorAll('.tts-active-sentence').forEach((el) => {
      el.classList.remove('tts-active-sentence');
    });

    const target = currentSentenceElementsRef.current[currentSentenceIndex];
    if (!target) return;
    if (resumeScrollRef.current !== null && resumeScrollRef.current === currentSentenceIndex) {
      resumeScrollRef.current = null;
      scrollToCurrent(true);
      return;
    }
    if (highlightSentence && playerActive) target.classList.add('tts-active-sentence');
    if (autoScroll && autoFollow && playerActive) scrollToCurrent(false);
  }, [currentSentenceIndex, highlightSentence, autoScroll, autoFollow, playerActive, scrollToCurrent, renderTick]);

  // While listening, remember the spoken sentence; while reading, remember the first visible one
  useEffect(() => {
    if (playerActive) saveResume(currentSentenceIndex);
  }, [playerActive, currentSentenceIndex, saveResume]);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;
    let timer: number | undefined;
    const onScroll = () => {
      if (playerActiveRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => saveResume(getFirstVisibleSentence()), 500);
    };
    container.addEventListener('scroll', onScroll, { passive: true, capture: true });
    const onHide = () => flushResume();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      container.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      window.clearTimeout(timer);
      flushResume();
    };
  }, [saveResume, flushResume, getFirstVisibleSentence]);

  // Resync highlight/scroll once the page becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) setRenderTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Re-layout the book when its box changes (mini-player docks, iOS toolbar collapses, rotation)
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let timer: number | undefined;
    let last = `${el.clientWidth}x${el.clientHeight}`;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const size = `${el.clientWidth}x${el.clientHeight}`;
        if (size === last) return;
        last = size;
        try {
          renditionRef.current?.resize(el.clientWidth, el.clientHeight);
        } catch {}
      }, 150);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  // Manual scroll while listening pauses auto-follow (wrapper scroll + scroll inside the chapter iframe)
  const onUserScrollRef = useRef<() => void>(() => {});
  useEffect(() => {
    onUserScrollRef.current = () => {
      if (Date.now() - lastAutoScrollAtRef.current < 600) return;
      setAutoFollow(false);
    };
  });
  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;
    const onScroll = () => onUserScrollRef.current();
    // capture: scroll events do not bubble, but epub.js scrolls an inner wrapper
    container.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => container.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  // Listening starts, or a new chapter is loaded: follow again
  useEffect(() => {
    setAutoFollow(true);
  }, [playerActive, currentChapterIndex]);

  // Update theme dynamically
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    try {
      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontSize}px`);
      rendition.themes.override('line-height', `${lineHeight}`);
      rendition.themes.override('font-family', fontFamily);
    } catch (_e) {}
  }, [theme, fontSize, lineHeight, fontFamily]);

  // Navigation to a specific chapter from TOC
  const handleSelectChapter = (href: string, index: number) => {
    if (renditionRef.current) {
      currentSentenceElementsRef.current = [];
      viewerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      renditionRef.current.display(href);
      setCurrentChapterIndex(index);
      setIsTocOpen(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top chapter bar (overlay, shown with the chrome) */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(56px + var(--sat, 0px))',
          left: 0,
          right: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: barBg,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          gap: 8,
          transform: chromeVisible ? 'translateY(0)' : 'translateY(-200%)',
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? 'auto' : 'none',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
        }}
      >
        <Button
          type="text"
          size="middle"
          icon={<UnorderedListOutlined />}
          onClick={() => setIsTocOpen(true)}
        >
          Mục lục
        </Button>
        <Text strong style={{ fontSize: 13, flex: 1, textAlign: 'center' }} ellipsis>
          {currentChapterTitle}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {currentChapterIndex + 1}/{chapters.length || 1}
        </Text>
      </div>

      {/* Main EPUB container */}
      <div
        ref={viewerRef}
        className="epub-viewer-wrapper"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      />

      {playerActive && !autoFollow && (
        <Button
          type="primary"
          shape="round"
          size="middle"
          icon={<AimOutlined />}
          onClick={() => {
            setAutoFollow(true);
            scrollToCurrent(true);
          }}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 'calc(var(--sab, 0px) + 16px)',
            zIndex: 45,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          Về câu đang đọc
        </Button>
      )}

      {readingMode === 'paginated' && (
        <div
          aria-hidden="true"
          onTouchStart={onGestureStart}
          onTouchMove={onGestureMove}
          onTouchEnd={onGestureEnd}
          onClick={(e) => {
            if (Date.now() - lastGestureAtRef.current < 700) return;
            applyTap(e.clientX, e.clientY);
          }}
          style={{ position: 'absolute', inset: 0, zIndex: 20, cursor: 'pointer', touchAction: 'none' }}
        />
      )}

      {/* Reading progress hairline (always visible) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 3,
          width: `${chapters.length > 1 ? ((currentChapterIndex + 1) / chapters.length) * 100 : 0}%`,
          background: '#1677ff',
          zIndex: 30,
          transition: 'width 0.3s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom bar (overlay, shown with the chrome while not listening) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          padding: '10px 16px',
          paddingBottom: 'calc(var(--sab, 0px) + 10px)',
          background: barBg,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          transform: chromeVisible && !playerActive ? 'translateY(0)' : 'translateY(200%)',
          opacity: chromeVisible && !playerActive ? 1 : 0,
          pointerEvents: chromeVisible && !playerActive ? 'auto' : 'none',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
        }}
      >
        <Button
          size="large"
          icon={<LeftOutlined />}
          disabled={currentChapterIndex <= 0}
          onClick={handlePrevChapter}
          aria-label="Chương trước"
        />
        <Button
          type="primary"
          size="large"
          icon={<CustomerServiceOutlined />}
          onClick={() => onStartListen?.(getFirstVisibleSentence())}
          style={{ flex: 1, height: 48, borderRadius: 24 }}
        >
          Nghe
        </Button>
        <Button
          size="large"
          icon={<RightOutlined />}
          disabled={currentChapterIndex >= chapters.length - 1}
          onClick={handleNextChapter}
          aria-label="Chương sau"
        />
      </div>

      {/* Table of Contents bottom sheet with fast search & virtualized list */}
      <Drawer
        title={
          <Space>
            <BookOutlined style={{ color: '#1677ff' }} />
            <span>Mục lục ({chapters.length} chương)</span>
          </Space>
        }
        placement="bottom"
        onClose={() => {
          setIsTocOpen(false);
          setTocSearch('');
        }}
        open={isTocOpen}
        size="90dvh"
        destroyOnHidden
        styles={{
          body: { padding: '12px 16px', paddingBottom: 'calc(var(--sab, 0px) + 12px)', display: 'flex', flexDirection: 'column' },
        }}
      >
        <Input.Search
          placeholder="Tìm theo số (vd: 500) hoặc tên..."
          allowClear
          value={tocSearch}
          onChange={(e) => setTocSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {filteredChapters.length < chapters.length
              ? `Tìm thấy ${filteredChapters.length} / ${chapters.length} chương`
              : `Tổng cộng ${chapters.length} chương`}
          </Text>
          <Button
            type="link"
            size="small"
            icon={<AimOutlined />}
            onClick={() => {
              setTocSearch('');
              window.setTimeout(scrollTocToCurrent, 50);
            }}
            style={{ padding: 0, fontSize: 12 }}
          >
            Đang đọc ({currentChapterIndex + 1})
          </Button>
        </div>
        <div
          ref={tocListRef}
          onScroll={(e) => setTocScrollTop(e.currentTarget.scrollTop)}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative', WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ height: filteredChapters.length * TOC_ROW_H, position: 'relative' }}>
            {filteredChapters
              .slice(
                Math.max(0, Math.floor(tocScrollTop / TOC_ROW_H) - 6),
                Math.ceil((tocScrollTop + tocListH) / TOC_ROW_H) + 6
              )
              .map(({ c, idx }, k) => {
                const row = Math.max(0, Math.floor(tocScrollTop / TOC_ROW_H) - 6) + k;
                const isCurrent = idx === currentChapterIndex;
                return (
                  <div
                    key={c.id + idx}
                    onClick={() => handleSelectChapter(c.href, idx)}
                    style={{
                      position: 'absolute',
                      top: row * TOC_ROW_H,
                      left: 0,
                      right: 0,
                      height: TOC_ROW_H - 4,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isCurrent ? 'rgba(22, 119, 255, 0.1)' : 'transparent',
                      border: isCurrent ? '1px solid rgba(22, 119, 255, 0.3)' : '1px solid transparent',
                    }}
                  >
                    <Text strong={isCurrent} ellipsis style={{ color: isCurrent ? '#1677ff' : 'inherit', fontSize: 14 }}>
                      {`${idx + 1}. ${c.label}`}
                    </Text>
                  </div>
                );
              })}
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export const ReaderView = React.memo(ReaderViewImpl);
