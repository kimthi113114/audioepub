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
 * Tự động loại bỏ các đoạn chỉ chứa ký tự đặc biệt, dấu ba chấm "...", "---", "***".
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

  // Câu đọc hợp lệ bắt buộc phải chứa ít nhất 1 chữ cái hoặc chữ số.
  // Loại bỏ hoàn toàn các dòng ngắt cảnh như: "...", "…", "---", "* * *", "~~~"
  const hasSpokenContent = (s: string) => /[\p{L}\p{N}]/u.test(s);

  if (!matches) {
    return hasSpokenContent(clean) ? [clean] : [];
  }

  return matches
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && hasSpokenContent(s));
}

/**
 * Chuẩn hóa câu trước khi gửi vào bộ đọc TTS (đặc biệt là VieNeu / Edge-TTS / Kokoro):
 * - Chuyển dấu ba chấm "..." hoặc "…" ở cuối câu thành dấu chấm "." để ngắt hơi tự nhiên
 * - Chuyển dấu ba chấm "..." hoặc "…" ở giữa câu thành dấu phẩy ", " để nghỉ nhịp tự nhiên
 * - Tránh việc AI đọc thành tiếng "chấm chấm chấm" hoặc tạo tiếng khựng glitch
 */
export function normalizeSentenceForTTS(text: string): string {
  if (!text) return '';
  let s = text.trim();
  // 1. Dấu ba chấm hoặc … ở cuối câu -> dấu chấm
  s = s.replace(/[.…]{2,}$/u, '.');
  s = s.replace(/…$/u, '.');
  // 2. Dấu ba chấm hoặc … ở giữa câu -> dấu phẩy với khoảng nghỉ
  s = s.replace(/\s*[.…]{2,}\s*/gu, ', ');
  s = s.replace(/\s*…\s*/gu, ', ');
  // 3. Dọn dẹp dấu trùng lặp
  s = s.replace(/,\s*,+/g, ',');
  s = s.replace(/\.\s*\.+/g, '.');
  return s.trim();
}
