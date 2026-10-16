import React, { useEffect, useRef, useState } from 'react';
import ePub, { type Book as EpubBook, type Rendition } from 'epubjs';
import { Button, Drawer, List, Typography, Space, Tooltip, message } from 'antd';
import {
  UnorderedListOutlined,
  LeftOutlined,
  RightOutlined,
  BookOutlined,
} from '@ant-design/icons';
import type { Book, Chapter } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';
import { splitTextIntoSentences } from '../utils/epubHelper';
import { db } from '../db';

const { Text } = Typography;

interface ReaderViewProps {
  book: Book;
  currentSentenceIndex: number;
  onSentencesReady: (sentences: string[]) => void;
  onChapterChanged?: (title: string) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  currentSentenceIndex,
  onSentencesReady,
  onChapterChanged,
}) => {
  const { theme, fontSize, lineHeight, fontFamily, readingMode } = useSettingsStore();

  const viewerRef = useRef<HTMLDivElement>(null);
  const epubBookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterTitle, setCurrentChapterTitle] = useState<string>('Đang mở sách...');
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);

  // References to rendered sentence elements for DOM highlighting
  const currentSentenceElementsRef = useRef<HTMLElement[]>([]);

  // 1. Initialize EPUB Book & Rendition
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
        if (nav?.toc) {
          const flatToc = (items: any[]): Chapter[] =>
            items.map((it, idx) => ({
              id: it.id || `toc-${idx}`,
              href: it.href,
              label: it.label?.trim() || `Chương ${idx + 1}`,
              subitems: it.subitems ? flatToc(it.subitems) : undefined,
            }));
          setChapters(flatToc(nav.toc));
        }

        // Generate locations for progress tracking
        epubBook.locations.generate(1024).then(() => {
          console.log('Book locations generated');
        });

        // Initialize Rendition
        const container = viewerRef.current;
        if (!container) return;

        // Clear previous render
        container.innerHTML = '';

        rendition = epubBook.renderTo(container, {
          width: '100%',
          height: '100%',
          flow: readingMode === 'continuous' ? 'scrolled-doc' : 'paginated',
          manager: readingMode === 'continuous' ? 'continuous' : 'default',
          spread: 'none',
        });
        renditionRef.current = rendition;

        // Register themes
        rendition.themes.register('light', {
          body: {
            background: '#ffffff',
            color: '#1e293b',
            'font-family': fontFamily,
            'font-size': `${fontSize}px`,
            'line-height': `${lineHeight}`,
            padding: '20px 24px 80px',
          },
        });

        rendition.themes.register('sepia', {
          body: {
            background: '#fbf0d9',
            color: '#5f4b32',
            'font-family': fontFamily,
            'font-size': `${fontSize}px`,
            'line-height': `${lineHeight}`,
            padding: '20px 24px 80px',
          },
        });

        rendition.themes.register('dark', {
          body: {
            background: '#0f172a',
            color: '#cbd5e1',
            'font-family': fontFamily,
            'font-size': `${fontSize}px`,
            'line-height': `${lineHeight}`,
            padding: '20px 24px 80px',
          },
        });

        rendition.themes.select(theme);

        // Display at saved CFI or start
        await rendition.display(book.currentCfi || undefined);

        // Handle section/chapter rendered
        rendition.on('rendered', (section: any, view: any) => {
          if (!view || !view.document) return;

          // Extract text and split sentences for TTS
          const doc = view.document;
          const bodyText = doc.body.innerText || '';
          const sentences = splitTextIntoSentences(bodyText);

          // Tag text nodes / sentences for highlight
          tagSentencesInDoc(doc);

          onSentencesReady(sentences);

          // Get chapter title
          const matchedChapter = nav?.toc?.find((c: any) => c.href.includes(section?.href));
          const label = matchedChapter?.label?.trim() || `Chương ${section?.index + 1}`;
          setCurrentChapterTitle(label);
          if (onChapterChanged) {
            onChapterChanged(label);
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
      if (rendition) {
        try {
          rendition.destroy();
        } catch (e) {}
      }
      if (epubBook) {
        try {
          epubBook.destroy();
        } catch (e) {}
      }
    };
  }, [book, readingMode]);

  // 2. Wrap text nodes into spans for sentence highlighting
  const tagSentencesInDoc = (doc: Document) => {
    currentSentenceElementsRef.current = [];

    // Store references for fast highlighting
    const spans: HTMLElement[] = [];
    const paragraphs = doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6');

    paragraphs.forEach((p, pIndex) => {
      const text = p.textContent || '';
      if (!text.trim()) return;

      // Wrap whole paragraph or inner parts
      (p as HTMLElement).dataset.ttsIndex = `${pIndex}`;
      spans.push(p as HTMLElement);
    });

    currentSentenceElementsRef.current = spans;
  };

  // 3. Highlight active sentence & auto-scroll
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    // Remove previous highlights
    const iframe = viewerRef.current?.querySelector('iframe');
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!doc) return;

    doc.querySelectorAll('.tts-active-sentence').forEach((el) => {
      el.classList.remove('tts-active-sentence');
    });

    // Find and highlight matching paragraph/element
    const elements = currentSentenceElementsRef.current;
    if (elements && elements[currentSentenceIndex]) {
      const target = elements[currentSentenceIndex];
      target.classList.add('tts-active-sentence');

      // Auto scroll target into view
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex]);

  // 4. Update font size, theme, line height dynamically
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    rendition.themes.select(theme);
    rendition.themes.fontSize(`${fontSize}px`);
  }, [theme, fontSize, lineHeight, fontFamily]);

  // 5. Navigate to Chapter
  const handleSelectChapter = (href: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(href);
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
        height: 'calc(100dvh - 56px - 72px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Chapter Sub-header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          background: 'rgba(0,0,0,0.02)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <Space size={8}>
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

        {readingMode === 'paginated' && (
          <Space size={4}>
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
          </Space>
        )}
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

      {/* Table of Contents Drawer */}
      <Drawer
        title={
          <Space>
            <BookOutlined style={{ color: '#1677ff' }} />
            <span>Mục lục cuốn sách</span>
          </Space>
        }
        placement="left"
        onClose={() => setIsTocOpen(false)}
        open={isTocOpen}
        width={320}
      >
        <List
          dataSource={chapters}
          renderItem={(chapter, idx) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 6,
                background:
                  chapter.label === currentChapterTitle ? 'rgba(22, 119, 255, 0.08)' : 'transparent',
              }}
              onClick={() => handleSelectChapter(chapter.href)}
            >
              <Text
                strong={chapter.label === currentChapterTitle}
                style={{
                  color: chapter.label === currentChapterTitle ? '#1677ff' : 'inherit',
                  fontSize: 14,
                }}
              >
                {`${idx + 1}. ${chapter.label}`}
              </Text>
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
};
