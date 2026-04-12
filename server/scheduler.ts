import cron from 'node-cron';
import { crawlAllSites } from './crawler.js';
import { processArticles } from './gemini.js';
import { crawlAllVideos } from './video-crawler.js';
import { addNewsItems } from './store.js';

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

let scheduledTask: cron.ScheduledTask | null = null;

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
