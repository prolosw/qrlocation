/**
 * NAVER Cloud Platform Reverse Geocoding API를 사용하여 위도, 경도 좌표를 한국 주소로 변환합니다.
 * API Key가 없는 경우 로컬 테스트용 Mock 주소를 안전하게 반환합니다.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // 한국 좌표 범위 체크 (위도 33 ~ 43, 경도 124 ~ 132)
  if (lat < 33 || lat > 43 || lng < 124 || lng > 132) {
    return '수동 주소 입력이 필요합니다 (한국 영외 좌표)';
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log(`[NAVER API Mock] Reverse geocoding requested for lat: ${lat}, lng: ${lng}`);
    
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
    // Naver Map Reverse Geocoding API는 coords 형식으로 경도(lng),위도(lat) 순서로 넘겨야 합니다.
    const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=roadaddr,addr`;
    
    const res = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    });

    if (!res.ok) {
      throw new Error(`NAVER API responded with status ${res.status}`);
    }

    const data = await res.json();
    
    if (data.status?.code !== 0) {
      throw new Error(`NAVER API Error: ${data.status?.message || 'Unknown Status'}`);
    }

    const results = data.results || [];
    
    // 1. 도로명 주소(roadaddr) 우선 탐색
    const roadAddrResult = results.find((r: any) => r.name === 'roadaddr');
    if (roadAddrResult) {
      const { region, land } = roadAddrResult;
      const area1 = region?.area1?.name || '';
      const area2 = region?.area2?.name || '';
      const area3 = region?.area3?.name || '';
      const area4 = region?.area4?.name || '';
      const roadName = land?.name || '';
      const number1 = land?.number1 || '';
      const number2 = land?.number2 || '';
      const buildingName = land?.addition0?.value || '';

      let address = `${area1} ${area2} ${area3} ${area4}`.trim();
      if (roadName) {
        address += ` ${roadName}`;
      }
      if (number1) {
        address += ` ${number1}`;
        if (number2) {
          address += `-${number2}`;
        }
      }
      if (buildingName) {
        address += ` (${buildingName})`;
      }
      return address.replace(/\s+/g, ' ').trim();
    }

    // 2. 지번 주소(addr) 차선책 탐색
    const addrResult = results.find((r: any) => r.name === 'addr');
    if (addrResult) {
      const { region, land } = addrResult;
      const area1 = region?.area1?.name || '';
      const area2 = region?.area2?.name || '';
      const area3 = region?.area3?.name || '';
      const area4 = region?.area4?.name || '';
      const number1 = land?.number1 || '';
      const number2 = land?.number2 || '';

      let address = `${area1} ${area2} ${area3} ${area4}`.trim();
      if (number1) {
        address += ` ${number1}`;
        if (number2) {
          address += `-${number2}`;
        }
      }
      return address.replace(/\s+/g, ' ').trim();
    }

    return `주소 변환 불가 (좌표: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch (error) {
    console.error('NAVER Reverse Geocode Error:', error);
    // API 에러 발생 시 완전한 무너짐을 방지하고 좌표 정보를 반환
    return `주소 변환 실패 (좌표: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}
