/**
 * notionSink.ts
 * 하이브리드 파이프라인의 적재 계층.
 * runTrendCrawl()이 만든 TrendItem[]을 Notion AI Contents DB에 페이지로 적재한다.
 *
 * 설계 포인트:
 *  - 스키마 인지: 먼저 DB 스키마를 읽고, 실제 존재하는 속성에만 타입에 맞춰 기록 → 400 방지
 *  - 중복 제거: better-sqlite3(이미 의존성)로 푸시한 URL을 로컬 기록 → Notion 재조회 불필요
 *  - 새 의존성 없음: axios + better-sqlite3만 사용
 *
 * 필요한 환경변수:
 *  - NOTION_TOKEN : Notion 내부 통합(integration) 토큰. (Notion → Settings → Connections → 통합 생성)
 *  - NOTION_DB_ID : 적재할 DB ID (기본값: 기존 AI Contents DB)
 *  ※ 생성한 통합을 해당 DB에 "연결(Connect)"해줘야 쓰기가 됩니다.
 */

import axios from 'axios';
import Database from 'better-sqlite3';
import path from 'path';
import { runTrendCrawl, type TrendItem, type CrawlOptions } from './trendCrawler';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID ?? '335723ddafce49ac881dc5ab6a4900e9'; // AI/IT 트렌드 피드
const NOTION_VERSION = '2022-06-28'; // 안정 버전. parent.database_id 사용 가능
const DEDUPE_DB_PATH = process.env.DEDUPE_DB_PATH ?? path.resolve('data/pushed.db');

// 전용 DB의 상태 기본값. 워크플로우: 신규 → 검토완료 → 발행
const STATUS_VALUE = process.env.NOTION_STATUS_VALUE ?? '신규';

const notion = axios.create({
  baseURL: 'https://api.notion.com/v1',
  headers: {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

// ---------- 로컬 중복 제거 ----------
function openDedupe() {
  const db = new Database(DEDUPE_DB_PATH);
  db.exec('CREATE TABLE IF NOT EXISTS pushed (url TEXT PRIMARY KEY, pushed_at TEXT)');
  return db;
}

// ---------- DB 스키마 조회 ----------
type NotionPropType = string; // 'title' | 'rich_text' | 'select' | 'multi_select' | 'status' | 'date' | 'url' | ...
async function getSchema(): Promise<Record<string, NotionPropType>> {
  const { data } = await notion.get(`/databases/${NOTION_DB_ID}`);
  const out: Record<string, NotionPropType> = {};
  for (const [name, def] of Object.entries<{ type: string }>(data.properties)) out[name] = def.type;
  return out;
}

// ---------- 속성 페이로드 빌더 (실제 타입 기준) ----------
function valueForType(type: NotionPropType, text: string) {
  const t = text.slice(0, 1900);
  switch (type) {
    case 'title': return { title: [{ text: { content: t } }] };
    case 'rich_text': return { rich_text: [{ text: { content: t } }] };
    case 'select': return { select: { name: t } };
    case 'multi_select': return { multi_select: [{ name: t }] };
    case 'status': return { status: { name: t } };
    case 'url': return { url: text };
    case 'checkbox': return { checkbox: text === 'true' };
    default: return null; // 지원하지 않는 타입은 건너뜀
  }
}

function buildProperties(schema: Record<string, NotionPropType>, item: TrendItem) {
  const props: Record<string, unknown> = {};
  const set = (name: string, text: string) => {
    const type = schema[name];
    if (!type) return; // 없는 속성은 보내지 않음 → 400 방지
    const v = valueForType(type, text);
    if (v) props[name] = v;
  };

  // 제목: 스키마에서 title 타입 속성을 찾아 매핑(이름이 달라도 안전)
  const titleProp = Object.keys(schema).find((k) => schema[k] === 'title');
  if (titleProp) props[titleProp] = valueForType('title', item.title);

  set('카테고리', item.categoryLabel);                      // AI 기술 카테고리
  set('임팩트', item.impact);                                // high · medium · low
  set('지역', item.region === 'KR' ? '국내' : '해외');
  set('출처', item.sourceName);
  set('요약', item.summary);
  set('상태', STATUS_VALUE);                                 // 기본 '신규'

  // 발행일(date 타입) — 속성명 자동 탐색(없으면 생략)
  const dateProp = Object.keys(schema).find((k) => schema[k] === 'date');
  if (dateProp && item.publishedAt) props[dateProp] = { date: { start: item.publishedAt } };

  // URL 타입 속성이 있으면 링크 기록(이름 후보 자동 탐색)
  const urlProp = Object.keys(schema).find((k) => schema[k] === 'url');
  if (urlProp) props[urlProp] = { url: item.url };

  return props;
}

// 페이지 본문: 요약 + 출처 링크 (카드뉴스 스킬의 'content 핵심요약' 추출 대상)
function buildChildren(item: TrendItem) {
  return [
    {
      object: 'block', type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: item.summary } }] },
    },
    {
      object: 'block', type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: `출처: ${item.sourceName} · 원문 보기`, link: { url: item.url } },
        }],
      },
    },
  ];
}

async function createPage(schema: Record<string, NotionPropType>, item: TrendItem) {
  await notion.post('/pages', {
    parent: { database_id: NOTION_DB_ID },
    properties: buildProperties(schema, item),
    children: buildChildren(item),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- 적재 ----------
export interface SinkResult { total: number; pushed: number; skipped: number; failed: number; }

export async function pushToNotion(items: TrendItem[]): Promise<SinkResult> {
  if (!NOTION_TOKEN) throw new Error('NOTION_TOKEN 환경변수가 필요합니다.');
  const schema = await getSchema();
  const db = openDedupe();
  const seen = db.prepare('SELECT 1 FROM pushed WHERE url = ?');
  const mark = db.prepare('INSERT OR IGNORE INTO pushed (url, pushed_at) VALUES (?, ?)');

  const res: SinkResult = { total: items.length, pushed: 0, skipped: 0, failed: 0 };
  for (const item of items) {
    if (seen.get(item.url)) { res.skipped++; continue; }
    try {
      await createPage(schema, item);
      mark.run(item.url, new Date().toISOString());
      res.pushed++;
      await sleep(350); // Notion rate limit(~3 req/s) 여유
    } catch (e) {
      res.failed++;
      const msg = axios.isAxiosError(e) ? JSON.stringify(e.response?.data) : (e as Error).message;
      console.warn(`[notion] 적재 실패: ${item.title} → ${msg}`);
    }
  }
  db.close();
  return res;
}

// ---------- 하이브리드 진입점: 수집 → 분류 → Notion 적재 ----------
export async function runHybridPipeline(opts: CrawlOptions = {}) {
  const items = await runTrendCrawl({ sinceDays: 7, ...opts });
  const result = await pushToNotion(items);
  console.log(`[hybrid] 수집 ${items.length}건 → 신규 적재 ${result.pushed} / 중복 ${result.skipped} / 실패 ${result.failed}`);
  return result;
}

// CLI: npm run crawl:hybrid
if (process.argv[1] && process.argv[1].includes('notionSink')) {
  runHybridPipeline()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
