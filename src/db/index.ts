import Dexie, { type Table } from 'dexie';
import type { Book, Bookmark } from '../types';

/** Where the reader stopped inside a chapter (survives refresh). */
export type BookWithResume = Book & { resumeHref?: string; resumeSentence?: number };

export class AudioEpubDatabase extends Dexie {
  books!: Table<BookWithResume, number>;
  bookmarks!: Table<Bookmark, number>;

  constructor() {
    super('AudioEpubDB');
    this.version(1).stores({
      books: '++id, title, author, addedAt, lastReadAt',
      bookmarks: '++id, bookId, cfi, createdAt',
    });
  }
}

export const db = new AudioEpubDatabase();
