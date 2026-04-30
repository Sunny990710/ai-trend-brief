/**
 * 지정 기간(기본: 2026.04.25~29) 네이버 뉴스 기사 크롤 → Gemini 처리 → news.json 추가
 * 실행: npx tsx server/crawl-range.ts
 */
import { crawlAllSites } from './crawler.js';
import { processArticles } from './gemini.js';
import { addNewsItems } from './store.js';

const RANGE = { start: '2026.04.25', end: '2026.04.29' };

async function main(): Promise<void> {
  console.log(`[CrawlRange] 기간: ${RANGE.start} ~ ${RANGE.end}`);
  const rawArticles = await crawlAllSites({ dateRange: RANGE });
  console.log(`[CrawlRange] 원본 ${rawArticles.length}건`);

  if (rawArticles.length === 0) {
    console.log('[CrawlRange] 저장할 기사 없음');
    return;
  }

  const processed = await processArticles(rawArticles);
  const saved = addNewsItems(processed);
  console.log(`[CrawlRange] 처리 ${processed.length}건, 신규 저장 ${saved}건`);
}

main().catch(err => {
  console.error('[CrawlRange]', err);
  process.exit(1);
});
