import Dexie, { type Table } from 'dexie';
import type { Book, Bookmark } from '../types';

export class AudioEpubDatabase extends Dexie {
  books!: Table<Book, number>;
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
