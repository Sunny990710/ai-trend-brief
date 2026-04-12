import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import type { RawArticle } from './crawler.js';
import type { NewsItem } from './store.js';
import { INDUSTRY_DESCRIPTIONS, type Industry } from './crawl-config.js';

dotenv.config();
dotenv.config({ path: '.env.local' });

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.warn('[Gemini] API key not configured — skipping AI processing');
    return null;
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

interface GeminiResult {
  relevant: boolean;
  summary: string;
  insight: string;
  keywords: string[];
  impactLevel: '매우 높음' | '중간' | '낮음';
}

async function processWithGemini(article: RawArticle): Promise<GeminiResult | null> {
  const client = getAI();
  if (!client) return null;

  const industryDesc = INDUSTRY_DESCRIPTIONS[article.industry as Industry] || article.industry;
  const prompt = `당신은 "${article.industry}" 산업 전문 AI 뉴스 분석가입니다.
아래 기사가 "${article.industry}" 산업에서의 AI 활용/도입/영향에 대한 기사인지 **엄격하게** 판별하고, 맞다면 분석해주세요.

[산업군 정의]
"${article.industry}" 산업이란: ${industryDesc}

[판별 기준 - 반드시 모두 충족해야 relevant: true]
1. 기사의 핵심 주제가 위 산업군 정의에 해당하는 비즈니스/서비스와 직접적으로 관련되어야 합니다.
2. AI 기술이 해당 산업의 실제 업무·서비스·프로세스에 어떻게 적용/영향을 미치는지를 다뤄야 합니다.
3. 단순히 산업 관련 키워드가 제목이나 본문에 언급만 된 것은 관련 기사가 아닙니다.
4. AI 기업의 투자/상장/인수합병, 일반 IT 뉴스, 주식/증시, 정치/선거, 기상/날씨 등은 해당 산업 기사가 아닙니다.

산업군: ${article.industry} (${industryDesc})
기사 제목: ${article.title}
기사 내용: ${article.content.slice(0, 2000)}

다음 형식의 JSON으로만 응답하세요 (다른 텍스트 없이):
{
  "relevant": true 또는 false,
  "summary": "관련 기사라면 2-3문장의 ${article.industry} 산업 경영진 대상 핵심 요약, 아니면 빈 문자열",
  "insight": "관련 기사라면 이 기사가 ${article.industry} 산업 비즈니스에 시사하는 점 1-2문장, 아니면 빈 문자열",
  "keywords": ["관련 기사라면 키워드 3개, 아니면 빈 배열"],
  "impactLevel": "매우 높음" 또는 "중간" 또는 "낮음" (비즈니스 중요도. 매우 높음=전사 전략 수립에 반영해야 할 수준으로 경쟁사 도입·매출 직접 영향·산업 구조 변화 등, 중간=트렌드 파악·기술 동향으로 부서 차원 검토가 필요한 수준, 낮음=참고·배경지식 수준의 일반적 소식)
}`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Gemini] Failed to parse JSON from response');
      return null;
    }
    return JSON.parse(jsonMatch[0]) as GeminiResult;
  } catch (err: any) {
    console.error(`[Gemini] API error: ${err.message}`);
    return null;
  }
}

function fallbackProcess(article: RawArticle): GeminiResult {
  const sentences = article.content.split(/[.!?。]\s*/);
  const summary = sentences.slice(0, 3).join('. ').slice(0, 300);
  return {
    relevant: true,
    summary: summary || article.title,
    insight: '',
    keywords: extractFallbackKeywords(article.title),
    impactLevel: '낮음',
  };
}

export async function processArticles(articles: RawArticle[]): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  let filtered = 0;

  for (const article of articles) {
    const geminiResult = await processWithGemini(article);

    if (geminiResult && !geminiResult.relevant) {
      filtered++;
      console.log(`[Gemini] ❌ 관련 없음 → [${article.industry}] ${article.title.slice(0, 50)}...`);
      continue;
    }

    const data = geminiResult ?? fallbackProcess(article);

    const validLevels = ['매우 높음', '중간', '낮음'] as const;
    const impactLevel = validLevels.includes(data.impactLevel as any) ? data.impactLevel : '낮음';

    const newsItem: NewsItem = {
      id: `news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'article',
      industry: article.industry,
      title: article.title,
      summary: data.summary,
      fullContent: article.content,
      insight: data.insight,
      imageUrl: article.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(article.title.slice(0, 10))}/800/600`,
      date: article.date,
      keywords: data.keywords.length > 0 ? data.keywords : extractFallbackKeywords(article.title),
      source: article.sourceName,
      sourceUrl: article.sourceUrl,
      impactLevel,
      crawledAt: new Date().toISOString(),
    };

    results.push(newsItem);
  }

  if (filtered > 0) {
    console.log(`[Gemini] 관련성 필터: ${filtered}건 제외, ${results.length}건 통과`);
  }

  return results;
}

function extractFallbackKeywords(title: string): string[] {
  const aiTerms = ['AI', '인공지능', '딥러닝', '머신러닝', 'GPT', 'LLM', '생성형', '자동화', '로봇', '데이터'];
  return aiTerms.filter(term => title.includes(term)).slice(0, 3);
}
