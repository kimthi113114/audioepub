import ePub from 'epubjs';
import type { Chapter } from '../types';

export interface ParsedEpubMetadata {
  title: string;
  author: string;
  coverUrl?: string;
  chapters: Chapter[];
  totalChapters: number;
}

export async function parseEpubFile(file: File | Blob): Promise<ParsedEpubMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const book = (ePub as any)(arrayBuffer);

  try {
    await book.ready;

    // 1. Metadata
    const metadata = await book.loaded.metadata;
    const title = metadata.title || (file instanceof File ? file.name.replace(/\.epub$/i, '') : 'Sách chưa đặt tên');
    const author = metadata.creator || 'Chưa rõ tác giả';

    // 2. Cover image
    let coverUrl: string | undefined;
    try {
      const rawCoverUrl = await book.coverUrl();
      if (rawCoverUrl) {
        // Fetch cover image blob and convert to Base64 data URL so it persists offline in DB
        const res = await fetch(rawCoverUrl);
        const blob = await res.blob();
        coverUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.warn('Could not extract cover image:', err);
    }

    // 3. Navigation / TOC
    const nav = await book.loaded.navigation;
    const flattenToc = (items: any[]): Chapter[] => {
      return items.map((item, index) => ({
        id: item.id || `chapter-${index}`,
        href: item.href,
        label: item.label ? item.label.trim() : `Chương ${index + 1}`,
        subitems: item.subitems && item.subitems.length ? flattenToc(item.subitems) : undefined,
      }));
    };

    const chapters = nav?.toc ? flattenToc(nav.toc) : [];

    return {
      title,
      author,
      coverUrl,
      chapters,
      totalChapters: chapters.length,
    };
  } finally {
    if (book) {
      try {
        book.destroy();
      } catch (e) {}
    }
  }
}

/**
 * Tách nội dung thành các câu để đọc TTS mượt mà và đồng bộ highlight.
 * Hỗ trợ tiếng Việt và các quy tắc ngắt câu chuẩn.
 */
export function splitTextIntoSentences(text: string): string[] {
  if (!text) return [];

  // Chuẩn hóa khoảng trắng và ngắt dòng
  const clean = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  // Tách theo các dấu kết thúc câu: . ! ? … hoặc xuống dòng
  // Giữ lại dấu câu ở cuối mỗi câu
  const regex = /[^.!?…\n]+[.!?…\n]+|[^.!?…\n]+$/g;
  const matches = clean.match(regex);

  if (!matches) return [clean];

  return matches
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^[\d\W]+$/.test(s)); // bỏ qua chuỗi chỉ có số hoặc ký tự đặc biệt
}
