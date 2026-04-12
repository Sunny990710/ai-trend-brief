import yts from 'yt-search';
import {
  INDUSTRIES,
  INDUSTRY_SEARCH_QUERIES,
  TITLE_FILTER_KEYWORDS,
  INDUSTRY_EXTRA_KEYWORDS,
  CRAWL_DELAY_MS,
  MAX_VIDEOS_PER_INDUSTRY,
  PREFERRED_CHANNELS,
  type Industry,
} from './crawl-config.js';
import { getExistingUrls, getExistingTitles } from './store.js';
import type { NewsItem } from './store.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function titleMatchesKeywords(title: string, industry?: Industry): boolean {
  if (TITLE_FILTER_KEYWORDS.some(kw => title.toLowerCase().includes(kw.toLowerCase()))) return true;
  if (industry) {
    const extra = INDUSTRY_EXTRA_KEYWORDS[industry];
    if (extra?.some(kw => title.toLowerCase().includes(kw.toLowerCase()))) return true;
  }
  return false;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function normalizeForComparison(title: string): string {
  return title
    .replace(/\[.*?\]/g, '')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isSimilarTitle(a: string, b: string): boolean {
  const na = normalizeForComparison(a);
  const nb = normalizeForComparison(b);
  if (na === nb) return true;
  if (na.length > 10 && nb.length > 10 && (na.includes(nb) || nb.includes(na))) return true;

  const wordsA = new Set(na.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.55;
}

async function searchYouTube(query: string): Promise<yts.VideoSearchResult[]> {
  try {
    const result = await yts(query);
    return result.videos || [];
  } catch (err: any) {
    console.error(`[VideoCrawler] YouTube search failed for "${query}": ${err.message}`);
    return [];
  }
}

const MAX_AGE_DAYS = 14;

function ageToDays(ago: string): number {
  const match = ago.match(/(\d+)\s*(일|시간|분|주|개월|년|days?|hours?|minutes?|weeks?|months?|years?)/i);
  if (!match) return 9999;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.includes('년') || unit.includes('year')) return num * 365;
  if (unit.includes('개월') || unit.includes('month')) return num * 30;
  if (unit.includes('주') || unit.includes('week')) return num * 7;
  if (unit.includes('일') || unit.includes('day')) return num;
  if (unit.includes('시간') || unit.includes('hour')) return num / 24;
  if (unit.includes('분') || unit.includes('minute')) return 0;
  return 9999;
}

function normalizeDate(video: yts.VideoSearchResult): string {
  const ago = video.ago || '';
  const now = new Date();

  const match = ago.match(/(\d+)\s*(일|시간|분|주|개월|년|day|hour|minute|week|month|year)/);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2];
    if (unit.includes('년') || unit.includes('year')) now.setFullYear(now.getFullYear() - num);
    else if (unit.includes('개월') || unit.includes('month')) now.setMonth(now.getMonth() - num);
    else if (unit.includes('주') || unit.includes('week')) now.setDate(now.getDate() - num * 7);
    else if (unit.includes('일') || unit.includes('day')) now.setDate(now.getDate() - num);
    else if (unit.includes('시간') || unit.includes('hour')) now.setHours(now.getHours() - num);
  }

  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

async function crawlVideosForIndustry(industry: Industry): Promise<NewsItem[]> {
  const queries = INDUSTRY_SEARCH_QUERIES[industry];
  const preferredChannels = PREFERRED_CHANNELS[industry] || [];
  console.log(`[VideoCrawler] 🎬 [${industry}] 검색어: ${queries.join(', ')}${preferredChannels.length ? ` (선호채널: ${preferredChannels.join(', ')})` : ''}`);

  const existingUrls = getExistingUrls();
  const existingTitles = getExistingTitles();

  const seenIds = new Set<string>();
  let allRawVideos: yts.VideoSearchResult[] = [];
  for (const query of queries) {
    const videos = await searchYouTube(query);
    for (const v of videos) {
      if (!seenIds.has(v.videoId)) {
        seenIds.add(v.videoId);
        allRawVideos.push(v);
      }
    }
    await sleep(500);
  }

  const MIN_VIEWS = 1000;
  const recentAiVideos = allRawVideos.filter(v => {
    if (!titleMatchesKeywords(v.title, industry)) return false;
    if ((v.views || 0) < MIN_VIEWS) return false;
    const days = ageToDays(v.ago || '');
    return days <= MAX_AGE_DAYS;
  });

  if (preferredChannels.length > 0) {
    recentAiVideos.sort((a, b) => {
      const aPreferred = preferredChannels.some(ch => (a.author?.name || '').includes(ch)) ? 0 : 1;
      const bPreferred = preferredChannels.some(ch => (b.author?.name || '').includes(ch)) ? 0 : 1;
      return aPreferred - bPreferred;
    });
  }

  console.log(`[VideoCrawler] ${allRawVideos.length}건 중 최근 ${MAX_AGE_DAYS}일 이내 + ${MIN_VIEWS}회 이상 AI 영상: ${recentAiVideos.length}건`);

  const results: NewsItem[] = [];
  const collectedTitles: string[] = [];

  for (const video of recentAiVideos) {
    if (results.length >= MAX_VIDEOS_PER_INDUSTRY) break;

    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    if (existingUrls.has(videoUrl)) continue;

    const isDupExisting = existingTitles.some(t => isSimilarTitle(t, video.title));
    const isDupCollected = collectedTitles.some(t => isSimilarTitle(t, video.title));
    if (isDupExisting || isDupCollected) continue;

    collectedTitles.push(video.title);

    results.push({
      id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'video',
      industry,
      title: video.title,
      summary: video.description || '',
      fullContent: '',
      insight: '',
      imageUrl: video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
      date: normalizeDate(video),
      keywords: [],
      source: video.author?.name || 'YouTube',
      sourceUrl: videoUrl,
      duration: formatDuration(video.seconds || 0),
      crawledAt: new Date().toISOString(),
    });

    console.log(`[VideoCrawler] ✅ [${industry}] ${video.title.slice(0, 60)}...`);
  }

  console.log(`[VideoCrawler] [${industry}] ${results.length}건 수집 완료`);
  return results;
}

export async function crawlAllVideos(): Promise<NewsItem[]> {
  const allVideos: NewsItem[] = [];

  for (const industry of INDUSTRIES) {
    try {
      const videos = await crawlVideosForIndustry(industry);
      for (const video of videos) {
        const dupAcross = allVideos.some(v => isSimilarTitle(v.title, video.title));
        if (dupAcross) {
          console.log(`[VideoCrawler] 🔄 산업군 간 중복 건너뜀: ${video.title.slice(0, 50)}...`);
          continue;
        }
        allVideos.push(video);
      }
    } catch (err: any) {
      console.error(`[VideoCrawler] [${industry}] 오류: ${err.message}`);
    }
    await sleep(CRAWL_DELAY_MS);
  }

  console.log(`[VideoCrawler] === 전체 영상 수집 완료: ${allVideos.length}건 ===`);
  return allVideos;
}
