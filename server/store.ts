import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';

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
  deleted?: boolean;
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

interface ArticleOverride {
  article_id: string;
  deleted?: boolean;
  hidden?: boolean | null;
  industry?: string;
  updated_at?: string;
}

export async function applyOverrides(): Promise<number> {
  let overrides: ArticleOverride[];
  try {
    const result = await supabase.from('article_overrides').select('*');
    if (result.error || !result.data || result.data.length === 0) return 0;
    overrides = result.data as ArticleOverride[];
  } catch {
    console.warn('[Store] Supabase unavailable, skipping overrides');
    return 0;
  }

  const news = loadNews();
  const overrideMap = new Map(overrides.map(o => [o.article_id, o]));

  let changed = false;
  for (const item of news) {
    const o = overrideMap.get(item.id);
    if (!o) continue;
    if (o.deleted && !item.deleted) { item.deleted = true; changed = true; }
    if (o.hidden !== null && o.hidden !== undefined && !!item.hidden !== !!o.hidden) { item.hidden = o.hidden; changed = true; }
    if (o.industry && item.industry !== o.industry) { item.industry = o.industry; changed = true; }
  }

  if (changed) {
    saveNews(news);
    const deletedCount = overrides.filter(o => o.deleted).length;
    console.log(`[Store] Applied ${overrides.length} overrides (${deletedCount} deleted, ${overrides.length - deletedCount} modified)`);
  }

  return overrides.length;
}

export function loadVisibleNews(): NewsItem[] {
  return loadNews().filter(item => !item.deleted);
}
