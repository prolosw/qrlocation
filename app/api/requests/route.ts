import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // 모든 요청을 생성일시 역순(최신순)으로 정렬하여 반환
    const requests = await prisma.serviceRequest.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Fetch Service Requests Error:', error);
    return NextResponse.json(
      { error: '지원 요청 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
