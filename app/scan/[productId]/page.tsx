'use client';

import { useState, useEffect, use } from 'react';

type State = 'loading' | 'ready' | 'denied' | 'submitting' | 'done' | 'error';

export default function ScanPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const [state, setState] = useState<State>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. 초기 연락처 캐시 불러오기 및 GPS 요청
  useEffect(() => {
    const saved = localStorage.getItem('qr-support-phone');
    if (saved) setPhone(formatPhone(saved));

    requestGPS();
  }, []);

  // GPS 권한 요청 및 주소 획득
  const requestGPS = () => {
    setState('loading');
    if (!navigator.geolocation) {
      setState('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        try {
          // 서버사이드 geocoding 프록시 엔드포인트 경유
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          setAddress(data.address);
          setState('ready');
        } catch {
          setAddress(`위치 식별 완료 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          setState('ready');
        }
      },
      (err) => {
        console.warn('Geolocation Error:', err);
        setState('denied');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // 테스트 편의성을 위한 모킹용 강남역 좌표 강제 기입 도우미
  const handleTestLocation = async () => {
    setState('loading');
    const mockLat = 37.4979;
    const mockLng = 127.0276;
    setCoords({ lat: mockLat, lng: mockLng });

    try {
      const res = await fetch(`/api/geocode?lat=${mockLat}&lng=${mockLng}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAddress(data.address);
      setState('ready');
    } catch {
      setAddress('서울특별시 강남구 테헤란로 152 (강남역 GFC)');
      setState('ready');
    }
  };

  // 2. 전화번호 입력 자동 포맷터 (0으로 시작하지 않으면 자동으로 010 추가)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    
    // 첫 글자가 0 또는 1이 아니면 사용자 편의를 위해 010을 자동으로 접두어로 결합
    // (1로 시작하는 1588 등 대표번호나 0으로 시작하는 일반 기입은 그대로 허용)
    if (raw.length > 0 && raw[0] !== '0' && raw[0] !== '1') {
      raw = '010' + raw;
    }
    
    setPhone(formatPhone(raw));
  };

  // 3. 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      alert('올바른 한국 전화번호를 입력해주세요. (예: 010-1234-5678)');
      return;
    }

    setState('submitting');
    // 다음 스캔 시 편의를 위해 번호 로컬 캐싱
    localStorage.setItem('qr-support-phone', cleanPhone);

    const payload = {
      productId,
      phone: cleanPhone,
      latitude: coords?.lat ?? 0,
      longitude: coords?.lng ?? 0,
      address: coords ? address : manualAddress,
    };

    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setState('done');
      } else {
        setErrorMessage(data.error || '제출 중 오류가 발생했습니다.');
        setState('error');
      }
    } catch (err) {
      setErrorMessage('서버 네트워크 상태를 확인해 주세요.');
      setState('error');
    }
  };

  // 스피너 스크린
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-semibold tracking-wide">위치 정보를 조회하고 있습니다</h2>
        <p className="text-sm text-slate-400 mt-2">정확한 서비스 지원을 위해 잠시만 기다려주세요.</p>
        
        {/* 강제 테스트 버튼 */}
        <button
          onClick={handleTestLocation}
          className="mt-8 text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-4 py-2 rounded-lg border border-slate-700 transition"
        >
          [테스트용] 위치 강제 동의 및 주소 자동 매핑하기
        </button>
      </div>
    );
  }

  // 완료 스크린
  if (state === 'done') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-emerald-400">요청이 정상 접수되었습니다!</h2>
        <p className="text-slate-300 mt-3 max-w-xs leading-relaxed">
          고객님의 위치와 연락처 정보가 성공적으로 전송되었습니다. 담당 엔지니어가 신속히 확인한 후 연락드리겠습니다.
        </p>
        <div className="w-full max-w-sm bg-slate-800/50 border border-slate-700 rounded-xl p-4 mt-8 text-left text-xs text-slate-400 space-y-1">
          <div>• 접수 구분: 제품 긴급 지원 요청</div>
          <div>• 제품 ID: <span className="font-mono text-blue-400">{productId}</span></div>
          {address && <div>• 전송 주소: <span className="text-slate-300">{address}</span></div>}
        </div>
      </div>
    );
  }

  // 에러 스크린
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6 text-center">
        <div className="w-20 h-20 bg-rose-500/10 border-2 border-rose-500 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-rose-400">접수 중 문제가 발생했습니다</h2>
        <p className="text-slate-300 mt-3 max-w-xs leading-relaxed">
          {errorMessage}
        </p>
        <button
          onClick={() => setState('ready')}
          className="mt-8 bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition duration-200"
        >
          다시 시도하기
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      {/* 백그라운드 빛 효과 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* 데코 레이블 */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

        <div className="text-center mb-8 mt-2">
          <span className="text-xs uppercase font-semibold tracking-widest text-blue-500">SUPPORT SERVICE</span>
          <h1 className="text-2xl font-black mt-2 text-white">원터치 지원 요청</h1>
          <p className="text-xs text-slate-400 mt-1">현장 좌표와 정보를 전송하여 빠르게 접수합니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 위치 카드 */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                현장 위치 정보
              </span>
              {state === 'denied' ? (
                <button
                  type="button"
                  onClick={requestGPS}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                >
                  GPS 재시도
                </button>
              ) : (
                <span className="text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full">
                  GPS 연동완료
                </span>
              )}
            </div>

            {state === 'denied' ? (
              <div className="space-y-2">
                <p className="text-[11px] text-amber-500 leading-tight">
                  ※ 위치 권한이 비활성화되었습니다. 아래에 상세 주소를 수동으로 기재해주세요.
                </p>
                <input
                  type="text"
                  required
                  placeholder="예) 서울시 강남구 역삼동 테헤란로 152"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3.5 py-3 text-sm text-slate-200 outline-none transition"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-100 leading-relaxed">
                  {address || '좌표 분석 완료, 주소 탐색 중...'}
                </p>
                {coords && (
                  <a
                    href={`https://map.kakao.com/link/map/${coords.lat},${coords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 mt-2 font-medium"
                  >
                    카카오 지도로 현위치 보기
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 연락처 입력 카드 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 block px-1">📞 연락처 (전화번호)</label>
            <input
              type="tel"
              required
              inputMode="numeric"
              maxLength={13}
              placeholder="010-0000-0000"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl px-4 py-3.5 text-lg font-mono text-center tracking-widest text-white outline-none transition"
              value={phone}
              onChange={handlePhoneChange}
            />
          </div>

          {/* 약관 안내 문구 */}
          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            * 입력하신 연락처와 GPS 위치 정보는 서비스 접수 및 현장 출동 목적으로만 제한적으로 사용되며, 처리 완료 후 폐기됩니다. (개인정보 보호법 준수)
          </p>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={state === 'submitting'}
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-indigo-950 transition duration-200 disabled:opacity-50 active:scale-[0.98]"
          >
            {state === 'submitting' ? '정보 전송 중...' : '지원 요청하기'}
          </button>
        </form>

        <div className="border-t border-slate-800/80 mt-6 pt-4 text-center">
          <p className="text-xs text-slate-500">
            접수 제품 ID: <span className="font-mono text-blue-400 font-semibold">{productId}</span>
          </p>
        </div>
      </div>
    </main>
  );
}

// 4. 한국 전화번호 하이픈 자동 포맷 함수
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
