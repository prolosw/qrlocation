/**
 * Kakao Maps REST API를 사용하여 위도, 경도 좌표를 한국 주소로 변환합니다.
 * API Key가 없는 경우 로컬 테스트용 Mock 주소를 안전하게 반환합니다.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // 한국 좌표 범위 체크 (위도 33 ~ 43, 경도 124 ~ 132)
  if (lat < 33 || lat > 43 || lng < 124 || lng > 132) {
    return '수동 주소 입력이 필요합니다 (한국 영외 좌표)';
  }

  const apiKey = process.env.KAKAO_REST_KEY;
  if (!apiKey) {
    console.log(`[Kakao API Mock] Reverse geocoding requested for lat: ${lat}, lng: ${lng}`);
    
    // 테스트용 다양하고 실감나는 Mock 주소 매핑 (강남역, 서울역, 판교 등)
    if (lat >= 37.49 && lat <= 37.51 && lng >= 127.01 && lng <= 127.04) {
      return '서울특별시 강남구 테헤란로 152 (강남역 GFC 타워)';
    }
    if (lat >= 37.55 && lat <= 37.56 && lng >= 126.96 && lng <= 126.98) {
      return '서울특별시 중구 한강대로 405 (서울역)';
    }
    if (lat >= 37.39 && lat <= 37.41 && lng >= 127.10 && lng <= 127.12) {
      return '경기도 성남시 분당구 판교역로 166 (카카오 판교 오피스)';
    }
    return '서울특별시 중구 태평로1가 31 (서울시청)';
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    
    if (!res.ok) {
      throw new Error(`Kakao API responded with status ${res.status}`);
    }

    const data = await res.json();
    const doc = data.documents?.[0];
    if (!doc) {
      return `주소 변환 불가 (좌표: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
    
    return doc.road_address?.address_name || doc.address?.address_name || `주소 변환 불가 (좌표: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch (error) {
    console.error('Reverse Geocode Error:', error);
    // API 에러가 나더라도 무너지지 않도록 안전한 Fallback 주소 반환
    return '서울특별시 강남구 테헤란로 152 (카카오 API 연결 에러 Fallback)';
  }
}
