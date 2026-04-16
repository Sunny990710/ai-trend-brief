import React, { useState, useEffect, useCallback } from 'react';
import { Search, Menu, ChevronRight, ChevronLeft, PlayCircle, FileText, TrendingUp, Loader2, Calendar, Bookmark, BookmarkCheck, X, User, LogOut, Shield, Users, BarChart3, Trash2, Plus, Link, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INDUSTRIES = [
  '패션', '유통', '외식', '건설', '레저', '물류', '콘텐츠', '온라인', 
  '재무', '인사', '법무', '홍보', '금융', '인테리어', '스포츠', 'IT'
];

interface NewsItem {
  id: string;
  type: 'article' | 'video';
  industry: string;
  title: string;
  summary: string;
  fullContent: string;
  insight: string;
  imageUrl: string;
  date: string;
  keywords: string[];
  source: string;
  sourceUrl?: string;
  duration?: string;
  viewCount?: number;
  impactLevel?: '매우 높음' | '중간' | '낮음';
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  department?: string;
  isAdmin?: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  department: string;
  isAdmin: boolean;
  createdAt: string;
  bookmarkCount: number;
  industryInterest: Record<string, number>;
  bookmarkedItems: { id: string; title: string; industry: string; type: string; date: string }[];
}

interface AdminStats {
  totalUsers: number;
  totalBookmarks: number;
  totalArticles: number;
  totalVideos: number;
  departmentStats: Record<string, number>;
  popularArticles: { id: string; title: string; industry: string; type: string; bookmarkCount: number }[];
  industryPopularity: Record<string, number>;
}

const IMPACT_CONFIG = {
  '매우 높음': { color: 'bg-red-500', dotColor: 'bg-red-400', textColor: 'text-white', dots: 3, label: '상' },
  '중간':      { color: 'bg-amber-500', dotColor: 'bg-amber-300', textColor: 'text-white', dots: 2, label: '중' },
  '낮음':      { color: 'bg-blue-400', dotColor: 'bg-blue-300', textColor: 'text-white', dots: 1, label: '하' },
} as const;

function ImpactBadge({ level }: { level?: string }) {
  if (!level) return null;
  const config = IMPACT_CONFIG[level as keyof typeof IMPACT_CONFIG];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.color} ${config.textColor}`}>
      <span className="flex gap-0.5">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < config.dots ? config.dotColor : 'bg-white/30'}`} />
        ))}
      </span>
      {level}
    </span>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

function proxyImg(url: string): string {
  if (!url) return '';
  if (url.startsWith('https://')) return url;
  return `${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`;
}

async function apiCall(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export default function App() {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('전체');
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [videoIndustry, setVideoIndustry] = useState<string>('전체');
  const [videoSearch, setVideoSearch] = useState('');
  const [videoStartDate, setVideoStartDate] = useState('');
  const [videoEndDate, setVideoEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'popular'>('latest');
  const [impactFilter, setImpactFilter] = useState<string>('전체');
  const ITEMS_PER_PAGE = 5;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '', department: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'bookmarks' | 'admin'>('all');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [adminArticles, setAdminArticles] = useState<{id:string;type:string;industry:string;title:string;source:string;date:string;hidden:boolean;sourceUrl:string}[]>([]);
  const [adminArticleFilter, setAdminArticleFilter] = useState<'all'|'visible'|'hidden'>('all');
  const [adminArticleType, setAdminArticleType] = useState<'all'|'article'|'video'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [addArticleUrl, setAddArticleUrl] = useState('');
  const [addArticleIndustry, setAddArticleIndustry] = useState('패션');
  const [addArticleLoading, setAddArticleLoading] = useState(false);
  const [addArticleMsg, setAddArticleMsg] = useState<{type:'success'|'error'|'confirm';text:string}|null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      apiCall('/api/auth/me').then(data => {
        setUser(data.user);
        return apiCall('/api/bookmarks');
      }).then(data => {
        setBookmarkedIds(new Set(data.itemIds));
      }).catch(() => {
        localStorage.removeItem('token');
      });
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password, name: authForm.name, department: authForm.department };
      const data = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(body) });
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setShowAuthModal(false);
      setAuthForm({ email: '', password: '', name: '', department: '' });
      const bm = await apiCall('/api/bookmarks');
      setBookmarkedIds(new Set(bm.itemIds));
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setBookmarkedIds(new Set());
    setActiveTab('all');
  };

  const toggleBookmark = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { setShowAuthModal(true); return; }
    try {
      if (bookmarkedIds.has(itemId)) {
        await apiCall(`/api/bookmarks/${itemId}`, { method: 'DELETE' });
        setBookmarkedIds(prev => { const next = new Set(prev); next.delete(itemId); return next; });
      } else {
        await apiCall('/api/bookmarks', { method: 'POST', body: JSON.stringify({ itemId }) });
        setBookmarkedIds(prev => new Set(prev).add(itemId));
      }
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  const trackView = useCallback(async (item: NewsItem) => {
    if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
    try {
      const data = await apiCall(`/api/news/${item.id}/view`, { method: 'POST' });
      setNewsItems(prev => prev.map(n => n.id === item.id ? { ...n, viewCount: data.viewCount } : n));
    } catch { /* silent */ }
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!user?.isAdmin) return;
    setAdminLoading(true);
    try {
      const [usersData, statsData, articlesData] = await Promise.all([
        apiCall('/api/admin/users'),
        apiCall('/api/admin/stats'),
        apiCall('/api/admin/articles'),
      ]);
      setAdminUsers(usersData.users);
      setAdminStats(statsData);
      setAdminArticles(articlesData.items);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setAdminLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'admin' && user?.isAdmin) fetchAdminData();
  }, [activeTab, user, fetchAdminData]);

  const handleToggleHide = async (itemId: string, hidden: boolean) => {
    try {
      await apiCall(`/api/admin/articles/${itemId}`, { method: 'PATCH', body: JSON.stringify({ hidden }) });
      setAdminArticles(prev => prev.map(a => a.id === itemId ? { ...a, hidden } : a));
      fetchNews();
    } catch (err: any) { alert(err.message); }
  };

  const handleChangeIndustry = async (itemId: string, industry: string) => {
    try {
      await apiCall(`/api/admin/articles/${itemId}`, { method: 'PATCH', body: JSON.stringify({ industry }) });
      setAdminArticles(prev => prev.map(a => a.id === itemId ? { ...a, industry } : a));
      fetchNews();
    } catch (err: any) { alert(err.message); }
  };

  const handleBulkHide = async (hidden: boolean) => {
    if (selectedItems.size === 0) return;
    try {
      await apiCall('/api/admin/articles/bulk-hide', { method: 'POST', body: JSON.stringify({ itemIds: [...selectedItems], hidden }) });
      setAdminArticles(prev => prev.map(a => selectedItems.has(a.id) ? { ...a, hidden } : a));
      setSelectedItems(new Set());
      fetchNews();
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteArticle = async (itemId: string) => {
    if (!confirm('정말 이 항목을 삭제하시겠습니까? 삭제하면 복구할 수 없습니다.')) return;
    try {
      await apiCall(`/api/admin/articles/${itemId}`, { method: 'DELETE' });
      setAdminArticles(prev => prev.filter(a => a.id !== itemId));
      fetchNews();
    } catch (err: any) { alert(err.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`선택한 ${selectedItems.size}개 항목을 영구 삭제하시겠습니까?`)) return;
    try {
      await apiCall('/api/admin/articles/bulk-delete', { method: 'POST', body: JSON.stringify({ itemIds: [...selectedItems] }) });
      setAdminArticles(prev => prev.filter(a => !selectedItems.has(a.id)));
      setSelectedItems(new Set());
      fetchNews();
    } catch (err: any) { alert(err.message); }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleSelectAll = (items: typeof adminArticles) => {
    const allIds = items.map(i => i.id);
    const allSelected = allIds.every(id => selectedItems.has(id));
    setSelectedItems(allSelected ? new Set() : new Set(allIds));
  };

  const handleAddArticle = async (force = false) => {
    if (!addArticleUrl.trim()) return;
    setAddArticleLoading(true);
    setAddArticleMsg(null);
    try {
      const endpoint = force ? '/api/admin/articles/force-add' : '/api/admin/articles/add';
      const data = await apiCall(endpoint, { method: 'POST', body: JSON.stringify({ url: addArticleUrl, industry: addArticleIndustry }) });
      setAddArticleMsg({ type: 'success', text: `"${data.article.title}" ${data.message}` });
      setAddArticleUrl('');
      fetchAdminData();
      fetchNews();
    } catch (err: any) {
      if (err.message?.includes('관련이 없는')) {
        setAddArticleMsg({ type: 'confirm', text: err.message });
      } else {
        setAddArticleMsg({ type: 'error', text: err.message });
      }
    } finally {
      setAddArticleLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('정말 이 사용자를 삭제하시겠습니까?')) return;
    try {
      await apiCall(`/api/admin/users/${userId}`, { method: 'DELETE' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/news`);
      if (res.ok) {
        const data = await res.json();
        setNewsItems(data.items ?? []);
      }
    } catch {
      console.warn('API unavailable — using empty state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleIndustryChange = (industry: string) => {
    setSelectedIndustry(industry);
    setCurrentPage(1);
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
    setCurrentPage(1);
  };

  const resetDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const filteredContent = newsItems.filter(item => {
    if (selectedIndustry !== '전체' && item.industry !== selectedIndustry) return false;

    if (startDate || endDate) {
      const itemDate = item.date.replace(/\./g, '-');
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
    }

    if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;

    if (impactFilter !== '전체' && item.impactLevel !== impactFilter) return false;

    return true;
  });

  const filteredArticles = filteredContent.filter(item => item.type === 'article').sort((a, b) => {
    if (sortOrder === 'popular') return (b.viewCount || 0) - (a.viewCount || 0);
    return b.date.replace(/\./g, '-').localeCompare(a.date.replace(/\./g, '-'));
  });
  const filteredVideos = newsItems.filter(item => {
    if (item.type !== 'video') return false;
    if (videoIndustry !== '전체' && item.industry !== videoIndustry) return false;
    if (videoSearch.trim() && !item.title.toLowerCase().includes(videoSearch.trim().toLowerCase())) return false;
    if (videoStartDate || videoEndDate) {
      const itemDate = item.date.replace(/\./g, '-');
      if (videoStartDate && itemDate < videoStartDate) return false;
      if (videoEndDate && itemDate > videoEndDate) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedArticles = filteredArticles.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const heroArticles = React.useMemo(() => {
    const articles = newsItems.filter(i => i.type === 'article');
    const seen = new Set<string>();
    const result: NewsItem[] = [];
    for (const a of articles) {
      if (!seen.has(a.industry)) {
        seen.add(a.industry);
        result.push(a);
      }
    }
    return result;
  }, [newsItems]);

  useEffect(() => {
    if (heroArticles.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroArticles.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroArticles.length]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const section = document.getElementById('articles-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="text-3xl font-extrabold tracking-tighter text-brand-dark flex items-center cursor-pointer"
              onClick={() => { setActiveTab('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              AI<span className="text-brand-blue ml-[4px]">Trend</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
              <button onClick={() => { setActiveTab('all'); document.getElementById('articles-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-gray-800 hover:text-brand-dark transition-colors">산업별 트렌드</button>
              <button onClick={() => { setActiveTab('all'); document.getElementById('videos-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="hover:text-brand-dark transition-colors">추천 영상</button>
              {user && (
                <button onClick={() => { setActiveTab('bookmarks'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`hover:text-brand-dark transition-colors flex items-center gap-1 ${activeTab === 'bookmarks' ? 'text-brand-blue' : ''}`}>
                  <BookmarkCheck className="w-4 h-4" />
                  북마크
                </button>
              )}
              {user?.isAdmin && (
                <button onClick={() => { setActiveTab('admin'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`hover:text-brand-dark transition-colors flex items-center gap-1 ${activeTab === 'admin' ? 'text-brand-blue' : ''}`}>
                  <Shield className="w-4 h-4" />
                  관리자
                </button>
              )}
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex items-center gap-2 text-sm text-gray-700">
                    <User className="w-4 h-4 text-brand-blue" />
                    <span className="font-medium">{user.name}</span>
                  </div>
                  <button onClick={handleLogout} className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </button>
                </div>
              ) : (
                <button onClick={() => { setAuthMode('login'); setAuthError(''); setShowAuthModal(true); }} className="hidden md:flex items-center justify-center px-4 py-2 rounded-full bg-brand-blue text-white text-sm font-bold hover:bg-[#0044CC] transition-colors shadow-sm">
                  로그인
                </button>
              )}
              <button className="md:hidden p-2 text-gray-400 hover:text-brand-dark transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {activeTab === 'admin' && user?.isAdmin ? (
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-brand-dark mb-8 flex items-center gap-2">
                <Shield className="w-6 h-6 text-brand-blue" />
                관리자 대시보드
              </h2>

              {adminLoading ? (
                <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-blue" /><p className="text-gray-500">데이터를 불러오는 중...</p></div>
              ) : (
                <>
                  {/* Stats Cards */}
                  {adminStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                      <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-brand-blue mb-1"><Users className="w-5 h-5" /><span className="text-sm font-medium">전체 사용자</span></div>
                        <p className="text-3xl font-bold text-brand-dark">{adminStats.totalUsers}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-purple-500 mb-1"><BookmarkCheck className="w-5 h-5" /><span className="text-sm font-medium">전체 북마크</span></div>
                        <p className="text-3xl font-bold text-brand-dark">{adminStats.totalBookmarks}</p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-green-500 mb-1"><FileText className="w-5 h-5" /><span className="text-sm font-medium">수집된 기사</span></div>
                        <p className="text-3xl font-bold text-brand-dark">{adminStats.totalArticles}</p>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-white border border-red-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-red-500 mb-1"><PlayCircle className="w-5 h-5" /><span className="text-sm font-medium">수집된 영상</span></div>
                        <p className="text-3xl font-bold text-brand-dark">{adminStats.totalVideos}</p>
                      </div>
                    </div>
                  )}

                  {/* Department & Industry Stats */}
                  {adminStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                      <div className="border border-gray-100 rounded-xl p-6">
                        <h3 className="font-bold text-brand-dark mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-brand-blue" />소속별 사용자</h3>
                        {Object.keys(adminStats.departmentStats).length === 0 ? (
                          <p className="text-sm text-gray-400">데이터 없음</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(adminStats.departmentStats).sort((a,b) => b[1] - a[1]).map(([dept, count]) => (
                              <div key={dept} className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">{dept}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-blue rounded-full" style={{ width: `${(count / adminStats.totalUsers) * 100}%` }} />
                                  </div>
                                  <span className="text-sm font-bold text-brand-dark w-8 text-right">{count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="border border-gray-100 rounded-xl p-6">
                        <h3 className="font-bold text-brand-dark mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-brand-blue" />산업군별 관심도</h3>
                        {Object.keys(adminStats.industryPopularity).length === 0 ? (
                          <p className="text-sm text-gray-400">북마크 데이터 없음</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(adminStats.industryPopularity).sort((a,b) => b[1] - a[1]).map(([ind, count]) => {
                              const max = Math.max(...Object.values(adminStats.industryPopularity));
                              return (
                                <div key={ind} className="flex items-center justify-between">
                                  <span className="text-sm text-gray-700">{ind}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                                    </div>
                                    <span className="text-sm font-bold text-brand-dark w-8 text-right">{count}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Popular Articles */}
                  {adminStats && adminStats.popularArticles.length > 0 && (
                    <div className="border border-gray-100 rounded-xl p-6 mb-10">
                      <h3 className="font-bold text-brand-dark mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-brand-blue" />인기 콘텐츠 TOP 10</h3>
                      <div className="space-y-2">
                        {adminStats.popularArticles.map((a, i) => (
                          <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < 3 ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-xs font-medium rounded shrink-0">{a.industry}</span>
                            <span className="text-sm text-gray-800 truncate flex-1">{a.title}</span>
                            <span className="text-xs text-brand-blue font-bold shrink-0">{a.bookmarkCount}명</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Article */}
                  <div className="border border-gray-100 rounded-xl mb-10 overflow-hidden">
                    <button onClick={() => setShowAddForm(!showAddForm)}
                      className="w-full bg-gray-50 px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors">
                      <h3 className="font-bold text-brand-dark flex items-center gap-2">
                        <Plus className="w-5 h-5 text-brand-blue" />기사 수동 추가
                      </h3>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showAddForm ? 'rotate-90' : ''}`} />
                    </button>
                    {showAddForm && (
                      <div className="p-6 border-t border-gray-100">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="relative flex-1">
                            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="url"
                              value={addArticleUrl}
                              onChange={e => { setAddArticleUrl(e.target.value); setAddArticleMsg(null); }}
                              placeholder="기사 URL을 입력하세요"
                              className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                            />
                          </div>
                          <select
                            value={addArticleIndustry}
                            onChange={e => setAddArticleIndustry(e.target.value)}
                            className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-brand-blue w-full sm:w-36"
                          >
                            {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                          </select>
                          <button
                            onClick={() => handleAddArticle(false)}
                            disabled={addArticleLoading || !addArticleUrl.trim()}
                            className="px-6 py-2.5 rounded-lg bg-brand-blue text-white text-sm font-bold hover:bg-[#0044CC] transition-colors disabled:opacity-50 flex items-center gap-2 justify-center shrink-0"
                          >
                            {addArticleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {addArticleLoading ? '분석 중...' : '추가'}
                          </button>
                        </div>
                        {addArticleMsg && (
                          <div className={`mt-3 px-4 py-3 rounded-lg text-sm ${
                            addArticleMsg.type === 'success' ? 'bg-green-50 text-green-700' :
                            addArticleMsg.type === 'confirm' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-600'
                          }`}>
                            <p>{addArticleMsg.text}</p>
                            {addArticleMsg.type === 'confirm' && (
                              <button
                                onClick={() => handleAddArticle(true)}
                                disabled={addArticleLoading}
                                className="mt-2 px-4 py-1.5 rounded-md bg-yellow-500 text-white text-xs font-bold hover:bg-yellow-600 transition-colors"
                              >
                                그래도 추가하기
                              </button>
                            )}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-gray-400">URL을 입력하면 자동으로 크롤링 후 Gemini가 요약/키워드를 생성합니다.</p>
                      </div>
                    )}
                  </div>

                  {/* Content Management */}
                  {(() => {
                    const filtered = adminArticles.filter(a => {
                      if (adminArticleFilter === 'visible' && a.hidden) return false;
                      if (adminArticleFilter === 'hidden' && !a.hidden) return false;
                      if (adminArticleType !== 'all' && a.type !== adminArticleType) return false;
                      return true;
                    });
                    return (
                      <div className="border border-gray-100 rounded-xl overflow-hidden mb-10">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <h3 className="font-bold text-brand-dark flex items-center gap-2">
                            <FileText className="w-5 h-5 text-brand-blue" />콘텐츠 관리 ({filtered.length}개)
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(['all','visible','hidden'] as const).map(f => (
                              <button key={f} onClick={() => { setAdminArticleFilter(f); setSelectedItems(new Set()); }}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${adminArticleFilter === f ? 'bg-brand-blue text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                                {f === 'all' ? '전체' : f === 'visible' ? '공개' : '숨김'}
                              </button>
                            ))}
                            <span className="text-gray-300">|</span>
                            {(['all','article','video'] as const).map(t => (
                              <button key={t} onClick={() => { setAdminArticleType(t); setSelectedItems(new Set()); }}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${adminArticleType === t ? 'bg-brand-blue text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                                {t === 'all' ? '전체' : t === 'article' ? '기사' : '영상'}
                              </button>
                            ))}
                            {selectedItems.size > 0 && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span className="text-xs text-brand-blue font-bold">{selectedItems.size}개 선택</span>
                                <button onClick={() => handleBulkHide(true)} className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors">일괄 숨김</button>
                                <button onClick={() => handleBulkHide(false)} className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors">일괄 복원</button>
                                <button onClick={handleBulkDelete} className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors">일괄 삭제</button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 w-10"><input type="checkbox" checked={filtered.length > 0 && filtered.every(i => selectedItems.has(i.id))} onChange={() => toggleSelectAll(filtered)} className="rounded" /></th>
                                <th className="text-left px-4 py-3 font-medium">상태</th>
                                <th className="text-left px-4 py-3 font-medium">유형</th>
                                <th className="text-left px-4 py-3 font-medium">산업</th>
                                <th className="text-left px-4 py-3 font-medium">제목</th>
                                <th className="text-left px-4 py-3 font-medium">출처</th>
                                <th className="text-left px-4 py-3 font-medium">날짜</th>
                                <th className="text-center px-4 py-3 font-medium">관리</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {filtered.map(a => (
                                <tr key={a.id} className={`transition-colors ${a.hidden ? 'bg-red-50/30' : 'hover:bg-gray-50/50'}`}>
                                  <td className="px-4 py-2.5"><input type="checkbox" checked={selectedItems.has(a.id)} onChange={() => toggleSelectItem(a.id)} className="rounded" /></td>
                                  <td className="px-4 py-2.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${a.hidden ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>
                                      {a.hidden ? '숨김' : '공개'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${a.type === 'video' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                      {a.type === 'video' ? '영상' : '기사'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs">
                                    <select value={a.industry} onChange={e => handleChangeIndustry(a.id, e.target.value)}
                                      className="bg-transparent border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-brand-blue cursor-pointer">
                                      {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-4 py-2.5 max-w-xs">
                                    <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-brand-blue truncate block text-xs" onClick={e => e.stopPropagation()}>{a.title}</a>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-gray-400">{a.source}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-400">{a.date}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => handleToggleHide(a.id, !a.hidden)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${a.hidden ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                                        {a.hidden ? '복원' : '숨김'}
                                      </button>
                                      <button onClick={() => handleDeleteArticle(a.id)}
                                        className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="삭제">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Users Table */}
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-brand-dark flex items-center gap-2"><Users className="w-5 h-5 text-brand-blue" />사용자 목록 ({adminUsers.length}명)</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium">이름</th>
                            <th className="text-left px-4 py-3 font-medium">이메일</th>
                            <th className="text-left px-4 py-3 font-medium">소속</th>
                            <th className="text-center px-4 py-3 font-medium">북마크</th>
                            <th className="text-left px-4 py-3 font-medium">관심 산업</th>
                            <th className="text-left px-4 py-3 font-medium">가입일</th>
                            <th className="text-center px-4 py-3 font-medium">관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {adminUsers.map(u => (
                            <React.Fragment key={u.id}>
                              <tr className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-brand-dark">
                                  <div className="flex items-center gap-1.5">
                                    {u.name}
                                    {u.isAdmin && <Shield className="w-3.5 h-3.5 text-brand-blue" />}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                                <td className="px-4 py-3">{u.department || <span className="text-gray-300">-</span>}</td>
                                <td className="px-4 py-3 text-center">
                                  {u.bookmarkCount > 0 ? (
                                    <button onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)} className="text-brand-blue font-bold hover:underline">{u.bookmarkCount}</button>
                                  ) : <span className="text-gray-300">0</span>}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(u.industryInterest).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([ind, cnt]) => (
                                      <span key={ind} className="px-1.5 py-0.5 bg-blue-50 text-brand-blue text-[11px] font-medium rounded">{ind}({cnt})</span>
                                    ))}
                                    {Object.keys(u.industryInterest).length === 0 && <span className="text-gray-300 text-xs">-</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                                <td className="px-4 py-3 text-center">
                                  {!u.isAdmin && (
                                    <button onClick={() => handleDeleteUser(u.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="삭제">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {expandedUser === u.id && u.bookmarkedItems.length > 0 && (
                                <tr>
                                  <td colSpan={7} className="bg-blue-50/50 px-6 py-4">
                                    <p className="text-xs font-bold text-gray-500 mb-2">{u.name}님의 북마크 ({u.bookmarkedItems.length}개)</p>
                                    <div className="space-y-1.5">
                                      {u.bookmarkedItems.map(item => (
                                        <div key={item.id} className="flex items-center gap-2 text-xs">
                                          <span className={`px-1.5 py-0.5 rounded font-medium ${item.type === 'video' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {item.type === 'video' ? '영상' : '기사'}
                                          </span>
                                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{item.industry}</span>
                                          <span className="text-gray-700 truncate">{item.title}</span>
                                          <span className="text-gray-400 shrink-0 ml-auto">{item.date}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>
          ) : activeTab === 'bookmarks' && user ? (
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-brand-dark mb-8 flex items-center gap-2">
                <BookmarkCheck className="w-6 h-6 text-brand-blue" />
                내 북마크
              </h2>
              {(() => {
                const bookmarkedItems = newsItems.filter(item => bookmarkedIds.has(item.id));
                const bookmarkedArticles = bookmarkedItems.filter(i => i.type === 'article');
                const bookmarkedVideos = bookmarkedItems.filter(i => i.type === 'video');

                if (bookmarkedItems.length === 0) {
                  return (
                    <div className="py-20 text-center text-gray-400 border border-gray-100 rounded-2xl">
                      <Bookmark className="w-10 h-10 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium mb-1">북마크한 항목이 없습니다</p>
                      <p className="text-sm">기사나 영상에서 북마크 아이콘을 눌러 저장해보세요.</p>
                    </div>
                  );
                }

                return (
                  <>
                    {bookmarkedArticles.length > 0 && (
                      <div className="mb-12">
                        <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-brand-blue" /> 기사 ({bookmarkedArticles.length})
                        </h3>
                        <div className="flex flex-col gap-4">
                          {bookmarkedArticles.map(item => (
                            <article
                              key={item.id}
                              onClick={() => { if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer'); }}
                              className="group cursor-pointer flex flex-col md:flex-row gap-4 border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow bg-white"
                            >
                              <div className="w-full md:w-1/4 aspect-[4/3] md:aspect-auto md:h-32 rounded-xl overflow-hidden shrink-0">
                                <img src={proxyImg(item.imageUrl)} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="px-2 py-0.5 bg-brand-blue/10 text-brand-blue text-xs font-bold rounded">{item.industry}</span>
                                  <span className="text-xs text-gray-400">{item.date}</span>
                                </div>
                                <h4 className="font-bold text-brand-dark line-clamp-2 group-hover:text-brand-blue transition-colors mb-1">{item.title}</h4>
                                <p className="text-sm text-gray-500 line-clamp-2">{item.summary}</p>
                              </div>
                              <button onClick={(e) => toggleBookmark(item.id, e)} className="shrink-0 self-start p-1.5 text-brand-blue">
                                <BookmarkCheck className="w-5 h-5" />
                              </button>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}

                    {bookmarkedVideos.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
                          <PlayCircle className="w-5 h-5 text-brand-blue" /> 영상 ({bookmarkedVideos.length})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {bookmarkedVideos.map(item => (
                            <article
                              key={item.id}
                              onClick={() => { if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer'); }}
                              className="group cursor-pointer"
                            >
                              <div className="relative aspect-video rounded-lg overflow-hidden mb-2 bg-gray-100">
                                <img src={proxyImg(item.imageUrl)} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                  <PlayCircle className="w-9 h-9 text-white opacity-90" />
                                </div>
                                {item.duration && (
                                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[11px] font-medium rounded">{item.duration}</span>
                                )}
                              </div>
                              <div className="flex items-start gap-1">
                                <h4 className="text-sm font-bold text-brand-dark line-clamp-2 group-hover:text-brand-blue flex-1 min-w-0">{item.title}</h4>
                                <button onClick={(e) => toggleBookmark(item.id, e)} className="shrink-0 p-1 text-brand-blue">
                                  <BookmarkCheck className="w-4 h-4" />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          ) : (
          <>
          {/* Hero Section */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-2">
              경영진이 알아야 할 이번 주 <span className="text-white bg-brand-blue px-2 py-0.5 rounded-md inline-block transform -skew-x-6">AI</span> 트렌드
            </h2>
            <p className="text-gray-500 font-medium">산업군별 주요 기사를 한눈에 확인하세요</p>
          </div>

          {heroArticles.length > 0 && (() => {
            const hero = heroArticles[heroIndex % heroArticles.length];
            return (
              <div
                className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[21/9] md:aspect-[21/7] group cursor-pointer"
                onClick={() => trackView(hero)}
              >
                <img
                  src={proxyImg(hero.imageUrl) || `https://picsum.photos/seed/${hero.industry}/1600/600`}
                  alt={hero.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6 md:p-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-block px-3 py-1 bg-brand-blue text-white text-xs font-bold rounded-full">
                      {hero.industry}
                    </span>
                    <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                      {hero.date}
                    </span>
                  </div>
                  <h3 className="text-2xl md:text-4xl font-bold text-white mb-4 max-w-3xl leading-tight line-clamp-2">
                    {hero.title}
                  </h3>
                  <p className="text-gray-300 text-sm md:text-base max-w-2xl line-clamp-2 mb-3">
                    {hero.summary}
                  </p>
                  <div className="flex items-center text-gray-400 text-sm gap-4">
                    <span>{hero.source}</span>
                    <span>•</span>
                    <span>{heroIndex + 1} / {heroArticles.length}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setHeroIndex(prev => (prev - 1 + heroArticles.length) % heroArticles.length); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setHeroIndex(prev => (prev + 1) % heroArticles.length); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                {/* Dot indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {heroArticles.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setHeroIndex(i); }}
                      className={`w-2 h-2 rounded-full transition-all ${i === heroIndex % heroArticles.length ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </section>

        {/* Industries Section */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-brand-dark flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-blue" />
              산업군별 트렌드
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => handleDateChange('start', e.target.value)}
                  className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue w-[140px]"
                />
                <span className="text-gray-400 text-sm">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => handleDateChange('end', e.target.value)}
                  className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue w-[140px]"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={resetDateFilter}
                    className="text-xs text-gray-400 hover:text-brand-blue transition-colors px-2 py-1 rounded-md border border-gray-200 hover:border-brand-blue shrink-0"
                  >
                    초기화
                  </button>
                )}
              </div>
              <div className="relative w-full sm:w-56">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="제목 검색"
                  className="w-full border border-gray-200 rounded-md pl-3 pr-9 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue transition-colors"
                />
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
            <button
              onClick={() => handleIndustryChange('전체')}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                ${selectedIndustry === '전체'
                  ? 'bg-brand-blue text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
              `}
            >
              전체
            </button>
            {INDUSTRIES.map((industry) => (
              <button
                key={industry}
                onClick={() => handleIndustryChange(industry)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${selectedIndustry === industry
                    ? 'bg-brand-blue text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                `}
              >
                {industry}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-sm font-medium text-gray-500 mr-1">중요도:</span>
            {([
              { key: '전체', label: '전체' },
              { key: '매우 높음', label: '매우 높음' },
              { key: '중간', label: '중간' },
              { key: '낮음', label: '낮음' },
            ] as const).map(({ key, label }) => {
              const config: Record<string, string> = {
                '전체': impactFilter === '전체' ? 'bg-brand-blue text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                '매우 높음': impactFilter === '매우 높음' ? 'bg-red-500 text-white shadow-sm' : 'bg-red-50 text-red-500 hover:bg-red-100',
                '중간': impactFilter === '중간' ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-50 text-amber-600 hover:bg-amber-100',
                '낮음': impactFilter === '낮음' ? 'bg-blue-400 text-white shadow-sm' : 'bg-blue-50 text-blue-500 hover:bg-blue-100',
              };
              return (
                <button
                  key={key}
                  onClick={() => { setImpactFilter(key); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${config[key]}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Articles Section */}
        <section id="articles-section" className="mb-16">
          <div className="flex items-center justify-between border-b border-gray-200 mb-6 pb-4 text-sm">
            <p className="text-gray-600">
              총 <span className="text-brand-blue font-bold">{filteredArticles.length}</span> 개의 게시물이 있습니다.
            </p>
            <div className="flex items-center gap-2 text-gray-500">
              <button
                onClick={() => { setSortOrder('latest'); setCurrentPage(1); }}
                className={`font-medium transition-colors ${sortOrder === 'latest' ? 'text-brand-blue' : 'text-gray-500 hover:text-brand-dark'}`}
              >최신순</button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => { setSortOrder('popular'); setCurrentPage(1); }}
                className={`font-medium transition-colors ${sortOrder === 'popular' ? 'text-brand-blue' : 'text-gray-500 hover:text-brand-dark'}`}
              >인기순</button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-blue" />
              <p>뉴스를 불러오는 중...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <AnimatePresence mode="popLayout">
                {paginatedArticles.map((item) => (
                  <motion.article
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => trackView(item)}
                    className="group cursor-pointer flex flex-col md:flex-row gap-6 border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="w-full md:w-1/3 lg:w-1/4 aspect-[4/3] md:aspect-auto md:h-40 rounded-xl overflow-hidden relative shrink-0">
                      <img 
                        src={proxyImg(item.imageUrl)} 
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
                    
                    <div className="flex-1 flex flex-col py-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500 font-medium truncate">{item.source}</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500 shrink-0">{item.date}</span>
                        {(item.viewCount ?? 0) > 0 && (
                          <>
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-gray-500 shrink-0">조회 {item.viewCount}</span>
                          </>
                        )}
                      </div>
                      
                      <h3 className="text-lg md:text-xl font-bold text-brand-dark mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">
                        {item.title}
                      </h3>
                      
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                        {item.summary}
                      </p>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.keywords.map(kw => (
                            <span key={kw} className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                              #{kw}
                            </span>
                          ))}
                          <ImpactBadge level={item.impactLevel} />
                        </div>
                        <button
                          onClick={(e) => toggleBookmark(item.id, e)}
                          className={`shrink-0 p-1.5 rounded-full transition-colors ${bookmarkedIds.has(item.id) ? 'text-brand-blue bg-blue-50 hover:bg-blue-100' : 'text-gray-300 hover:text-brand-blue hover:bg-gray-50'}`}
                          title={bookmarkedIds.has(item.id) ? '북마크 해제' : '북마크'}
                        >
                          {bookmarkedIds.has(item.id) ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
              
              {!loading && filteredArticles.length === 0 && (
                <div className="py-20 text-center text-gray-500 border border-gray-100 rounded-2xl">
                  <p>선택한 조건에 맞는 기사가 없습니다.</p>
                  <p className="text-sm mt-2">매일 자동으로 최신 AI 뉴스가 수집됩니다.</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <nav className="flex items-center justify-center gap-1 mt-10">
              <button
                onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-brand-blue disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                PREV
              </button>

              {(() => {
                const PAGE_GROUP = 5;
                const currentGroup = Math.floor((safePage - 1) / PAGE_GROUP);
                const start = currentGroup * PAGE_GROUP + 1;
                const end = Math.min(start + PAGE_GROUP - 1, totalPages);
                const pages: React.ReactNode[] = [];

                if (start > 1) {
                  pages.push(<button key={1} onClick={() => handlePageChange(1)} className="w-9 h-9 rounded-md text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-brand-dark transition-colors">1</button>);
                  if (start > 2) pages.push(<span key="dots-start" className="px-1 text-gray-400">...</span>);
                }

                for (let p = start; p <= end; p++) {
                  pages.push(
                    <button key={p} onClick={() => handlePageChange(p)}
                      className={`w-9 h-9 rounded-md text-sm font-semibold transition-colors ${p === safePage ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-brand-dark'}`}>
                      {p}
                    </button>
                  );
                }

                if (end < totalPages) {
                  if (end < totalPages - 1) pages.push(<span key="dots-end" className="px-1 text-gray-400">...</span>);
                  pages.push(<button key={totalPages} onClick={() => handlePageChange(totalPages)} className="w-9 h-9 rounded-md text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-brand-dark transition-colors">{totalPages}</button>);
                }

                return pages;
              })()}

              <button
                onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-brand-blue disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                NEXT
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </section>

        {/* Recommended Videos Section */}
        {newsItems.some(item => item.type === 'video') && (
        <section id="videos-section" className="mb-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-brand-dark flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-brand-blue" />
              추천 영상
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={videoStartDate}
                  onChange={e => setVideoStartDate(e.target.value)}
                  className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue w-[140px]"
                />
                <span className="text-gray-400 text-sm">~</span>
                <input
                  type="date"
                  value={videoEndDate}
                  onChange={e => setVideoEndDate(e.target.value)}
                  className="border border-gray-200 rounded-md px-2.5 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue w-[140px]"
                />
                {(videoStartDate || videoEndDate) && (
                  <button
                    onClick={() => { setVideoStartDate(''); setVideoEndDate(''); }}
                    className="text-xs text-gray-400 hover:text-brand-blue transition-colors px-2 py-1 rounded-md border border-gray-200 hover:border-brand-blue shrink-0"
                  >
                    초기화
                  </button>
                )}
              </div>
              <div className="relative w-full sm:w-56">
                <input
                  type="text"
                  value={videoSearch}
                  onChange={e => setVideoSearch(e.target.value)}
                  placeholder="제목 검색"
                  className="w-full border border-gray-200 rounded-md pl-3 pr-9 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:border-brand-blue transition-colors"
                />
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 mb-6">
            <button
              onClick={() => setVideoIndustry('전체')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                ${videoIndustry === '전체' ? 'bg-brand-blue text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              전체
            </button>
            {INDUSTRIES.map(ind => (
              <button
                key={`vid-${ind}`}
                onClick={() => setVideoIndustry(ind)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${videoIndustry === ind ? 'bg-brand-blue text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {ind}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-b border-gray-200 mb-6 pb-4 text-sm">
            <p className="text-gray-600">
              총 <span className="text-brand-blue font-bold">{filteredVideos.length}</span> 개의 게시물이 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            <AnimatePresence mode="popLayout">
              {filteredVideos.map((item) => (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => trackView(item)}
                  className="group cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden mb-2 bg-gray-100">
                    <img
                      src={proxyImg(item.imageUrl)}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                      <PlayCircle className="w-9 h-9 text-white opacity-90" />
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 bg-white/90 backdrop-blur-sm text-brand-dark text-[11px] font-bold rounded shadow-sm">
                        {item.industry}
                      </span>
                    </div>
                    {item.duration && (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[11px] font-medium rounded">
                        {item.duration}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[11px] text-gray-500 font-medium truncate">{item.source}</span>
                    <span className="text-[11px] text-gray-300">•</span>
                    <span className="text-[11px] text-gray-500 shrink-0">{item.date}</span>
                  </div>

                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-sm font-bold text-brand-dark line-clamp-2 group-hover:text-brand-blue transition-colors leading-snug flex-1 min-w-0">
                      {item.title}
                    </h3>
                    <button
                      onClick={(e) => toggleBookmark(item.id, e)}
                      className={`shrink-0 p-1 rounded-full transition-colors ${bookmarkedIds.has(item.id) ? 'text-brand-blue' : 'text-gray-300 hover:text-brand-blue'}`}
                      title={bookmarkedIds.has(item.id) ? '북마크 해제' : '북마크'}
                    >
                      {bookmarkedIds.has(item.id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>
                  {item.impactLevel && (
                    <div className="mt-1">
                      <ImpactBadge level={item.impactLevel} />
                    </div>
                  )}
                </motion.article>
              ))}
            </AnimatePresence>
          </div>

          {filteredVideos.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-sm border border-gray-100 rounded-2xl">
              선택한 산업군에 해당하는 영상이 없습니다.
            </div>
          )}
        </section>
        )}
          </>
          )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) setShowAuthModal(false); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8"
          >
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="text-2xl font-extrabold tracking-tighter text-brand-dark mb-1">
                AI<span className="text-brand-blue ml-[4px]">Trend</span>
              </div>
              <p className="text-sm text-gray-500">
                {authMode === 'login' ? '로그인하여 북마크를 관리하세요' : '새 계정을 만들어보세요'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                    <input
                      type="text"
                      value={authForm.name}
                      onChange={e => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="이름을 입력하세요"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">소속</label>
                    <input
                      type="text"
                      value={authForm.department}
                      onChange={e => setAuthForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="예: 마케팅팀"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={authMode === 'signup' ? '6자 이상 입력하세요' : '비밀번호를 입력하세요'}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                  required
                  minLength={authMode === 'signup' ? 6 : undefined}
                />
              </div>

              {authError && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-lg bg-brand-blue text-white font-bold text-sm hover:bg-[#0044CC] transition-colors disabled:opacity-50"
              >
                {authLoading ? '처리중...' : (authMode === 'login' ? '로그인' : '회원가입')}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              {authMode === 'login' ? (
                <p>아직 계정이 없으신가요?{' '}
                  <button onClick={() => { setAuthMode('signup'); setAuthError(''); }} className="text-brand-blue font-medium hover:underline">회원가입</button>
                </p>
              ) : (
                <p>이미 계정이 있으신가요?{' '}
                  <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-brand-blue font-medium hover:underline">로그인</button>
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-brand-dark text-gray-400 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-extrabold tracking-tighter text-white flex items-center">
            AI<span className="text-brand-blue ml-[4px]">Trend</span>
          </div>
          <div className="text-sm text-center md:text-left">
            <p>디지털 시대의 새로운 핵심, 단순 트렌드 분석을 넘어 인사이트를 제시해주는 똑똑한 AI</p>
            <p className="mt-2 text-gray-500">&copy; 2024 AI Trend Brief. All rights reserved.</p>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">이용약관</a>
            <a href="#" className="hover:text-white transition-colors">개인정보처리방침</a>
          </div>
        </div>
      </footer>

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
