# 구현 상세 참고

## 고객 페이지 전체 흐름 (상태 머신)

```
idle → requesting_location → got_location → submitting → submitted
                           ↘ location_denied → manual_input → submitting → submitted
                                                             ↗
```

## 전체 고객 페이지 예시 코드

```tsx
// app/scan/[productId]/page.tsx
'use client';
import { useState, useEffect } from 'react';

type State = 'loading' | 'ready' | 'denied' | 'submitting' | 'done' | 'error';

export default function ScanPage({ params }: { params: { productId: string } }) {
  const [state, setState] = useState<State>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  useEffect(() => {
    // localStorage에서 이전 전화번호 불러오기
    const saved = localStorage.getItem('qr-support-phone');
    if (saved) setPhone(saved);

    // GPS 요청
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        // 서버에서 주소 변환 (API Route 경유)
        const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
        const data = await res.json();
        setAddress(data.address);
        setState('ready');
      },
      () => setState('denied'),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  const handleSubmit = async () => {
    const finalPhone = phone.replace(/\D/g, '');
    if (finalPhone.length < 10) return alert('전화번호를 올바르게 입력해주세요');

    setState('submitting');
    localStorage.setItem('qr-support-phone', phone); // 캐싱

    const body = {
      productId: params.productId,
      phone: finalPhone,
      latitude: coords?.lat ?? 0,
      longitude: coords?.lng ?? 0,
      address: coords ? address : manualAddress,
    };

    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) setState('done');
      else throw new Error();
    } catch {
      setState('error');
    }
  };

  if (state === 'loading') return <LoadingScreen message="위치를 확인하는 중..." />;
  if (state === 'done') return <SuccessScreen />;

  return (
    <main className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-center mb-6">서비스 지원 요청</h1>

      {/* 위치 정보 */}
      <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">📍 현재 위치</h2>
        {state === 'denied' ? (
          <input
            className="w-full border rounded-lg p-3 text-sm"
            placeholder="주소를 직접 입력해주세요 (예: 서울시 강남구...)"
            value={manualAddress}
            onChange={e => setManualAddress(e.target.value)}
          />
        ) : (
          <p className="text-sm text-gray-700">{address || '주소 확인 중...'}</p>
        )}
        {coords && (
          <a
            href={`https://map.kakao.com/link/map/${coords.lat},${coords.lng}`}
            target="_blank"
            className="text-xs text-blue-500 mt-1 block"
          >
            지도에서 확인 →
          </a>
        )}
      </section>

      {/* 전화번호 */}
      <section className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">📞 연락처</h2>
        <input
          type="tel"
          inputMode="numeric"
          className="w-full border rounded-lg p-3 text-lg tracking-widest"
          placeholder="010-0000-0000"
          value={phone}
          onChange={e => setPhone(formatPhone(e.target.value))}
        />
      </section>

      <button
        onClick={handleSubmit}
        disabled={state === 'submitting'}
        className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-semibold
                   disabled:opacity-50 active:bg-blue-700"
      >
        {state === 'submitting' ? '전송 중...' : '지원 요청하기'}
      </button>

      <p className="text-xs text-center text-gray-400 mt-4">
        제품 ID: {params.productId}
      </p>
    </main>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
}
```

## 관리자 대시보드 예시

```tsx
// app/admin/page.tsx
'use client';
import { useState, useEffect } from 'react';

const STATUS_LABELS = {
  RECEIVED: { label: '접수완료', color: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: '처리중', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: '처리완료', color: 'bg-green-100 text-green-800' },
};

export default function AdminPage() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => { loadRequests(); }, []);

  async function loadRequests() {
    const res = await fetch('/api/requests');
    setRequests(await res.json());
  }

  async function updateStatus(id: string, status: string) {
    // 낙관적 업데이트
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  const filtered = requests.filter(r => {
    if (filter !== 'ALL' && r.status !== filter) return false;
    if (search && !r.productId.includes(search) && !r.phone.includes(search)) return false;
    return true;
  });

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4 flex-wrap">
        {['ALL', 'RECEIVED', 'PROCESSING', 'COMPLETED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${filter === s ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>
            {s === 'ALL' ? '전체' : STATUS_LABELS[s].label}
          </button>
        ))}
        <input placeholder="제품ID / 전화번호 검색" value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto border rounded-lg px-3 py-1 text-sm" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">접수시각</th>
              <th className="p-2 text-left">제품 ID</th>
              <th className="p-2 text-left">전화번호</th>
              <th className="p-2 text-left">주소</th>
              <th className="p-2 text-left">상태</th>
              <th className="p-2 text-left">메모</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-2 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString('ko-KR')}
                </td>
                <td className="p-2 font-mono">{r.productId}</td>
                <td className="p-2">
                  <a href={`tel:${r.phone}`} className="text-blue-600 hover:underline">
                    {r.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                  </a>
                </td>
                <td className="p-2 max-w-xs truncate">
                  <a href={`https://map.kakao.com/link/map/${r.latitude},${r.longitude}`}
                     target="_blank" className="hover:underline">
                    {r.address}
                  </a>
                </td>
                <td className="p-2">
                  <select
                    value={r.status}
                    onChange={e => updateStatus(r.id, e.target.value)}
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_LABELS[r.status].color}`}
                  >
                    {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <MemoCell id={r.id} initial={r.memo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Kakao API 키 발급 방법

1. https://developers.kakao.com 접속 → 앱 생성
2. 앱 → 앱 키 → **REST API 키** 복사
3. 플랫폼 → Web → 사이트 도메인 등록 (localhost:3000, 실제 도메인)
4. `.env.local`에 `KAKAO_REST_KEY=발급받은키` 추가

## 대안: Naver Maps API (역지오코딩)

Kakao 대신 Naver를 쓰는 경우:
```typescript
const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=roadaddr,addr`;
// Headers: X-NCP-APIGW-API-KEY-ID, X-NCP-APIGW-API-KEY
```
