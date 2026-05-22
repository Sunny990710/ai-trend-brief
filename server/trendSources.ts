/**
 * trendSources.ts
 * AI/IT 트렌드 뉴스 수집 소스 레지스트리.
 * 기존 크롤 파이프라인(server/)의 axios + cheerio 기반과 호환됩니다.
 *
 * 수집 우선순위: rss(명시) → discover(자동 탐색) → scrape(CSS 셀렉터)
 * - rss        : 검증되었거나 한국 언론 표준 CMS(M2) 관례 주소. (※ 표시는 실제 동작 확인 권장)
 * - discover   : 홈페이지 <link rel="alternate" type="application/rss+xml"> 자동 탐색
 * - scrape     : RSS가 없을 때 목록 페이지를 직접 파싱 (selectors 필요)
 */

export type Category =
  | 'agent'        // ① AI Agent / 업무 자동화
  | 'infra'        // ② AI Infrastructure
  | 'enterprise'   // ③ Enterprise AI
  | 'devtools'     // ④ Software Development
  | 'physical'     // ⑤ Physical AI / Robotics
  | 'risk'         // ⑥ AI Risk & Regulation
  | 'newsletter'   // ⑦ 큐레이션 뉴스레터
  | 'research'     // ⑧ 국내 연구기관·정책
  | 'bigtech'      // ⑨ 빅테크 리서치 블로그
  | 'media'        // ⑩ 종합 IT 매체
  | 'commerce';    // ⑪ 커머스·소비자 데이터

export const CATEGORY_LABELS: Record<Category, string> = {
  agent: 'AI Agent / 업무 자동화',
  infra: 'AI Infrastructure',
  enterprise: 'Enterprise AI',
  devtools: 'Software Development',
  physical: 'Physical AI / Robotics',
  risk: 'AI Risk & Regulation',
  newsletter: '큐레이션 뉴스레터',
  research: '국내 연구기관·정책',
  bigtech: '빅테크 리서치 블로그',
  media: '종합 IT 매체',
  commerce: '커머스·소비자 데이터',
};

export interface ScrapeSelectors {
  item: string;   // 기사 카드/링크 컨테이너
  title: string;  // 제목
  link: string;   // 링크 (href)
  date?: string;  // 날짜 (선택)
}

export interface Source {
  id: string;
  name: string;
  region: 'KR' | 'GLOBAL';
  category: Category;
  homepage: string;
  rss?: string;            // 명시 RSS 주소
  discover?: boolean;      // 홈페이지에서 RSS 자동 탐색 시도
  scrape?: ScrapeSelectors; // RSS 실패 시 폴백
  verified?: boolean;      // RSS 주소 실동작 검증 여부 (false면 한 번 확인 권장)
  enabled?: boolean;       // 기본 true
}

export const SOURCES: Source[] = [
  // ① AI Agent / 업무 자동화
  { id: 'skt-newsroom', name: 'SK텔레콤 뉴스룸', region: 'KR', category: 'agent', homepage: 'https://news.sktelecom.com', discover: true },
  { id: 'skax-insight', name: 'SK AX 인사이트', region: 'KR', category: 'agent', homepage: 'https://www.skax.co.kr/insight', discover: true },
  { id: 'a16z', name: 'a16z', region: 'GLOBAL', category: 'agent', homepage: 'https://a16z.com', rss: 'https://a16z.com/feed/', verified: false },
  { id: 'anthropic-news', name: 'Anthropic News', region: 'GLOBAL', category: 'agent', homepage: 'https://www.anthropic.com/news', discover: true },
  { id: 'openai-news', name: 'OpenAI News', region: 'GLOBAL', category: 'agent', homepage: 'https://openai.com/news', discover: true },
  { id: 'langchain', name: 'LangChain Blog', region: 'GLOBAL', category: 'agent', homepage: 'https://blog.langchain.dev', rss: 'https://blog.langchain.dev/rss/', verified: false },

  // ② AI Infrastructure
  { id: 'zdnet-kr', name: 'ZDNet Korea', region: 'KR', category: 'infra', homepage: 'https://zdnet.co.kr', discover: true },
  { id: 'aitimes', name: 'AI타임스', region: 'KR', category: 'infra', homepage: 'https://www.aitimes.com', rss: 'https://www.aitimes.com/rss/allArticle.xml', verified: false },
  { id: 'ibm-think', name: 'IBM Think', region: 'GLOBAL', category: 'infra', homepage: 'https://www.ibm.com/think', discover: true },
  { id: 'semianalysis', name: 'SemiAnalysis', region: 'GLOBAL', category: 'infra', homepage: 'https://semianalysis.com', rss: 'https://semianalysis.com/feed/', verified: false },
  { id: 'nvidia-blog', name: 'NVIDIA Blog', region: 'GLOBAL', category: 'infra', homepage: 'https://blogs.nvidia.com', rss: 'https://blogs.nvidia.com/feed/', verified: false },

  // ③ Enterprise AI
  { id: 'samsungsds', name: '삼성SDS 인사이트', region: 'KR', category: 'enterprise', homepage: 'https://www.samsungsds.com/kr/insights', discover: true },
  { id: 'bespin', name: '베스핀글로벌 트렌드레터', region: 'KR', category: 'enterprise', homepage: 'https://www.bespinglobal.com/trend-letter', discover: true },
  { id: 'mckinsey-qb', name: 'McKinsey (QuantumBlack)', region: 'GLOBAL', category: 'enterprise', homepage: 'https://www.mckinsey.com/capabilities/quantumblack', discover: true },
  { id: 'gartner', name: 'Gartner', region: 'GLOBAL', category: 'enterprise', homepage: 'https://www.gartner.com/en/newsroom', discover: true },
  { id: 'idc', name: 'IDC', region: 'GLOBAL', category: 'enterprise', homepage: 'https://www.idc.com', discover: true },

  // ④ Software Development
  { id: 'yozm', name: '요즘IT (위시켓)', region: 'KR', category: 'devtools', homepage: 'https://yozm.wishket.com', discover: true,
    scrape: { item: 'a[href*="/magazine/detail/"]', title: '', link: '' } },
  { id: 'naver-d2', name: '네이버 D2', region: 'KR', category: 'devtools', homepage: 'https://d2.naver.com', rss: 'https://d2.naver.com/d2.atom', verified: false },
  { id: 'kakao-tech', name: '카카오 기술블로그', region: 'KR', category: 'devtools', homepage: 'https://tech.kakao.com', rss: 'https://tech.kakao.com/feed/', verified: false },
  { id: 'pragmatic', name: 'The Pragmatic Engineer', region: 'GLOBAL', category: 'devtools', homepage: 'https://newsletter.pragmaticengineer.com', rss: 'https://newsletter.pragmaticengineer.com/feed', verified: false },
  { id: 'github-blog', name: 'GitHub Blog', region: 'GLOBAL', category: 'devtools', homepage: 'https://github.blog', rss: 'https://github.blog/feed/', verified: false },

  // ⑤ Physical AI / Robotics
  { id: 'igloo', name: '이글루코퍼레이션 AI Report', region: 'KR', category: 'physical', homepage: 'https://www.igloo.co.kr/security-information', discover: true },
  { id: 'zdnet-robot', name: 'ZDNet Korea (로봇)', region: 'KR', category: 'physical', homepage: 'https://zdnet.co.kr', discover: true },
  { id: 'nvidia-robotics', name: 'NVIDIA Robotics', region: 'GLOBAL', category: 'physical', homepage: 'https://blogs.nvidia.com/blog/category/robotics/', rss: 'https://blogs.nvidia.com/feed/', verified: false },

  // ⑥ AI Risk & Regulation
  { id: 'msit', name: '과학기술정보통신부', region: 'KR', category: 'risk', homepage: 'https://www.msit.go.kr', discover: true },
  { id: 'boannews', name: '보안뉴스', region: 'KR', category: 'risk', homepage: 'https://www.boannews.com', rss: 'https://www.boannews.com/media/rss.xml', discover: true, verified: true },
  { id: 'shinkim', name: '신&김 뉴스레터', region: 'KR', category: 'risk', homepage: 'https://www.shinkim.com/kor/media/newsletter', discover: true },
  { id: 'minwho', name: '법무법인 민후', region: 'KR', category: 'risk', homepage: 'https://minwho.kr', discover: true },
  { id: 'hai-index', name: 'Stanford HAI — AI Index', region: 'GLOBAL', category: 'risk', homepage: 'https://hai.stanford.edu/news', discover: true },

  // ⑦ 큐레이션 뉴스레터
  { id: 'the-batch', name: 'The Batch (DeepLearning.AI)', region: 'GLOBAL', category: 'newsletter', homepage: 'https://www.deeplearning.ai/the-batch', discover: true },
  { id: 'import-ai', name: 'Import AI (Jack Clark)', region: 'GLOBAL', category: 'newsletter', homepage: 'https://importai.substack.com', rss: 'https://importai.substack.com/feed', verified: true },
  { id: 'tldr-ai', name: 'TLDR AI', region: 'GLOBAL', category: 'newsletter', homepage: 'https://tldr.tech/ai', discover: true },
  { id: 'themiilk', name: '더밀크 (The Miilk)', region: 'KR', category: 'newsletter', homepage: 'https://themiilk.com', discover: true },

  // ⑧ 국내 연구기관·정책
  { id: 'spri', name: 'SPRi 소프트웨어정책연구소', region: 'KR', category: 'research', homepage: 'https://spri.kr', discover: true },
  { id: 'nia', name: '한국지능정보사회진흥원(NIA)', region: 'KR', category: 'research', homepage: 'https://www.nia.or.kr', discover: true },
  { id: 'iitp', name: 'IITP 주간기술동향', region: 'KR', category: 'research', homepage: 'https://www.iitp.kr', discover: true },

  // ⑨ 빅테크 리서치 블로그
  { id: 'deepmind', name: 'Google DeepMind Blog', region: 'GLOBAL', category: 'bigtech', homepage: 'https://deepmind.google/discover/blog', discover: true },
  { id: 'meta-ai', name: 'Meta AI Blog', region: 'GLOBAL', category: 'bigtech', homepage: 'https://ai.meta.com/blog', discover: true },
  { id: 'ms-research', name: 'Microsoft Research Blog', region: 'GLOBAL', category: 'bigtech', homepage: 'https://www.microsoft.com/en-us/research/blog', rss: 'https://www.microsoft.com/en-us/research/feed/', verified: false },
  { id: 'hf-blog', name: 'Hugging Face Blog', region: 'GLOBAL', category: 'bigtech', homepage: 'https://huggingface.co/blog', rss: 'https://huggingface.co/blog/feed.xml', verified: false },

  // ⑩ 종합 IT 매체
  { id: 'etnews', name: '전자신문 (ETNews)', region: 'KR', category: 'media', homepage: 'https://www.etnews.com', rss: 'http://rss.etnews.co.kr/Section901.xml', verified: true },
  { id: 'bloter', name: '블로터 (Bloter)', region: 'KR', category: 'media', homepage: 'https://www.bloter.net', rss: 'https://www.bloter.net/rss/allArticle.xml', verified: false },
  { id: 'ddaily', name: '디지털데일리', region: 'KR', category: 'media', homepage: 'https://www.ddaily.co.kr', rss: 'https://www.ddaily.co.kr/rss/allArticle.xml', verified: false },

  // ⑪ 커머스·소비자 데이터
  { id: 'opensurvey', name: '오픈서베이 트렌드리포트', region: 'KR', category: 'commerce', homepage: 'https://blog.opensurvey.co.kr', rss: 'https://blog.opensurvey.co.kr/feed/', verified: false },
  { id: 'criteo', name: 'Criteo 커머스 AI 리포트', region: 'GLOBAL', category: 'commerce', homepage: 'https://www.criteo.com/kr/insights/', discover: true },
];

export const enabledSources = () => SOURCES.filter((s) => s.enabled !== false);
