import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { reverseGeocode } from '@/lib/naver';
import { sendSMS } from '@/lib/aligo';

export const runtime = 'nodejs';

// 간단한 IP 기반 Rate Limiter (메모리 맵)
const ipCache = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const MAX_REQUESTS = 5; // 분당 5회 제한

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limitInfo = ipCache.get(ip);

  if (!limitInfo) {
    ipCache.set(ip, { count: 1, lastReset: now });
    return false;
  }

  if (now - limitInfo.lastReset > RATE_LIMIT_WINDOW) {
    ipCache.set(ip, { count: 1, lastReset: now });
    return false;
  }

  limitInfo.count += 1;
  return limitInfo.count > MAX_REQUESTS;
}

// 한국 전화번호 유효성 검사 (010, 011, 016, 017, 018, 019로 시작하고 뒤에 7~8자리 숫자)
function isValidKoreanPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return /^(010|011|016|017|018|019)\d{7,8}$/.test(digits);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting 적용
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: '너무 많은 요청을 보냈습니다. 1분 후에 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    // 2. 요청 바디 데이터 검증
    const body = await req.json();
    const { productId, phone, latitude, longitude, address: manualAddress } = body;

    if (!productId || !phone) {
      return NextResponse.json(
        { error: '제품 ID와 전화번호는 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    if (!isValidKoreanPhone(phone)) {
      return NextResponse.json(
        { error: '유효한 한국 전화번호 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 3. 주소 확인 (GPS 좌표가 유효한 경우 역지오코딩 시도, 한국 영외 좌표이거나 좌표가 없을 경우 수동 주소 사용)
    let finalAddress = '';
    const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number' && latitude !== 0 && longitude !== 0;

    if (hasCoordinates) {
      // 한국 좌표 범위인지 체크
      const isWithinKorea = latitude >= 33 && latitude <= 43 && longitude >= 124 && longitude <= 132;
      if (isWithinKorea) {
        finalAddress = await reverseGeocode(latitude, longitude);
      } else {
        finalAddress = manualAddress || '한국 영외 위치 (수동 주소 입력 없음)';
      }
    } else {
      finalAddress = manualAddress || '위치 정보 없음';
    }

    // 4. DB 저장
    const newRequest = await prisma.serviceRequest.create({
      data: {
        productId,
        phone: phone.replace(/\D/g, ''), // 하이픈 제거 후 순수 숫자만 DB 저장
        latitude: latitude || 0,
        longitude: longitude || 0,
        address: finalAddress,
        status: 'RECEIVED',
      },
    });

    // 5. 알리고 SMS 문자 발송 (실패하더라도 API 응답은 성공하도록 try-catch 감쌈)
    try {
      // 고객 문자 발송
      const customerMsg = `[제품 긴급 지원 요청]
고객님, 긴급 지원 서비스 요청이 성공적으로 접수되었습니다.

■ 접수 제품: ${productId}
■ 접수 현장: ${finalAddress}

담당 엔지니어가 신속하게 내용을 검토한 후 연락드리고 출동하겠습니다. 감사합니다.`;
      
      await sendSMS({ receiver: phone, msg: customerMsg });

      // 관리자 알림 문자 발송
      const adminPhone = process.env.ADMIN_PHONE;
      if (adminPhone) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const formattedCustomerPhone = phone.replace(/\D/g, '').replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
        const adminMsg = `[긴급 지원 접수 알림]
새로운 긴급 서비스 요청이 등록되었습니다.

■ 제품 ID: ${productId}
■ 연락처: ${formattedCustomerPhone}
■ 현장 주소: ${finalAddress}

대시보드(${baseUrl}/admin)에서 조정을 처리해 주시기 바랍니다.`;
        
        await sendSMS({ receiver: adminPhone, msg: adminMsg });
      }
    } catch (smsError) {
      console.error('SMS Notification Error (Ignored for API response):', smsError);
    }

    return NextResponse.json({ success: true, id: newRequest.id });
  } catch (error) {
    console.error('Request Registration Error:', error);
    return NextResponse.json(
      { error: '서버 내부 오류로 인해 지원 요청을 접수하지 못했습니다.' },
      { status: 500 }
    );
  }
}
