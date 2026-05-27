'use client';

import { useState, useEffect } from 'react';

// 접수 상태 정의 및 라벨/컬러 매핑
const STATUS_META = {
  RECEIVED: { label: '접수완료', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  PROCESSING: { label: '처리중', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  COMPLETED: { label: '처리완료', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
};

type ServiceRequest = {
  id: string;
  productId: string;
  phone: string;
  latitude: number;
  longitude: number;
  address: string;
  status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED';
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'RECEIVED' | 'PROCESSING' | 'COMPLETED'>('ALL');
  const [search, setSearch] = useState('');

  // 1. 요청 데이터 로드
  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      const res = await fetch('/api/requests');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  }

  // 2. 상태 변경 API 호출 (낙관적 업데이트 적용)
  async function handleStatusChange(id: string, newStatus: 'RECEIVED' | 'PROCESSING' | 'COMPLETED') {
    // 이전 상태 백업
    const originalRequests = [...requests];

    // 낙관적 업데이트 적용
    setRequests(prev =>
      prev.map(req => (req.id === id ? { ...req, status: newStatus } : req))
    );

    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      alert('상태 변경에 실패했습니다. 이전 데이터로 복구합니다.');
      setRequests(originalRequests);
    }
  }

  // 3. 필터링 및 검색 로직
  const filtered = requests.filter(req => {
    if (filter !== 'ALL' && req.status !== filter) return false;
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      const matchProduct = req.productId.toLowerCase().includes(lowerSearch);
      const matchPhone = req.phone.includes(lowerSearch);
      const matchAddress = req.address.toLowerCase().includes(lowerSearch);
      return matchProduct || matchPhone || matchAddress;
    }
    
    return true;
  });

  // 4. 통계 카드 집계
  const stats = {
    total: requests.length,
    received: requests.filter(r => r.status === 'RECEIVED').length,
    processing: requests.filter(r => r.status === 'PROCESSING').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 relative">
      {/* 배경 빛 그래픽 */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative">
        {/* 헤더 섹션 */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Control Panel</span>
            </div>
            <h1 className="text-3xl font-black text-white mt-1">긴급 지원 요청 관리자 대시보드</h1>
            <p className="text-sm text-slate-400 mt-1">현장에서 실시간으로 접수되는 QR 서비스 긴급 지원 건들을 추적하고 상태를 조정합니다.</p>
          </div>
          <button
            onClick={loadRequests}
            className="self-start sm:self-center bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.213 15m0 0H16" />
            </svg>
            새로고침
          </button>
        </header>

        {/* 통계 현황판 */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs font-bold text-slate-400 block">총 누적 요청</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white">{stats.total}</span>
              <span className="text-xs text-slate-500">건</span>
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs font-bold text-amber-400 block">접수 완료 (신규)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-amber-400">{stats.received}</span>
              <span className="text-xs text-slate-500">건</span>
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs font-bold text-sky-400 block">처리 진행 중</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-sky-400">{stats.processing}</span>
              <span className="text-xs text-slate-500">건</span>
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-5 backdrop-blur-md">
            <span className="text-xs font-bold text-emerald-400 block">처리 완료</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-emerald-400">{stats.completed}</span>
              <span className="text-xs text-slate-500">건</span>
            </div>
          </div>
        </section>

        {/* 필터 및 검색 유틸리티 */}
        <section className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-sm">
          {/* 상태 탭 필터 */}
          <div className="flex p-1 bg-slate-950/80 border border-slate-850 rounded-xl w-full md:w-auto">
            {(['ALL', 'RECEIVED', 'PROCESSING', 'COMPLETED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-1 md:flex-none text-xs font-semibold px-4 py-2 rounded-lg transition duration-150 whitespace-nowrap ${
                  filter === s 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s === 'ALL' ? '전체 보기' : STATUS_META[s].label}
              </button>
            ))}
          </div>

          {/* 통합 검색바 */}
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="제품 ID / 전화번호 / 주소 검색"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </section>

        {/* 테이블 목록 */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          {loading ? (
            <div className="p-20 text-center text-slate-400">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <span>데이터를 로드하는 중입니다...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-20 text-center text-slate-500">
              <svg className="w-12 h-12 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4" />
              </svg>
              <span>접수 및 일치하는 요청 내역이 없습니다.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800/80 text-xs font-bold text-slate-400 tracking-wider">
                    <th className="p-4 pl-6">접수 일시</th>
                    <th className="p-4">제품 ID</th>
                    <th className="p-4">전화번호</th>
                    <th className="p-4">접수 현장 주소</th>
                    <th className="p-4">지원 처리 상태</th>
                    <th className="p-4 pr-6">관리자 기록 (메모)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs text-slate-350">
                  {filtered.map(req => (
                    <tr key={req.id} className="hover:bg-slate-800/20 transition duration-150">
                      {/* 접수일시 */}
                      <td className="p-4 pl-6 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      {/* 제품 ID */}
                      <td className="p-4 font-mono font-bold text-slate-300 whitespace-nowrap">
                        <span className="bg-slate-950 border border-slate-850 px-2.5 py-1 rounded-md text-blue-400">
                          {req.productId}
                        </span>
                      </td>
                      {/* 전화번호 */}
                      <td className="p-4 font-mono whitespace-nowrap">
                        <a
                          href={`tel:${req.phone}`}
                          title="클릭 시 즉시 통화 연결"
                          className="text-slate-200 hover:text-blue-400 hover:underline flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {req.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')}
                        </a>
                      </td>
                      {/* 주소 및 지도 보기 */}
                      <td className="p-4 max-w-xs sm:max-w-sm truncate">
                        <div className="flex flex-col">
                          <span className="text-slate-200" title={req.address}>
                            {req.address}
                          </span>
                          {req.latitude !== 0 && req.longitude !== 0 && (
                            <a
                              href={`https://map.kakao.com/link/map/${req.latitude},${req.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-slate-550 hover:text-blue-400 hover:underline inline-flex items-center gap-0.5 mt-1 font-medium"
                            >
                              위치 정밀지도 조회
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                      {/* 상태 드롭다운 */}
                      <td className="p-4 whitespace-nowrap">
                        <select
                          value={req.status}
                          onChange={e => handleStatusChange(req.id, e.target.value as any)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold cursor-pointer outline-none transition duration-150 ${STATUS_META[req.status].color}`}
                        >
                          <option value="RECEIVED" className="bg-slate-900 text-amber-400">접수완료</option>
                          <option value="PROCESSING" className="bg-slate-900 text-sky-400">처리중</option>
                          <option value="COMPLETED" className="bg-slate-900 text-emerald-400">처리완료</option>
                        </select>
                      </td>
                      {/* 메모 인라인 편집 */}
                      <td className="p-4 pr-6">
                        <MemoCell id={req.id} initialMemo={req.memo || ''} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// 5. 메모 전용 인라인 편집 컴포넌트
function MemoCell({ id, initialMemo }: { id: string; initialMemo: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [memo, setMemo] = useState(initialMemo);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSave = async () => {
    if (memo === initialMemo) {
      setIsEditing(false);
      return;
    }

    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo }),
      });

      if (!res.ok) throw new Error();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      alert('메모 저장 도중 에러가 발생했습니다.');
      setMemo(initialMemo);
    } finally {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <input
          type="text"
          className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none w-full max-w-[200px]"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setMemo(initialMemo);
              setIsEditing(false);
            }
          }}
          autoFocus
        />
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg transition"
          title="저장"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      title="더블클릭/클릭 시 인라인 편집 활성화"
      className="flex items-center justify-between gap-2 group cursor-pointer min-h-[32px] w-full max-w-[240px] hover:bg-slate-800/40 px-2 py-1 rounded-lg border border-transparent hover:border-slate-800/80 transition"
    >
      <span className={`text-xs ${memo ? 'text-slate-300' : 'text-slate-500 italic'}`}>
        {memo || '기록된 메모 없음...'}
      </span>
      <div className="flex items-center gap-1">
        {saveStatus === 'saved' && (
          <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">저장됨</span>
        )}
        <svg className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>
    </div>
  );
}
