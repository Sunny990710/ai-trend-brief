/**
 * trendCrawler.ts
 * RSS 우선 → 자동 탐색 → 스크랩 폴백으로 트렌드 기사를 수집하고,
 * Gemini로 카테고리 분류·요약·임팩트 평가를 붙여 정규화된 아이템 배열을 반환합니다.
 *
 * 의존성(이미 package.json에 존재): axios, cheerio, @google/genai
 *
 * 사용:
 *   import { runTrendCrawl } from './trendCrawler';
 *   const items = await runTrendCrawl({ sinceDays: 7 });
 *   // → items 를 기존 저장 계층(Supabase/sqlite)에 upsert
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// CLI(notionSink 등)에서도 index.ts와 동일하게 env 로드
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config();
dotenv.config({ path: '.env.local' });
import {
  SOURCES,
  enabledSources,
  CATEGORY_LABELS,
  type Category,
  type Source,
} from './trendSources';

export interface RawItem {
  sourceId: string;
  sourceName: string;
  region: 'KR' | 'GLOBAL';
  defaultCategory: Category;
  title: string;
  url: string;
  publishedAt?: string; // ISO
  snippet?: string;
}

export interface TrendItem extends RawItem {
  category: Category;       // Gemini가 재분류한 최종 카테고리
  categoryLabel: string;
  summary: string;          // 1~2문장 한국어 요약
  impact: 'high' | 'medium' | 'low';
  forExec: boolean;         // 경영진 브리핑용으로 적합한가
}

const UA = 'Mozilla/5.0 (compatible; AITrendBriefBot/1.0; +https://example.com/bot)';
const http = axios.create({ timeout: 15000, headers: { 'User-Agent': UA }, maxRedirects: 5 });

// ---------- 1. RSS / Atom 파싱 (cheerio xmlMode) ----------
function parseFeed(xml: string, source: Source): RawItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: RawItem[] = [];

  const push = (title?: string, url?: string, date?: string, desc?: string) => {
    if (!title || !url) return;
    out.push({
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      defaultCategory: source.category,
      title: title.trim(),
      url: url.trim(),
      publishedAt: date ? new Date(date).toISOString() : undefined,
      snippet: desc?.replace(/<[^>]+>/g, '').trim().slice(0, 400),
    });
  };

  // RSS 2.0
  $('item').each((_, el) => {
    const it = $(el);
    push(it.find('title').first().text(), it.find('link').first().text(),
         it.find('pubDate').first().text(), it.find('description').first().text());
  });
  // Atom
  $('entry').each((_, el) => {
    const it = $(el);
    const link = it.find('link[rel="alternate"]').attr('href') || it.find('link').attr('href');
    push(it.find('title').first().text(), link,
         it.find('updated').first().text() || it.find('published').first().text(),
         it.find('summary').first().text() || it.find('content').first().text());
  });
  return out;
}

// ---------- 2. 홈페이지에서 RSS 자동 탐색 ----------
async function discoverFeed(homepage: string): Promise<string | null> {
  try {
    const { data } = await http.get(homepage);
    const $ = cheerio.load(data);
    const href =
      $('link[type="application/rss+xml"]').attr('href') ||
      $('link[type="application/atom+xml"]').attr('href');
    if (!href) return null;
    return new URL(href, homepage).toString();
  } catch {
    return null;
  }
}

// ---------- 3. 스크랩 폴백 ----------
function scrapeList(html: string, source: Source): RawItem[] {
  if (!source.scrape) return [];
  const { item, title, link, date } = source.scrape;
  const $ = cheerio.load(html);
  const out: RawItem[] = [];
  $(item).slice(0, 30).each((_, el) => {
    const node = $(el);
    const a = link ? node.find(link) : (node.is('a') ? node : node.find('a').first());
    const href = a.attr('href');
    const t = title ? node.find(title).text() : a.text();
    if (!href || !t.trim()) return;
    out.push({
      sourceId: source.id, sourceName: source.name, region: source.region,
      defaultCategory: source.category, title: t.trim(),
      url: new URL(href, source.homepage).toString(),
      publishedAt: date ? node.find(date).text().trim() : undefined,
    });
  });
  return out;
}

// ---------- 4. 소스 1건 수집 ----------
async function fetchSource(source: Source): Promise<RawItem[]> {
  // (a) 명시 RSS
  let feedUrl = source.rss ?? null;
  // (b) 자동 탐색
  if (!feedUrl && source.discover) feedUrl = await discoverFeed(source.homepage);

  if (feedUrl) {
    try {
      const { data } = await http.get(feedUrl);
      const items = parseFeed(data, source);
      if (items.length) return items;
    } catch (e) {
      console.warn(`[${source.id}] RSS 실패(${feedUrl}): ${(e as Error).message}`);
    }
  }
  // (c) 스크랩 폴백
  if (source.scrape) {
    try {
      const { data } = await http.get(source.homepage);
      return scrapeList(data, source);
    } catch (e) {
      console.warn(`[${source.id}] 스크랩 실패: ${(e as Error).message}`);
    }
  }
  console.warn(`[${source.id}] 수집 경로 없음 — rss 주소 확인 또는 scrape 셀렉터 추가 필요`);
  return [];
}

// ---------- 5. 동시성 제한 ----------
async function mapLimit<T, R>(arr: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, arr.length) }, async () => {
    while (i < arr.length) {
      const idx = i++;
      ret[idx] = await fn(arr[idx]);
    }
  });
  await Promise.all(workers);
  return ret;
}

// ---------- 6. 중복 제거 & 기간 필터 ----------
function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid']
      .forEach((p) => url.searchParams.delete(p));
    return url.toString().replace(/\/$/, '');
  } catch {
    return u;
  }
}

function dedupeAndFilter(items: RawItem[], sinceDays?: number): RawItem[] {
  const seen = new Set<string>();
  const cutoff = sinceDays ? Date.now() - sinceDays * 864e5 : null;
  const out: RawItem[] = [];
  for (const it of items) {
    const key = normalizeUrl(it.url);
    if (seen.has(key)) continue;
    if (cutoff && it.publishedAt && new Date(it.publishedAt).getTime() < cutoff) continue;
    seen.add(key);
    out.push({ ...it, url: key });
  }
  return out;
}

// ---------- 7. Gemini 분류·요약 ----------
function getTrendAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({ apiKey });
}

function fallbackCategorized(items: RawItem[]): TrendItem[] {
  return items.map((it) => ({
    ...it,
    category: it.defaultCategory,
    categoryLabel: CATEGORY_LABELS[it.defaultCategory],
    summary: it.title,
    impact: 'medium' as const,
    forExec: false,
  }));
}

const CATEGORY_GUIDE = (Object.keys(CATEGORY_LABELS) as Category[])
  .map((k) => `${k}: ${CATEGORY_LABELS[k]}`)
  .join('\n');

async function categorizeBatch(items: RawItem[]): Promise<TrendItem[]> {
  if (!items.length) return [];
  const ai = getTrendAI();
  if (!ai) {
    console.warn('[trendCrawl] GEMINI_API_KEY 없음 — 분류·요약 생략, 기본값 사용');
    return fallbackCategorized(items);
  }
  const payload = items.map((it, i) => ({ i, title: it.title, snippet: it.snippet ?? '', source: it.sourceName }));

  const prompt = `너는 IT기업의 주간 AI/IT 트렌드 브리핑 에디터다. 아래 기사 목록을 분류·요약하라.

[카테고리 코드]
${CATEGORY_GUIDE}

[기사]
${JSON.stringify(payload, null, 2)}

각 기사에 대해 아래 스키마의 JSON 배열만 출력하라(설명/마크다운 금지):
[{"i":0,"category":"<코드>","summary":"<한국어 1~2문장 핵심 요약>","impact":"high|medium|low","forExec":true|false}]
- category: 위 코드 중 가장 적합한 하나
- impact: 산업 파급력 기준
- forExec: 경영진 브리핑에 넣을 가치가 있으면 true`;

  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  });

  let parsed: Array<{ i: number; category: Category; summary: string; impact: TrendItem['impact']; forExec: boolean }>;
  try {
    parsed = JSON.parse((res.text ?? '[]').replace(/```json|```/g, '').trim());
  } catch {
    parsed = [];
  }

  const byIndex = new Map(parsed.map((p) => [p.i, p]));
  return items.map((it, i) => {
    const g = byIndex.get(i);
    const category = (g?.category && CATEGORY_LABELS[g.category]) ? g.category : it.defaultCategory;
    return {
      ...it,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      summary: g?.summary ?? it.title,
      impact: g?.impact ?? 'medium',
      forExec: g?.forExec ?? false,
    };
  });
}

// 배치 분할 (토큰 관리)
async function categorizeAll(items: RawItem[], batchSize = 15): Promise<TrendItem[]> {
  const out: TrendItem[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    out.push(...(await categorizeBatch(items.slice(i, i + batchSize))));
  }
  return out;
}

// ---------- 8. 파이프라인 진입점 ----------
export interface CrawlOptions {
  sinceDays?: number;       // 최근 N일 기사만 (기본 7)
  categories?: Category[];  // 특정 카테고리만 수집
  concurrency?: number;     // 동시 요청 수 (기본 5)
  maxPerSource?: number;    // 소스당 최대 기사 (기본 10)
  classify?: boolean;       // Gemini 분류 수행 (기본 true)
}

export async function runTrendCrawl(opts: CrawlOptions = {}): Promise<TrendItem[]> {
  const { sinceDays = 7, categories, concurrency = 5, maxPerSource = 10, classify = true } = opts;

  let sources = enabledSources();
  if (categories?.length) sources = sources.filter((s) => categories.includes(s.category));

  const grouped = await mapLimit(sources, concurrency, fetchSource);
  const raw = grouped.flatMap((items) => items.slice(0, maxPerSource));

  const filtered = dedupeAndFilter(raw, sinceDays);
  console.log(`[trendCrawl] 소스 ${sources.length}개 → 원본 ${raw.length}건 → 정제 ${filtered.length}건`);

  if (!classify) {
    return filtered.map((it) => ({
      ...it, category: it.defaultCategory, categoryLabel: CATEGORY_LABELS[it.defaultCategory],
      summary: it.title, impact: 'medium', forExec: false,
    }));
  }
  return categorizeAll(filtered);
}

// CLI 실행: npm run crawl:trend  (package.json에 스크립트 추가 시)
if (process.argv[1] && process.argv[1].includes('trendCrawler')) {
  runTrendCrawl({ sinceDays: 7 })
    .then((items) => { console.log(JSON.stringify(items, null, 2)); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
