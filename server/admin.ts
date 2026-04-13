import type { Response } from 'express';
import type { AuthRequest } from './auth.js';
import { loadNews, saveNews, addNewsItems } from './store.js';
import { scrapeArticleContent } from './crawler.js';
import { processArticles } from './gemini.js';
import type { Industry } from './crawl-config.js';
import { supabase } from './supabase.js';
import yts from 'yt-search';

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function getAdminUsers(_req: AuthRequest, res: Response): Promise<void> {
  const { data: users, error: usersErr } = await supabase.from('users').select('*');
  if (usersErr || !users) {
    res.status(500).json({ error: '사용자 조회 실패' });
    return;
  }

  const { data: bookmarks } = await supabase.from('bookmarks').select('*');
  const allBookmarks = bookmarks || [];
  const news = loadNews();
  const newsMap = new Map(news.map(n => [n.id, n]));

  const result = users.map(u => {
    const userBookmarks = allBookmarks.filter(b => b.user_id === u.id);
    const bookmarkedItems = userBookmarks
      .map(b => {
        const item = newsMap.get(b.item_id);
        return item ? { id: item.id, title: item.title, industry: item.industry, type: item.type, date: item.date } : null;
      })
      .filter(Boolean);

    const industryInterest: Record<string, number> = {};
    bookmarkedItems.forEach(item => {
      if (item) industryInterest[item.industry] = (industryInterest[item.industry] || 0) + 1;
    });

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      department: u.department,
      isAdmin: u.is_admin,
      createdAt: u.created_at,
      bookmarkCount: userBookmarks.length,
      industryInterest,
      bookmarkedItems,
    };
  });

  res.json({ users: result });
}

export async function getAdminStats(_req: AuthRequest, res: Response): Promise<void> {
  const { data: users } = await supabase.from('users').select('*');
  const { data: bookmarks } = await supabase.from('bookmarks').select('*');
  const allUsers = users || [];
  const allBookmarks = bookmarks || [];
  const news = loadNews();
  const newsMap = new Map(news.map(n => [n.id, n]));

  const deptCount: Record<string, number> = {};
  allUsers.forEach(u => {
    const dept = u.department || '미지정';
    deptCount[dept] = (deptCount[dept] || 0) + 1;
  });

  const articleBookmarkCount: Record<string, number> = {};
  allBookmarks.forEach(b => {
    articleBookmarkCount[b.item_id] = (articleBookmarkCount[b.item_id] || 0) + 1;
  });

  const popularArticles = Object.entries(articleBookmarkCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([itemId, count]) => {
      const item = newsMap.get(itemId);
      return item
        ? { id: item.id, title: item.title, industry: item.industry, type: item.type, bookmarkCount: count }
        : { id: itemId, title: '(삭제됨)', industry: '-', type: '-', bookmarkCount: count };
    });

  const industryPopularity: Record<string, number> = {};
  allBookmarks.forEach(b => {
    const item = newsMap.get(b.item_id);
    if (item) industryPopularity[item.industry] = (industryPopularity[item.industry] || 0) + 1;
  });

  res.json({
    totalUsers: allUsers.length,
    totalBookmarks: allBookmarks.length,
    totalArticles: news.filter(n => n.type === 'article').length,
    totalVideos: news.filter(n => n.type === 'video').length,
    departmentStats: deptCount,
    popularArticles,
    industryPopularity,
  });
}

export function getAdminArticles(req: AuthRequest, res: Response): void {
  const news = loadNews();
  const { type, hidden } = req.query;
  let items = news.map(n => ({
    id: n.id, type: n.type, industry: n.industry, title: n.title,
    source: n.source, date: n.date, hidden: !!n.hidden, sourceUrl: n.sourceUrl,
  }));
  if (type && typeof type === 'string') items = items.filter(i => i.type === type);
  if (hidden === 'true') items = items.filter(i => i.hidden);
  if (hidden === 'false') items = items.filter(i => !i.hidden);
  res.json({ items, total: items.length });
}

export function toggleHideArticle(req: AuthRequest, res: Response): void {
  const { itemId } = req.params;
  const { hidden } = req.body;
  const news = loadNews();
  const item = news.find(n => n.id === itemId);
  if (!item) { res.status(404).json({ error: '기사를 찾을 수 없습니다.' }); return; }
  item.hidden = !!hidden;
  saveNews(news);
  res.json({ message: hidden ? '숨김 처리되었습니다.' : '복원되었습니다.', itemId, hidden: item.hidden });
}

export function bulkHideArticles(req: AuthRequest, res: Response): void {
  const { itemIds, hidden } = req.body;
  if (!Array.isArray(itemIds)) { res.status(400).json({ error: 'itemIds 배열이 필요합니다.' }); return; }
  const news = loadNews();
  let count = 0;
  for (const id of itemIds) {
    const item = news.find(n => n.id === id);
    if (item) { item.hidden = !!hidden; count++; }
  }
  saveNews(news);
  res.json({ message: `${count}개 항목이 ${hidden ? '숨김' : '복원'} 처리되었습니다.` });
}

export function deleteArticle(req: AuthRequest, res: Response): void {
  const { itemId } = req.params;
  const news = loadNews();
  const idx = news.findIndex(n => n.id === itemId);
  if (idx === -1) { res.status(404).json({ error: '항목을 찾을 수 없습니다.' }); return; }
  const removed = news.splice(idx, 1)[0];
  saveNews(news);
  res.json({ message: `"${removed.title}" 항목이 삭제되었습니다.` });
}

export function bulkDeleteArticles(req: AuthRequest, res: Response): void {
  const { itemIds } = req.body;
  if (!Array.isArray(itemIds)) { res.status(400).json({ error: 'itemIds 배열이 필요합니다.' }); return; }
  const news = loadNews();
  const deleteSet = new Set(itemIds);
  const filtered = news.filter(n => !deleteSet.has(n.id));
  const count = news.length - filtered.length;
  saveNews(filtered);
  res.json({ message: `${count}개 항목이 삭제되었습니다.` });
}

export async function addManualArticle(req: AuthRequest, res: Response): Promise<void> {
  const { url, industry } = req.body;

  if (!url || !industry) {
    res.status(400).json({ error: 'URL과 산업군을 입력해주세요.' });
    return;
  }

  try {
    if (isYouTubeUrl(url)) {
      return await addYouTubeVideo(url, industry, res);
    }

    console.log(`[Admin] Manual article add: ${url} (${industry})`);
    const scraped = await scrapeArticleContent(url);

    if (!scraped.content && !scraped.title) {
      res.status(400).json({ error: '해당 URL에서 콘텐츠를 가져올 수 없습니다.' });
      return;
    }

    const rawArticle = {
      title: scraped.title || url,
      content: scraped.content,
      date: scraped.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      imageUrl: scraped.imageUrl || '',
      sourceUrl: url,
      sourceName: new URL(url).hostname.replace('www.', ''),
      industry: industry as Industry,
    };

    const processed = await processArticles([rawArticle]);

    if (processed.length === 0) {
      res.status(400).json({ error: 'AI 분석 결과 해당 산업군과 관련이 없는 것으로 판단되었습니다. 그래도 추가하시겠습니까?', needForce: true });
      return;
    }

    const saved = addNewsItems(processed);
    res.json({ message: `기사가 추가되었습니다.`, saved, article: { title: processed[0].title, industry: processed[0].industry } });
  } catch (err: any) {
    console.error('[Admin] Manual add error:', err);
    res.status(500).json({ error: `추가 실패: ${err.message}` });
  }
}

async function addYouTubeVideo(url: string, industry: string, res: Response): Promise<void> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    res.status(400).json({ error: '유효한 YouTube URL이 아닙니다.' });
    return;
  }

  console.log(`[Admin] Manual YouTube video add: ${url} (${industry})`);
  const result = await yts({ videoId });
  const video = result;

  const now = new Date();
  const newsItem = {
    id: `video-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'video' as const,
    industry,
    title: video.title || url,
    summary: video.description?.slice(0, 300) || '',
    fullContent: '',
    insight: '',
    imageUrl: video.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    date: now.toISOString().slice(0, 10).replace(/-/g, '.'),
    keywords: [industry, 'AI'],
    source: video.author?.name || 'YouTube',
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    duration: formatDuration(video.seconds || 0),
    impactLevel: '중간' as const,
    crawledAt: now.toISOString(),
  };

  const saved = addNewsItems([newsItem]);
  res.json({ message: '영상이 추가되었습니다.', saved, article: { title: newsItem.title, industry } });
}

export async function forceAddArticle(req: AuthRequest, res: Response): Promise<void> {
  const { url, industry, title } = req.body;

  if (!url || !industry) {
    res.status(400).json({ error: 'URL과 산업군을 입력해주세요.' });
    return;
  }

  try {
    if (isYouTubeUrl(url)) {
      return await addYouTubeVideo(url, industry, res);
    }

    const scraped = await scrapeArticleContent(url);
    const now = new Date();
    const id = `manual_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;

    const newsItem = {
      id,
      type: 'article' as const,
      industry,
      title: title || scraped.title || url,
      summary: scraped.content?.slice(0, 200) || '',
      fullContent: scraped.content || '',
      insight: '',
      imageUrl: scraped.imageUrl || '',
      date: scraped.date || now.toISOString().slice(0, 10).replace(/-/g, '.'),
      keywords: [industry, 'AI'],
      source: new URL(url).hostname.replace('www.', ''),
      sourceUrl: url,
      impactLevel: '중간' as const,
      crawledAt: now.toISOString(),
    };

    const saved = addNewsItems([newsItem]);
    res.json({ message: '기사가 강제 추가되었습니다.', saved, article: { title: newsItem.title, industry } });
  } catch (err: any) {
    res.status(500).json({ error: `추가 실패: ${err.message}` });
  }
}

export async function deleteAdminUser(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params;

  if (userId === req.user!.id) {
    res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    return;
  }

  const { data, error } = await supabase
    .from('users').delete().eq('id', userId).select();

  if (error) {
    res.status(500).json({ error: '사용자 삭제 실패' });
    return;
  }

  if (!data || data.length === 0) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }

  res.json({ message: '사용자가 삭제되었습니다.' });
}
