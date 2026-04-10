import React, { useState, useEffect } from 'react';
import { Search, Menu, ChevronRight, ChevronLeft, PlayCircle, FileText, TrendingUp, Filter, X, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Mock Data ---
const INDUSTRIES = [
  '패션', '유통', '외식', '건설', '레저', '물류', '콘텐츠', '온라인', 
  '재무', '인사', '법무', '홍보', '금융', '인테리어', '스포츠'
];

const CONTENT_FEED = [
  {
    id: 'c1',
    type: 'article',
    industry: '패션',
    title: 'AI가 디자인하고 피팅까지... 패션업계 덮친 생성형 AI 혁명',
    summary: '디자인 기획부터 마케팅, 고객 맞춤형 추천까지 패션 밸류체인 전반에 AI가 도입되며 리드타임이 획기적으로 단축되고 있습니다. 경영진이 주목해야 할 패션 테크 스타트업 동향을 분석합니다.',
    fullContent: '최근 패션 업계에서는 생성형 AI를 활용한 디자인 기획이 본격화되고 있습니다. 과거 수개월이 걸리던 디자인 스케치와 샘플 제작 과정이 AI를 통해 단 며칠, 빠르면 몇 시간 만에 완료되고 있습니다. 특히 고객의 체형 데이터를 기반으로 한 가상 피팅 기술은 반품률을 획기적으로 낮추며 수익성 개선에 크게 기여하고 있습니다. 또한, 트렌드 예측 알고리즘을 통해 재고 부담을 최소화하는 스마트 SCM(공급망 관리) 시스템 도입도 가속화되는 추세입니다.',
    insight: '패션 기업의 핵심 경쟁력이 "디자이너의 직관"에서 "데이터 기반의 AI 활용 능력"으로 이동하고 있습니다. 경영진은 AI 솔루션 도입을 단순한 비용 절감이 아닌, 새로운 고객 경험 창출과 비즈니스 모델 혁신의 관점에서 접근해야 합니다.',
    imageUrl: 'https://picsum.photos/seed/fashion/800/600',
    date: '2024.05.20',
    keywords: ['생성형AI', '초개인화', '버추얼휴먼'],
    source: 'AI Fashion Report'
  },
  {
    id: 'c2',
    type: 'video',
    industry: '유통',
    title: '아마존도 놀란 한국의 무인 매장 솔루션, 비전 AI의 현재',
    summary: '카메라와 센서 퓨전 기술을 활용한 완전 무인 결제 시스템의 발전. 리테일 매장의 운영 효율성을 극대화하는 비전 AI 기술의 현주소와 도입 시 고려사항을 다룹니다.',
    imageUrl: 'https://picsum.photos/seed/retail/800/600',
    date: '2024.05.18',
    keywords: ['스마트스토어', '무인화', '비전AI'],
    source: 'Retail Tech TV',
    duration: '12:45'
  },
  {
    id: 'c3',
    type: 'article',
    industry: '외식',
    title: '로봇 셰프부터 AI 상권 분석까지, 푸드테크 3.0 시대',
    summary: '단순 서빙 로봇을 넘어 조리 자동화, AI 기반 식자재 수요 예측 등 F&B 산업의 수익 구조를 혁신하는 데이터 기반 의사결정 사례를 심층 분석합니다.',
    fullContent: '외식 산업의 고질적인 문제인 인력난과 식자재 비용 상승을 해결하기 위해 푸드테크가 진화하고 있습니다. 단순 서빙을 담당하던 로봇은 이제 주방으로 들어와 튀김, 볶음 등 조리 과정을 자동화하는 "로봇 셰프"로 발전했습니다. 더불어 AI 기반의 상권 분석 시스템은 유동 인구, 날씨, 주변 이벤트 등 다양한 변수를 고려하여 일별, 시간대별 메뉴 수요를 정확하게 예측합니다. 이를 통해 식자재 폐기율을 줄이고 재고 관리 효율을 극대화하고 있습니다.',
    insight: '푸드테크의 핵심은 "맛의 일관성 유지"와 "운영 효율성 극대화"입니다. 초기 투자 비용이 발생하더라도, 장기적인 관점에서 인건비 절감과 수익성 개선 효과를 면밀히 분석하여 단계적인 AI 및 로보틱스 도입 전략을 수립해야 합니다.',
    imageUrl: 'https://picsum.photos/seed/food/800/600',
    date: '2024.05.15',
    keywords: ['로보틱스', '수요예측', '자동화'],
    source: 'Food Insight'
  },
  {
    id: 'c4',
    type: 'article',
    industry: '건설',
    title: '중대재해처벌법 대응의 열쇠, AI 기반 스마트 건설 안전 플랫폼',
    summary: 'CCTV 영상 분석을 통한 위험 상황 실시간 감지, 디지털 트윈을 활용한 공정 시뮬레이션 등 건설 현장의 안전과 생산성을 동시에 잡는 AI 솔루션 트렌드.',
    fullContent: '중대재해처벌법 시행 이후 건설 현장의 안전 관리가 기업 생존의 필수 요소로 자리 잡았습니다. 이에 따라 CCTV 영상과 비전 AI 기술을 결합하여 근로자의 안전모 미착용, 위험 구역 접근, 중장비 충돌 위험 등을 실시간으로 감지하고 경고하는 스마트 안전 플랫폼 도입이 급증하고 있습니다. 또한, 디지털 트윈 기술을 활용해 가상 공간에서 시공 과정을 미리 시뮬레이션함으로써 잠재적인 위험 요소를 사전에 제거하고 공정을 최적화하는 사례도 늘고 있습니다.',
    insight: '안전 관리는 더 이상 사후 대응이 아닌 "사전 예방"의 영역입니다. AI 기술을 활용한 데이터 기반의 안전 관리 시스템 구축은 중대재해 리스크를 최소화할 뿐만 아니라, 궁극적으로 공기 단축과 품질 향상으로 이어지는 핵심 투자입니다.',
    imageUrl: 'https://picsum.photos/seed/construction/800/600',
    date: '2024.05.12',
    keywords: ['안전관리', '디지털트윈', '빅데이터'],
    source: 'Construction Daily'
  },
  {
    id: 'c5',
    type: 'video',
    industry: '레저',
    title: '여행 일정도 AI가 짜준다? 초개인화 트래블 테크의 부상',
    summary: '고객의 과거 여행 데이터와 실시간 상황을 분석해 최적의 동선과 상품을 제안하는 AI 추천 알고리즘. OTA(온라인 여행사)들의 기술 경쟁 현황.',
    imageUrl: 'https://picsum.photos/seed/travel/800/600',
    date: '2024.05.10',
    keywords: ['초개인화', 'CX혁신', '생성형AI'],
    source: 'Travel Future',
    duration: '08:20'
  }
];

export default function App() {
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(['패션']);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  useEffect(() => {
    if (selectedArticle) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedArticle]);

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries(prev => 
      prev.includes(industry) 
        ? prev.filter(i => i !== industry)
        : [...prev, industry]
    );
  };

  const filteredContent = CONTENT_FEED.filter(item => {
    const matchIndustry = selectedIndustries.length === 0 || selectedIndustries.includes(item.industry);
    return matchIndustry;
  });

  const filteredArticles = filteredContent.filter(item => item.type === 'article');
  const filteredVideos = filteredContent.filter(item => item.type === 'video');

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div 
              className="text-3xl font-extrabold tracking-tighter text-brand-dark flex items-center cursor-pointer"
              onClick={() => setSelectedArticle(null)}
            >
              AI<span className="text-brand-blue ml-[4px]">Trend</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
              <a href="#" className="hover:text-brand-dark transition-colors">인사이트 리포트</a>
              <a href="#" className="hover:text-brand-dark transition-colors">산업별 트렌드</a>
              <a href="#" className="hover:text-brand-dark transition-colors">북마크</a>
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
              <button className="p-2 text-gray-400 hover:text-brand-dark transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <button className="hidden md:flex items-center justify-center px-4 py-2 rounded-full bg-brand-blue text-white text-sm font-bold hover:bg-[#0044CC] transition-colors shadow-sm">
                로그인
              </button>
              <button className="md:hidden p-2 text-gray-400 hover:text-brand-dark transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {selectedArticle ? (
        <article className="w-full bg-white pb-20 min-h-screen">
          {/* Hero Image */}
          <div className="w-full h-[40vh] md:h-[50vh] relative overflow-hidden bg-gray-100">
            <img 
              src={selectedArticle.imageUrl} 
              alt={selectedArticle.title} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
            />
          </div>
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Metadata */}
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
              <span>원본사이트 : <span className="font-bold text-brand-dark">{selectedArticle.source}</span></span>
              <span className="text-gray-300">|</span>
              <span>{selectedArticle.date}</span>
            </div>
            
            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-8 leading-tight">
              {selectedArticle.title}
            </h1>
            
            {/* Summary */}
            <p className="text-lg md:text-xl font-bold text-gray-800 leading-relaxed mb-10">
              {selectedArticle.summary}
            </p>
            
            {/* Full Content */}
            <div className="prose prose-lg max-w-none text-gray-700 leading-loose mb-16">
              <p>{selectedArticle.fullContent}</p>
            </div>
            
            {/* Insight */}
            {selectedArticle.insight && (
              <div className="mt-12">
                <h3 className="text-xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                  <span className="bg-yellow-100 px-2 py-1 rounded-md">인사이트 도출</span> <span className="text-2xl">💡</span>
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {selectedArticle.insight}
                </p>
              </div>
            )}

            {/* Keywords */}
            <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-gray-100">
              {selectedArticle.keywords.map((kw: string) => (
                <span key={kw} className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-md">
                  #{kw}
                </span>
              ))}
            </div>
          </div>
        </article>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Hero Section */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-2">
              이번주 <span className="text-white bg-brand-blue px-2 py-0.5 rounded-md inline-block transform -skew-x-6">HOT</span> 트렌드🔥
            </h2>
            <p className="text-gray-500 font-medium">AI Trend로 신속하게 파악하세요</p>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[21/9] md:aspect-[21/7] group cursor-pointer">
            <img 
              src="https://picsum.photos/seed/business/1600/600" 
              alt="AI Trend Hero" 
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6 md:p-10">
              <span className="inline-block px-3 py-1 bg-brand-blue text-white text-xs font-bold rounded-full mb-4 w-max">
                Weekly Insight
              </span>
              <h3 className="text-2xl md:text-4xl font-bold text-white mb-4 max-w-3xl leading-tight">
                경영진이 알아야 할 2024 하반기 산업별 AI 도입 성공 사례 5선
              </h3>
              <div className="flex items-center text-gray-300 text-sm gap-4">
                <span>AI Trend Brief Research</span>
                <span>•</span>
                <span>5 min read</span>
              </div>
            </div>
            
            {/* Carousel Controls (Visual only for prototype) */}
            <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </section>

        {/* Industries Section */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-brand-dark flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-blue" />
              산업군별 트렌드
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <select className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue w-full sm:w-auto">
                <option>전체 기간</option>
                <option>최근 1주일</option>
                <option>최근 1개월</option>
                <option>최근 3개월</option>
                <option>최근 1년</option>
              </select>
              <div className="relative w-full sm:w-64">
                <input 
                  type="text" 
                  placeholder="제목을 입력해주세요." 
                  className="w-full border border-gray-200 rounded-md pl-3 pr-10 py-1.5 text-sm text-gray-600 bg-gray-50 focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-blue">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
            <button
              onClick={() => setSelectedIndustries([])}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                ${selectedIndustries.length === 0 
                  ? 'bg-brand-blue text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
              `}
            >
              전체
            </button>
            {INDUSTRIES.map((industry) => {
              const isSelected = selectedIndustries.includes(industry);
              return (
                <button
                  key={industry}
                  onClick={() => toggleIndustry(industry)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                    ${isSelected 
                      ? 'bg-brand-blue text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                  `}
                >
                  {industry}
                </button>
              );
            })}
          </div>
        </section>

        {/* Articles Section (Horizontal) */}
        <section className="mb-16">
          {/* Feed Header / Sort */}
          <div className="flex items-center justify-between border-b border-gray-200 mb-6 pb-4 text-sm">
            <p className="text-gray-600">
              총 <span className="text-brand-blue font-bold">{filteredArticles.length}</span> 개의 게시물이 있습니다.
            </p>
            <div className="flex items-center gap-2 text-gray-500">
              <button className="text-brand-dark font-medium hover:text-brand-blue transition-colors">최신순</button>
              <span className="text-gray-300">|</span>
              <button className="hover:text-brand-dark transition-colors">인기순</button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <AnimatePresence mode="popLayout">
              {filteredArticles.map((item) => (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setSelectedArticle(item)}
                  className="group cursor-pointer flex flex-col md:flex-row gap-6 border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="w-full md:w-1/3 lg:w-1/4 aspect-[4/3] md:aspect-auto md:h-40 rounded-xl overflow-hidden relative shrink-0">
                    <img 
                      src={item.imageUrl} 
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-brand-dark text-xs font-bold rounded-md shadow-sm">
                        {item.industry}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col py-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">{item.source}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-500">{item.date}</span>
                    </div>
                    
                    <h3 className="text-lg md:text-xl font-bold text-brand-dark mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">
                      {item.title}
                    </h3>
                    
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                      {item.summary}
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {item.keywords.map(kw => (
                        <span key={kw} className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            
            {filteredArticles.length === 0 && (
              <div className="py-20 text-center text-gray-500 border border-gray-100 rounded-2xl">
                선택한 조건에 맞는 기사가 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* Recommended Videos Section (Grid) */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold text-brand-dark flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-brand-blue" />
              추천 영상
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <select className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue w-full sm:w-auto">
                <option>전체 기간</option>
                <option>최근 1주일</option>
                <option>최근 1개월</option>
                <option>최근 3개월</option>
                <option>최근 1년</option>
              </select>
              <div className="relative w-full sm:w-64">
                <input 
                  type="text" 
                  placeholder="제목을 입력해주세요." 
                  className="w-full border border-gray-200 rounded-md pl-3 pr-10 py-1.5 text-sm text-gray-600 bg-gray-50 focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-blue">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-6 text-sm">
            <p className="text-gray-600">
              총 <span className="text-brand-blue font-bold">{filteredVideos.length}</span> 개의 게시물이 있습니다.
            </p>
            <div className="flex items-center gap-2 text-gray-500">
              <button className="text-brand-dark font-medium hover:text-brand-blue transition-colors">최신순</button>
              <span className="text-gray-300">|</span>
              <button className="hover:text-brand-dark transition-colors">조회순</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <AnimatePresence mode="popLayout">
              {filteredVideos.map((item) => (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="group cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-gray-100">
                    <img 
                      src={item.imageUrl} 
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                      <PlayCircle className="w-12 h-12 text-white opacity-90" />
                    </div>
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-brand-dark text-xs font-bold rounded-md shadow-sm">
                        {item.industry}
                      </span>
                    </div>
                    {item.duration && (
                      <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded-md">
                        {item.duration}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <PlayCircle className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">{item.source}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-500">{item.date}</span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-brand-dark mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">
                      {item.title}
                    </h3>
                    
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                      {item.summary}
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {item.keywords.map(kw => (
                        <span key={kw} className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            
            {filteredVideos.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-500">
                선택한 조건에 맞는 영상이 없습니다.
              </div>
            )}
          </div>
        </section>
      </main>
      )}

      {/* Footer */}
      <footer className="bg-brand-dark text-gray-400 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-extrabold tracking-tighter text-white flex items-center">
            AI<span className="text-brand-blue ml-[4px]">Trend</span>
          </div>
          <div className="text-sm text-center md:text-left">
            <p>디지털 시대의 새로운 핵심, 단순 트렌드 분석을 넘어 인사이트를 제시해주는 똑똑한 AI</p>
            <p className="mt-2 text-gray-500">© 2024 AI Trend Brief. All rights reserved.</p>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">이용약관</a>
            <a href="#" className="hover:text-white transition-colors">개인정보처리방침</a>
          </div>
        </div>
      </footer>

      {/* Global Styles for hide-scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
