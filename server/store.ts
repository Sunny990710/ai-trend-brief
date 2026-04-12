import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_PATH = path.join(DATA_DIR, 'news.json');

export interface NewsItem {
  id: string;
  type: 'article' | 'video';
  industry: string;
  title: string;
  summary: string;
  fullContent: string;
  insight: string;
  imageUrl: string;
  date: string;
  keywords: string[];
  source: string;
  sourceUrl: string;
  duration?: string;
  hidden?: boolean;
  viewCount?: number;
  impactLevel?: '매우 높음' | '중간' | '낮음';
  crawledAt: string;
}

export function loadNews(): NewsItem[] {
  try {
    if (!fs.existsSync(DATA_PATH)) return [];
    const data = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveNews(items: NewsItem[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

export function getExistingUrls(): Set<string> {
  return new Set(loadNews().map(item => item.sourceUrl));
}

export function getExistingTitles(): string[] {
  return loadNews().map(item => item.title);
}

export function incrementViewCount(id: string): number {
  const items = loadNews();
  const item = items.find(i => i.id === id);
  if (!item) return -1;
  item.viewCount = (item.viewCount || 0) + 1;
  saveNews(items);
  return item.viewCount;
}

export function addNewsItems(newItems: NewsItem[]): number {
  const existing = loadNews();
  const existingUrls = new Set(existing.map(item => item.sourceUrl));
  const deduped = newItems.filter(item => !existingUrls.has(item.sourceUrl));
  if (deduped.length > 0) {
    saveNews([...deduped, ...existing]);
  }
  return deduped.length;
}
