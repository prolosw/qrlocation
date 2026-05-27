import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // /admin 관련 경로와 /api/requests 관련 경로에 대하여 Basic Auth 차단 적용
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/requests')) {
    const authHeader = req.headers.get('authorization');

    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPass = process.env.ADMIN_PASS || 'admin1234';
    
    const expectedAuth = 'Basic ' + btoa(`${expectedUser}:${expectedPass}`);

    if (authHeader !== expectedAuth) {
      return new NextResponse('Unauthorized: Access Denied', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Admin Dashboard Access"',
        },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  // 미들웨어가 실행될 최적의 경로 매칭 규칙 정의
  matcher: [
    '/admin/:path*', 
    '/api/requests/:path*'
  ],
};
