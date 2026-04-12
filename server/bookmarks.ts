import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Response } from 'express';
import type { AuthRequest } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const BOOKMARKS_PATH = path.join(DATA_DIR, 'bookmarks.json');

interface Bookmark {
  userId: string;
  itemId: string;
  createdAt: string;
}

function loadBookmarks(): Bookmark[] {
  try {
    if (!fs.existsSync(BOOKMARKS_PATH)) return [];
    return JSON.parse(fs.readFileSync(BOOKMARKS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Bookmark[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOOKMARKS_PATH, JSON.stringify(bookmarks, null, 2), 'utf-8');
}

export function getBookmarks(req: AuthRequest, res: Response): void {
  const userId = req.user!.id;
  const bookmarks = loadBookmarks().filter(b => b.userId === userId);
  res.json({ itemIds: bookmarks.map(b => b.itemId) });
}

export function addBookmark(req: AuthRequest, res: Response): void {
  const userId = req.user!.id;
  const { itemId } = req.body;

  if (!itemId) {
    res.status(400).json({ error: 'itemId가 필요합니다.' });
    return;
  }

  const bookmarks = loadBookmarks();
  const exists = bookmarks.find(b => b.userId === userId && b.itemId === itemId);

  if (exists) {
    res.json({ message: '이미 북마크되어 있습니다.', itemId });
    return;
  }

  bookmarks.push({ userId, itemId, createdAt: new Date().toISOString() });
  saveBookmarks(bookmarks);
  res.status(201).json({ message: '북마크 추가 완료', itemId });
}

export function removeBookmark(req: AuthRequest, res: Response): void {
  const userId = req.user!.id;
  const { itemId } = req.params;

  const bookmarks = loadBookmarks();
  const filtered = bookmarks.filter(b => !(b.userId === userId && b.itemId === itemId));

  if (filtered.length === bookmarks.length) {
    res.status(404).json({ error: '해당 북마크를 찾을 수 없습니다.' });
    return;
  }

  saveBookmarks(filtered);
  res.json({ message: '북마크 삭제 완료', itemId });
}
