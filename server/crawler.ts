import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  INDUSTRIES,
  INDUSTRY_SEARCH_QUERIES,
  TITLE_FILTER_KEYWORDS,
  INDUSTRY_EXTRA_KEYWORDS,
  CRAWL_DELAY_MS,
  MAX_ARTICLES_PER_INDUSTRY,
  NAVER_SEARCH_PAGES,
  type Industry,
} from './crawl-config.js';
import { getExistingUrls, getExistingTitles } from './store.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface RawArticle {
  title: string;
  content: string;
  date: string;
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  industry: Industry;
}

interface NaverNewsItem {
  title: string;
  url: string;
  sourceName: string;
  date: string;
  description: string;
}

function titleMatchesKeywords(title: string, industry?: Industry): boolean {
  if (TITLE_FILTER_KEYWORDS.some(kw => title.toLowerCase().includes(kw.toLowerCase()))) return true;
  if (industry) {
    const extra = INDUSTRY_EXTRA_KEYWORDS[industry];
    if (extra?.some(kw => title.toLowerCase().includes(kw.toLowerCase()))) return true;
  }
  return false;
}

function normalizeForComparison(title: string): string {
  return title
    .replace(/\[.*?\]/g, '')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractCorePhrase(title: string): string {
  const norm = normalizeForComparison(title);
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'to', 'for',
    '의', '이', '가', '은', '는', '을', '를', '에', '도', '로', '와', '과', '등', '및']);
  return norm
    .split(' ')
    .filter(w => w.length > 1 && !stopWords.has(w))
    .join(' ');
}

function isSimilarTitle(a: string, b: string): boolean {
  const na = normalizeForComparison(a);
  const nb = normalizeForComparison(b);
  if (na === nb) return true;

  const coreA = extractCorePhrase(a);
  const coreB = extractCorePhrase(b);
  if (coreA === coreB) return true;

  if (coreA.length > 10 && coreB.length > 10) {
    if (coreA.includes(coreB) || coreB.includes(coreA)) return true;
  }

  const wordsA = new Set(na.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const similarity = overlap / Math.min(wordsA.size, wordsB.size);
  return similarity >= 0.55;
}

function buildNaverSearchUrl(query: string, start: number): string {
  const q = encodeURIComponent(query);
  return `https://search.naver.com/search.naver?where=news&query=${q}&sort=1&pd=4&start=${start}`;
}

async function fetchNaverNewsPage(query: string, start: number): Promise<NaverNewsItem[]> {
  const url = buildNaverSearchUrl(query, start);
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15_000,
      responseType: 'text',
    });

    const $ = cheerio.load(res.data);
    const items: NaverNewsItem[] = [];
    const seen = new Set<string>();

    $('a').each((_i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (!href.startsWith('http')) return;
      if (href.includes('naver.com') || href.includes('mkt.naver') || href.includes('naver.me')) return;
      if (text.length < 15 || text.length > 200) return;
      if (seen.has(href)) return;
      seen.add(href);

      items.push({
        title: text,
        url: href,
        sourceName: extractSourceName(href),
        date: '',
        description: '',
      });
    });

    return items;
  } catch (err: any) {
    console.error(`[Crawler] Naver search failed for "${query}" start=${start}: ${err.message}`);
    return [];
  }
}

function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const domainMap: Record<string, string> = {
      'chosun.com': '조선일보',
      'donga.com': '동아일보',
      'joins.com': '중앙일보',
      'hankyung.com': '한국경제',
      'mk.co.kr': '매일경제',
      'etnews.com': '전자신문',
      'zdnet.co.kr': 'ZDNet Korea',
      'aitimes.com': 'AI타임스',
      'bloter.net': '블로터',
      'fnnews.com': '파이낸셜뉴스',
      'sedaily.com': '서울경제',
      'edaily.co.kr': '이데일리',
      'dt.co.kr': '디지털타임스',
      'newspim.com': '뉴스핌',
      'ajunews.com': '아주경제',
      'econovill.com': '이코노믹리뷰',
      'biz.chosun.com': '조선비즈',
      'news.mt.co.kr': '머니투데이',
      'mt.co.kr': '머니투데이',
      'inews24.com': '아이뉴스24',
      'ddaily.co.kr': '디지털데일리',
      'tokenpost.kr': '토큰포스트',
    };
    for (const [domain, name] of Object.entries(domainMap)) {
      if (hostname.includes(domain)) return name;
    }
    return hostname.split('.')[0];
  } catch {
    return '뉴스';
  }
}

function decodeHtml(data: Buffer, headers: Record<string, string>): string {
  const raw = data.toString('latin1');
  const charsetMatch =
    (headers['content-type'] || '').match(/charset=([^\s;]+)/i)?.[1] ||
    raw.match(/<meta[^>]+charset=["']?([^"'\s;>]+)/i)?.[1];
  const charset = (charsetMatch || 'utf-8').trim().toLowerCase();

  if (charset === 'utf-8' || charset === 'utf8') {
    return data.toString('utf-8');
  }
  const decoder = new TextDecoder(charset, { fatal: false });
  return decoder.decode(data);
}

export async function scrapeArticleContent(url: string): Promise<{
  content: string;
  imageUrl: string;
  date: string;
  title: string;
} | null> {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      timeout: 15_000,
      responseType: 'arraybuffer',
    });
    const html = decodeHtml(Buffer.from(res.data), res.headers as Record<string, string>);
    const $ = cheerio.load(html);

    $('script, style, iframe, nav, header, footer, .ad, .advertisement, .social-share, .related-articles, .comment').remove();

    // Extract the real title from the article page
    const pageTitle =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      $('title').text().trim();

    // Try multiple content selectors (most specific first)
    const contentSelectors = [
      '#article-view-content-div',
      '#articleBodyContents',
      '#articeBody',
      '#newsEndContents',
      '.article-body',
      '.article_body',
      '.article_cont',
      '.article-content',
      '.news-content',
      '.news_body',
      '.post-content',
      '.entry-content',
      '.td-post-content',
      '.view-body',
      '#articleBody',
      'article',
      '[itemprop="articleBody"]',
      '.story-body',
      '.view_cont',
      '.view_txt',
      '#contents',
    ];

    let content = '';
    for (const sel of contentSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().replace(/\s+/g, ' ').trim();
        if (text.length > content.length) content = text;
      }
    }

    // Fallback: paragraph tags within article-like containers
    if (!content || content.length < 100) {
      const paragraphs: string[] = [];
      $('article p, .article p, .content p, main p').each((_i, el) => {
        const text = $(el).text().trim();
        if (text.length > 30) paragraphs.push(text);
      });
      if (paragraphs.length > 0) {
        content = paragraphs.join(' ');
      }
    }

    // Fallback: meta description
    if (!content || content.length < 100) {
      content =
        $('meta[property="og:description"]').attr('content')?.trim() ||
        $('meta[name="description"]').attr('content')?.trim() ||
        '';
    }

    // Get image
    let imageUrl = $('meta[property="og:image"]').attr('content')?.trim() || '';
    if (!imageUrl) {
      const firstImg = $('article img, .article-body img, .entry-content img, .article_body img').first();
      imageUrl = firstImg.attr('src') || firstImg.attr('data-src') || '';
    }
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch { /* skip */ }
    }

    // Get date
    let date =
      $('meta[property="article:published_time"]').attr('content')?.trim() ||
      $('meta[name="article:published_time"]').attr('content')?.trim() ||
      $('meta[property="og:article:published_time"]').attr('content')?.trim() ||
      $('time[datetime]').first().attr('datetime')?.trim() ||
      '';

    if (!content || content.length < 50) return null;

    return {
      content: content.slice(0, 5000),
      imageUrl,
      date,
      title: pageTitle,
    };
  } catch (err: any) {
    console.warn(`[Crawler] Failed to scrape ${url}: ${err.message}`);
    return null;
  }
}

function normalizeDate(raw: string): string {
  if (!raw) {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }
  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}.${isoMatch[2]}.${isoMatch[3]}`;
  const dotMatch = raw.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dotMatch) return `${dotMatch[1]}.${dotMatch[2]}.${dotMatch[3]}`;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }
  } catch { /* fall through */ }
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

async function crawlIndustry(industry: Industry): Promise<RawArticle[]> {
  const queries = INDUSTRY_SEARCH_QUERIES[industry];
  console.log(`[Crawler] 🔍 [${industry}] 검색어: ${queries.join(', ')}`);

  const existingUrls = getExistingUrls();
  const existingTitles = getExistingTitles();
  const allItems: NaverNewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    for (let page = 0; page < NAVER_SEARCH_PAGES; page++) {
      const start = page * 10 + 1;
      const items = await fetchNaverNewsPage(query, start);
      for (const item of items) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allItems.push(item);
        }
      }
      if (items.length < 5) break;
      await sleep(CRAWL_DELAY_MS);
    }
    await sleep(CRAWL_DELAY_MS);
  }

  const aiItems = allItems.filter(item => titleMatchesKeywords(item.title, industry));
  console.log(`[Crawler] ${allItems.length}건 중 제목에 AI 포함: ${aiItems.length}건`);

  const articles: RawArticle[] = [];
  const collectedTitles: string[] = [];

  for (const item of aiItems) {
    if (articles.length >= MAX_ARTICLES_PER_INDUSTRY) break;
    if (existingUrls.has(item.url)) continue;

    const isDupOfExisting = existingTitles.some(t => isSimilarTitle(t, item.title));
    const isDupOfCollected = collectedTitles.some(t => isSimilarTitle(t, item.title));
    if (isDupOfExisting || isDupOfCollected) {
      console.log(`[Crawler] 🔄 [${industry}] 유사 기사 건너뜀: ${item.title.slice(0, 50)}...`);
      continue;
    }

    const scraped = await scrapeArticleContent(item.url);
    if (!scraped) {
      console.warn(`[Crawler] ⚠️ [${industry}] 콘텐츠 스크래핑 실패: ${item.title.slice(0, 40)}...`);
      continue;
    }

    const finalTitle = scraped.title || item.title;

    const isDupFinalOfExisting = existingTitles.some(t => isSimilarTitle(t, finalTitle));
    const isDupFinalOfCollected = collectedTitles.some(t => isSimilarTitle(t, finalTitle));
    if (isDupFinalOfExisting || isDupFinalOfCollected) {
      console.log(`[Crawler] 🔄 [${industry}] 유사 기사 건너뜀 (스크래핑 후): ${finalTitle.slice(0, 50)}...`);
      continue;
    }

    collectedTitles.push(finalTitle);
    collectedTitles.push(item.title);

    articles.push({
      title: finalTitle,
      content: scraped.content,
      date: normalizeDate(scraped.date),
      imageUrl: scraped.imageUrl,
      sourceUrl: item.url,
      sourceName: item.sourceName,
      industry,
    });

    console.log(`[Crawler] ✅ [${industry}] ${finalTitle.slice(0, 60)}...`);
    await sleep(CRAWL_DELAY_MS);
  }

  return articles;
}

export async function crawlAllSites(): Promise<RawArticle[]> {
  const allArticles: RawArticle[] = [];

  for (const industry of INDUSTRIES) {
    try {
      const articles = await crawlIndustry(industry);
      for (const article of articles) {
        const dupAcrossIndustries = allArticles.some(a => isSimilarTitle(a.title, article.title));
        if (dupAcrossIndustries) {
          console.log(`[Crawler] 🔄 산업군 간 중복 건너뜀: ${article.title.slice(0, 50)}...`);
          continue;
        }
        allArticles.push(article);
      }
      console.log(`[Crawler] [${industry}] ${articles.length}건 수집 완료`);
    } catch (err: any) {
      console.error(`[Crawler] [${industry}] 오류: ${err.message}`);
    }
    await sleep(CRAWL_DELAY_MS);
  }

  console.log(`[Crawler] === 전체 수집 완료: ${allArticles.length}건 ===`);
  return allArticles;
}

export function classifyIndustry(title: string, content: string): Industry {
  return '온라인';
}
