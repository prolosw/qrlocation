import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/naver';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: '위도(lat)와 경도(lng) 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: '위도와 경도는 유효한 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    const address = await reverseGeocode(lat, lng);
    return NextResponse.json({ address });
  } catch (error) {
    console.error('Geocoding Proxy Route Error:', error);
    return NextResponse.json(
      { error: '주소 변환 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
