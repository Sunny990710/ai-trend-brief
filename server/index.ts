import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { loadNews, incrementViewCount, applyOverrides } from './store.js';
import { runCrawlPipeline, startScheduler, isPipelineRunning } from './scheduler.js';
import { INDUSTRIES } from './crawl-config.js';
import { signup, login, getMe, authMiddleware, requireAuth, requireAdmin } from './auth.js';
import { getBookmarks, addBookmark, removeBookmark } from './bookmarks.js';
import { getAdminUsers, getAdminStats, deleteAdminUser, getAdminArticles, toggleHideArticle, bulkHideArticles, deleteArticle, bulkDeleteArticles, addManualArticle, forceAddArticle } from './admin.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const asyncHandler = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

dotenv.config();
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.API_PORT || '3001', 10);

app.use(express.json());

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

app.use(authMiddleware);

app.get('/api/news', (req, res) => {
  const { industry, type, limit, sort } = req.query;
  let items = loadNews().filter(item => !item.hidden);

  if (industry && typeof industry === 'string') {
    const industries = industry.split(',');
    items = items.filter(item => industries.includes(item.industry));
  }
  if (type && typeof type === 'string') {
    items = items.filter(item => item.type === type);
  }

  if (sort === 'popular') {
    items.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  } else {
    items.sort((a, b) => {
      const dateA = a.date.replace(/\./g, '-');
      const dateB = b.date.replace(/\./g, '-');
      return dateB.localeCompare(dateA);
    });
  }

  const maxItems = Math.min(parseInt((limit as string) || '500', 10), 500);
  items = items.slice(0, maxItems);

  res.json({ count: items.length, items });
});

app.post('/api/news/:id/view', (req, res) => {
  const { id } = req.params;
  const viewCount = incrementViewCount(id);
  if (viewCount === -1) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json({ id, viewCount });
});

app.get('/api/industries', (_req, res) => {
  res.json({ industries: INDUSTRIES });
});

// Auth routes
app.post('/api/auth/signup', asyncHandler(signup));
app.post('/api/auth/login', asyncHandler(login));
app.get('/api/auth/me', asyncHandler(getMe));

// Bookmark routes (require login)
app.get('/api/bookmarks', requireAuth, asyncHandler(getBookmarks));
app.post('/api/bookmarks', requireAuth, asyncHandler(addBookmark));
app.delete('/api/bookmarks/:itemId', requireAuth, asyncHandler(removeBookmark));

// Admin routes (require admin)
app.get('/api/admin/users', requireAdmin, asyncHandler(getAdminUsers));
app.get('/api/admin/stats', requireAdmin, asyncHandler(getAdminStats));
app.delete('/api/admin/users/:userId', requireAdmin, asyncHandler(deleteAdminUser));
app.get('/api/admin/articles', requireAdmin, getAdminArticles);
app.patch('/api/admin/articles/:itemId', requireAdmin, asyncHandler(toggleHideArticle));
app.post('/api/admin/articles/bulk-hide', requireAdmin, asyncHandler(bulkHideArticles));
app.delete('/api/admin/articles/:itemId', requireAdmin, asyncHandler(deleteArticle));
app.post('/api/admin/articles/bulk-delete', requireAdmin, asyncHandler(bulkDeleteArticles));
app.post('/api/admin/articles/add', requireAdmin, asyncHandler(addManualArticle));
app.post('/api/admin/articles/force-add', requireAdmin, asyncHandler(forceAddArticle));

app.post('/api/crawl', async (_req, res) => {
  if (isPipelineRunning()) {
    res.status(409).json({ error: 'Crawl pipeline is already running' });
    return;
  }
  res.json({ message: 'Crawl started', status: 'running' });
  runCrawlPipeline().then(result => {
    console.log('[API] Crawl completed:', result);
  });
});

app.get('/api/image-proxy', async (req, res) => {
  const url = req.query.url as string;
  if (!url) { res.status(400).send('Missing url'); return; }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': new URL(url).origin },
    });
    if (!response.ok) { res.status(response.status).send('Fetch failed'); return; }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).send('Image proxy error');
  }
});

app.get('/api/status', (_req, res) => {
  const news = loadNews();
  res.json({
    totalArticles: news.length,
    pipelineRunning: isPipelineRunning(),
    industries: INDUSTRIES,
    latestArticle: news[0]?.crawledAt ?? null,
  });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

app.listen(PORT, async () => {
  console.log(`[Server] API running at http://localhost:${PORT}`);
  startScheduler();
  console.log('[Server] Scheduler started (daily at 07:00)');

  // Render 무료 플랜 슬립 방지: 14분마다 자기 자신에게 ping
  const KEEP_ALIVE_MS = 14 * 60 * 1000;
  setInterval(() => {
    fetch(`http://localhost:${PORT}/api/status`).catch(() => {});
  }, KEEP_ALIVE_MS);
  console.log('[Server] Keep-alive enabled (every 14min)');

  const overrideCount = await applyOverrides();
  if (overrideCount > 0) console.log(`[Server] Applied ${overrideCount} article overrides from Supabase`);

  const news = loadNews();
  if (news.length === 0) {
    console.log('[Server] No existing news found — running initial crawl...');
    runCrawlPipeline().then(result => {
      console.log(`[Server] Initial crawl done: ${result.saved} articles saved`);
    });
  } else {
    console.log(`[Server] ${news.length} existing articles loaded`);
  }
});
