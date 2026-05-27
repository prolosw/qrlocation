import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, memo } = body;

    // 데이터가 없는 경우
    if (status === undefined && memo === undefined) {
      return NextResponse.json(
        { error: '변경할 상태 또는 메모 정보가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // status 값 유효성 검사 (SQLite enum String validation)
    const validStatuses = ['RECEIVED', 'PROCESSING', 'COMPLETED'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '올바르지 않은 상태 값입니다.' },
        { status: 400 }
      );
    }

    // 업데이트할 데이터 세팅
    const updateData: { status?: string; memo?: string } = {};
    if (status !== undefined) updateData.status = status;
    if (memo !== undefined) updateData.memo = memo;

    // DB 업데이트
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Update Service Request Error:', error);
    return NextResponse.json(
      { error: '요청 정보를 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
