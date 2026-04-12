export const INDUSTRIES = [
  '패션', '유통', '외식', '건설', '레저', '물류', '콘텐츠', '온라인',
  '재무', '인사', '법무', '홍보', '금융', '인테리어', '스포츠', 'IT',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_SEARCH_QUERIES: Record<Industry, string[]> = {
  '패션':     ['AI 패션', '인공지능 패션 의류'],
  '유통':     ['AI 유통', '인공지능 유통 리테일'],
  '외식':     ['AI 외식', 'AI 요식업 레스토랑'],
  '건설':     ['AI 건설', '인공지능 건설 스마트건설'],
  '레저':     ['AI 호텔 관광', 'AI 여행 박물관'],
  '물류':     ['AI 물류', '인공지능 물류 배송'],
  '콘텐츠':   ['AI 콘텐츠', '생성형AI 콘텐츠 미디어'],
  '온라인':   ['AI 커머스', 'AI 이커머스 온라인쇼핑'],
  '재무':     ['AI 재무', 'AI 회계 재무관리'],
  '인사':     ['AI 인사', 'AI 채용 HR'],
  '법무':     ['AI 법무', 'AI 리걸테크 법률'],
  '홍보':     ['AI 홍보', 'AI 마케팅 PR'],
  '금융':     ['AI 금융', '인공지능 핀테크 은행'],
  '인테리어': ['AI 인테리어', 'AI 디자인 인테리어'],
  '스포츠':   ['AI 스포츠', '인공지능 스포츠 경기분석'],
  'IT':       ['AI 코딩', 'Claude GPT 개발', 'AI 자동화 클로드', 'AI 프로그래밍 개발자'],
};

export const INDUSTRY_DESCRIPTIONS: Record<Industry, string> = {
  '패션':     '의류, 패션 브랜드, 패션 디자인, 의류 제조·유통, 패션 트렌드 예측',
  '유통':     '대형마트, 편의점, 백화점 등 오프라인·온라인 유통채널, 리테일',
  '외식':     '레스토랑, 카페, 프랜차이즈 외식업, 식품 서비스, 배달 음식',
  '건설':     '건축, 토목, 부동산 개발, 스마트 건설, 건설 자재·장비',
  '레저':     '호텔, 관광, 여행, 박물관, 리조트, 테마파크, 항공사, 숙박, 관광지',
  '물류':     '택배, 화물 운송, 창고 관리, 공급망(SCM), 배송',
  '콘텐츠':   '영상, 음악, 게임, 웹툰, 방송, 미디어 콘텐츠 제작·유통',
  '온라인':   '이커머스, 온라인쇼핑몰, 라이브커머스, 소셜커머스',
  '재무':     '기업 회계, 재무관리, 세무, 감사, 재무 분석',
  '인사':     '채용, 인재관리, HR테크, 인사평가, 근무환경',
  '법무':     '법률 서비스, 리걸테크, 규제·컴플라이언스, 계약 관리',
  '홍보':     '기업 홍보, PR, 브랜드 커뮤니케이션, 미디어 홍보',
  '금융':     '은행, 보험, 증권, 핀테크, 자산관리, 금융 서비스',
  '인테리어': '실내 디자인, 인테리어 시공, 가구, 홈스타일링',
  '스포츠':   '스포츠 경기, 선수 트레이닝, 팬 경험, 스포츠 데이터 분석',
  'IT':       'AI 코딩, 소프트웨어 개발, Claude, ChatGPT, 프로그래밍, 개발자 도구, LLM, 자동화, 클로드',
};

export const TITLE_FILTER_KEYWORDS = ['AI', '인공지능', 'ai', 'A.I', '클로드', 'Claude', 'GPT', '자동화'];

export const INDUSTRY_EXTRA_KEYWORDS: Partial<Record<Industry, string[]>> = {
  '패션': ['Zara', '자라'],
  '유통': ['Amazon', '아마존', 'Target', '타겟'],
};

export const PREFERRED_CHANNELS: Partial<Record<Industry, string[]>> = {
  'IT': ['티타임즈', '코드팩토리'],
};

export const CRAWL_DELAY_MS = 2500;
export const MAX_ARTICLES_PER_INDUSTRY = 5;
export const NAVER_SEARCH_PAGES = 2;
export const MAX_VIDEOS_PER_INDUSTRY = 2;
