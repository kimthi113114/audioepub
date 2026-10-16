import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ePub, { type Book as EpubBook, type Rendition } from 'epubjs';
import { Button, Drawer, List, Typography, Space, Tooltip, Input, message } from 'antd';
import {
  UnorderedListOutlined,
  LeftOutlined,
  RightOutlined,
  BookOutlined,
  AimOutlined,
} from '@ant-design/icons';
import type { Book, Chapter } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';
import { splitTextIntoSentences } from '../utils/epubHelper';
import { db } from '../db';

const { Text } = Typography;

export interface ChapterControls {
  nextChapter: () => void;
  prevChapter: () => void;
  currentChapterIndex: number;
  totalChapters: number;
}

interface ReaderViewProps {
  book: Book;
  currentSentenceIndex: number;
  onSentencesReady: (sentences: string[]) => void;
  onChapterChanged?: (title: string, index: number, total: number) => void;
  onSentenceClick?: (index: number) => void;
  registerChapterControls?: (controls: ChapterControls) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  currentSentenceIndex,
  onSentencesReady,
  onChapterChanged,
  onSentenceClick,
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
    if (!tocSearch.trim()) return chapters;
    const q = normalizeStr(tocSearch.trim());
    return chapters.filter((c, idx) => {
      const numMatch = `${idx + 1}`.includes(q);
      const titleMatch = normalizeStr(c.label).includes(q);
      return numMatch || titleMatch;
    });
  }, [chapters, tocSearch]);

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

  // Register chapter controls with parent (App.tsx)
  useEffect(() => {
    if (registerChapterControls) {
      registerChapterControls({
        nextChapter: handleNextChapter,
        prevChapter: handlePrevChapter,
        currentChapterIndex,
        totalChapters: chapters.length,
      });
    }
  }, [registerChapterControls, handleNextChapter, handlePrevChapter, currentChapterIndex, chapters.length]);

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

        // Click-to-Speak handler
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onSentenceClick) {
            onSentenceClick(sentenceIndex);
          }
        });

        block.appendChild(span);
        elements.push(span);
        allSentences.push(sentenceText);
      });
    });

    currentSentenceElementsRef.current = elements;
    return allSentences;
  }, [onSentenceClick]);

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
          flow: readingMode === 'continuous' ? 'scrolled-doc' : 'paginated',
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
              padding: '20px 24px 40px',
            },
            '.tts-active-sentence': {
              'background-color': 'rgba(250, 204, 21, 0.45) !important',
              'border-radius': '4px',
              'box-shadow': '0 0 0 2px rgba(250, 204, 21, 0.45) !important',
              transition: 'background-color 0.25s ease',
            },
            '.tts-sentence': {
              cursor: 'pointer',
            },
          });

          rendition.themes.register('sepia', {
            body: {
              background: '#fbf0d9',
              color: '#5f4b32',
              'font-family': fontFamily,
              'font-size': `${fontSize}px`,
              'line-height': `${lineHeight}`,
              padding: '20px 24px 40px',
            },
            '.tts-active-sentence': {
              'background-color': 'rgba(217, 119, 6, 0.35) !important',
              'border-radius': '4px',
              'box-shadow': '0 0 0 2px rgba(217, 119, 6, 0.35) !important',
              transition: 'background-color 0.25s ease',
            },
            '.tts-sentence': {
              cursor: 'pointer',
            },
          });

          rendition.themes.register('dark', {
            body: {
              background: '#0f172a',
              color: '#cbd5e1',
              'font-family': fontFamily,
              'font-size': `${fontSize}px`,
              'line-height': `${lineHeight}`,
              padding: '20px 24px 40px',
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
            },
          });

          rendition.themes.select(theme);
        } catch (themeErr) {
          console.warn('Theme registration warning:', themeErr);
        }

        // Display at saved CFI or initial chapter
        await rendition.display(book.currentCfi || undefined);

        // Handle section/chapter rendered (Extract sentences of ONLY current chapter)
        rendition.on('rendered', (section: any, view: any) => {
          if (!view || !view.document) return;

          // Teardown previous chapter sentence elements to release memory
          currentSentenceElementsRef.current = [];

          const doc = view.document;
          const extractedSentences = tagAndExtractSentences(doc);
          onSentencesReady(extractedSentences);

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
  }, [book, readingMode]);

  // Highlight active sentence & auto-scroll
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const iframe = viewerRef.current?.querySelector('iframe');
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!doc) return;

    doc.querySelectorAll('.tts-active-sentence').forEach((el) => {
      el.classList.remove('tts-active-sentence');
    });

    const elements = currentSentenceElementsRef.current;
    if (elements && elements[currentSentenceIndex]) {
      const target = elements[currentSentenceIndex];

      if (highlightSentence) {
        target.classList.add('tts-active-sentence');
      }

      if (autoScroll) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentSentenceIndex, autoScroll, highlightSentence]);

  // Update theme dynamically
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    try {
      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontSize}px`);
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

  const handleNextPage = () => {
    if (renditionRef.current) {
      renditionRef.current.next();
    }
  };

  const handlePrevPage = () => {
    if (renditionRef.current) {
      renditionRef.current.prev();
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
      {/* Chapter Sub-header Bar with Quick Chapter Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.02)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <Space size={6} style={{ minWidth: 0, flex: 1 }}>
          <Button
            type="text"
            size="small"
            icon={<UnorderedListOutlined />}
            onClick={() => setIsTocOpen(true)}
          >
            Mục lục
          </Button>
          <Text strong style={{ fontSize: 13 }} ellipsis>
            {currentChapterTitle}
          </Text>
        </Space>

        <Space size={2} style={{ flexShrink: 0 }}>
          <Tooltip title="Chương trước">
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              disabled={currentChapterIndex <= 0}
              onClick={handlePrevChapter}
            />
          </Tooltip>
          <Text type="secondary" style={{ fontSize: 12, padding: '0 4px' }}>
            {currentChapterIndex + 1}/{chapters.length || 1}
          </Text>
          <Tooltip title="Chương sau">
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              disabled={currentChapterIndex >= chapters.length - 1}
              onClick={handleNextChapter}
            />
          </Tooltip>

          {readingMode === 'paginated' && (
            <>
              <span style={{ color: 'rgba(0,0,0,0.15)', margin: '0 2px' }}>|</span>
              <Tooltip title="Trang trước">
                <Button
                  type="text"
                  size="small"
                  icon={<LeftOutlined />}
                  onClick={handlePrevPage}
                />
              </Tooltip>
              <Tooltip title="Trang sau">
                <Button
                  type="text"
                  size="small"
                  icon={<RightOutlined />}
                  onClick={handleNextPage}
                />
              </Tooltip>
            </>
          )}
        </Space>
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

      {/* Bottom Chapter Navigation Bar (OOM Prevention UX: explicit chapter boundaries) */}
      <div
        className="chapter-bottom-nav"
        style={{
          padding: '8px 16px',
          background: theme === 'dark' ? '#141414' : '#fafafa',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 10,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <Button
          icon={<LeftOutlined />}
          disabled={currentChapterIndex <= 0}
          onClick={handlePrevChapter}
          size="middle"
        >
          Chương trước
        </Button>

        <div style={{ textAlign: 'center', maxWidth: '50%' }}>
          <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>
            Chương {currentChapterIndex + 1} / {chapters.length || 1}
          </Text>
        </div>

        <Button
          type="primary"
          icon={<RightOutlined />}
          disabled={currentChapterIndex >= chapters.length - 1}
          onClick={handleNextChapter}
          size="middle"
        >
          Chương sau
        </Button>
      </div>

      {/* Table of Contents Drawer with Fast Search & Jump (1000 chapters support) */}
      <Drawer
        title={
          <Space>
            <BookOutlined style={{ color: '#1677ff' }} />
            <span>Mục lục ({chapters.length} chương)</span>
          </Space>
        }
        placement="left"
        onClose={() => setIsTocOpen(false)}
        open={isTocOpen}
        width={340}
        styles={{ body: { padding: '12px 16px', display: 'flex', flexDirection: 'column' } }}
      >
        <Input.Search
          placeholder="Tìm theo số (vd: 500) hoặc tên..."
          allowClear
          value={tocSearch}
          onChange={(e) => setTocSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            flexShrink: 0,
          }}
        >
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
              setTimeout(() => {
                const el = document.getElementById(`toc-item-${currentChapterIndex}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
            style={{ padding: 0, fontSize: 12 }}
          >
            Đang đọc ({currentChapterIndex + 1})
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <List
            dataSource={filteredChapters.slice(0, 300)}
            renderItem={(chapter) => {
              const originalIndex = chapters.findIndex(
                (c) => c.id === chapter.id || c.href === chapter.href
              );
              const isCurrent = originalIndex === currentChapterIndex;
              return (
                <List.Item
                  id={`toc-item-${originalIndex}`}
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 6,
                    marginBottom: 4,
                    background: isCurrent ? 'rgba(22, 119, 255, 0.1)' : 'transparent',
                    border: isCurrent
                      ? '1px solid rgba(22, 119, 255, 0.3)'
                      : '1px solid transparent',
                  }}
                  onClick={() => handleSelectChapter(chapter.href, originalIndex)}
                >
                  <Text
                    strong={isCurrent}
                    style={{
                      color: isCurrent ? '#1677ff' : 'inherit',
                      fontSize: 13,
                    }}
                  >
                    {`${originalIndex + 1}. ${chapter.label}`}
                  </Text>
                </List.Item>
              );
            }}
          />
        </div>
      </Drawer>
    </div>
  );
};
