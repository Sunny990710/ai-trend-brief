import cron, { type ScheduledTask } from 'node-cron';
import { crawlAllSites } from './crawler.js';
import { processArticles } from './gemini.js';
import { crawlAllVideos } from './video-crawler.js';
import { addNewsItems } from './store.js';
import { runHybridPipeline } from './notionSink.js';

let isRunning = false;

export async function runCrawlPipeline(): Promise<{
  crawled: number;
  saved: number;
  error?: string;
}> {
  if (isRunning) {
    return { crawled: 0, saved: 0, error: 'Pipeline already running' };
  }

  isRunning = true;
  console.log(`[Scheduler] Pipeline started at ${new Date().toISOString()}`);

  try {
    const rawArticles = await crawlAllSites();
    console.log(`[Scheduler] Crawled ${rawArticles.length} raw articles`);

    if (rawArticles.length === 0) {
      return { crawled: 0, saved: 0 };
    }

    const processedItems = await processArticles(rawArticles);
    console.log(`[Scheduler] Processed ${processedItems.length} articles with Gemini`);

    const savedArticles = addNewsItems(processedItems);
    console.log(`[Scheduler] Saved ${savedArticles} new articles (${processedItems.length - savedArticles} duplicates skipped)`);

    const videos = await crawlAllVideos();
    const savedVideos = addNewsItems(videos);
    console.log(`[Scheduler] Saved ${savedVideos} new videos (${videos.length - savedVideos} duplicates skipped)`);

    return { crawled: rawArticles.length + videos.length, saved: savedArticles + savedVideos };
  } catch (err: any) {
    console.error(`[Scheduler] Pipeline error: ${err.message}`);
    return { crawled: 0, saved: 0, error: err.message };
  } finally {
    isRunning = false;
    console.log(`[Scheduler] Pipeline finished at ${new Date().toISOString()}`);
  }
}

let scheduledTask: ScheduledTask | null = null;

export function startScheduler(cronExpression = '0 7 * * *'): void {
  if (scheduledTask) {
    console.log('[Scheduler] Already running, stopping previous schedule');
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(cronExpression, () => {
    console.log('[Scheduler] Cron triggered');
    runCrawlPipeline();
  });

  console.log(`[Scheduler] Scheduled with cron: ${cronExpression}`);
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduler] Stopped');
  }
}

export function isPipelineRunning(): boolean {
  return isRunning;
}

// ---------- 주간 Notion 하이브리드 크롤 (기본: 매주 금요일 15:00 KST, 최근 7일) ----------
let isHybridRunning = false;
let hybridScheduledTask: ScheduledTask | null = null;

export interface HybridPipelineResult {
  collected: number;
  pushed: number;
  skipped: number;
  failed: number;
  error?: string;
}

export async function runHybridScheduledPipeline(): Promise<HybridPipelineResult> {
  if (isHybridRunning) {
    return { collected: 0, pushed: 0, skipped: 0, failed: 0, error: 'Hybrid pipeline already running' };
  }
  if (!process.env.NOTION_TOKEN) {
    console.warn('[HybridScheduler] NOTION_TOKEN 없음 — 스킵');
    return { collected: 0, pushed: 0, skipped: 0, failed: 0, error: 'NOTION_TOKEN not set' };
  }

  isHybridRunning = true;
  console.log(`[HybridScheduler] Weekly Notion crawl started at ${new Date().toISOString()}`);

  try {
    const result = await runHybridPipeline({ sinceDays: 7 });
    return {
      collected: result.total,
      pushed: result.pushed,
      skipped: result.skipped,
      failed: result.failed,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[HybridScheduler] Pipeline error: ${message}`);
    return { collected: 0, pushed: 0, skipped: 0, failed: 0, error: message };
  } finally {
    isHybridRunning = false;
    console.log(`[HybridScheduler] Finished at ${new Date().toISOString()}`);
  }
}

/** 매주 금요일 13:20 (Asia/Seoul). HYBRID_CRON / HYBRID_CRON_TZ 로 변경 가능 */
export function startHybridScheduler(
  cronExpression = process.env.HYBRID_CRON ?? '20 13 * * 5',
  timezone = process.env.HYBRID_CRON_TZ ?? 'Asia/Seoul',
): void {
  if (process.env.HYBRID_SCHEDULE_ENABLED === 'false') {
    console.log('[HybridScheduler] Disabled (HYBRID_SCHEDULE_ENABLED=false)');
    return;
  }

  if (hybridScheduledTask) {
    hybridScheduledTask.stop();
  }

  hybridScheduledTask = cron.schedule(
    cronExpression,
    () => {
      console.log('[HybridScheduler] Cron triggered');
      void runHybridScheduledPipeline();
    },
    { timezone },
  );

  console.log(`[HybridScheduler] Scheduled: ${cronExpression} (${timezone}) — 최근 7일 기사 → Notion`);
}

export function stopHybridScheduler(): void {
  if (hybridScheduledTask) {
    hybridScheduledTask.stop();
    hybridScheduledTask = null;
    console.log('[HybridScheduler] Stopped');
  }
}

export function isHybridPipelineRunning(): boolean {
  return isHybridRunning;
}
