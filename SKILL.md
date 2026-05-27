---
name: qr-product-support
description: >
  QR코드 기반 제품 지원 요청 웹앱 구축 스킬. 제품에 QR코드를 붙이고, 고객이 스캔하면 현재 위치(GPS + 주소 역지오코딩)와 전화번호를 서버로 전송하는 풀스택 앱을 만든다. 고객용 모바일 랜딩 페이지, REST API 서버, 관리자 대시보드(접수완료/처리중/처리완료 상태 관리)로 구성된다. Next.js + SQLite(또는 Supabase) + Kakao Maps API(한국 주소) 스택을 기본으로 한다.
  사용자가 "QR 제품 지원", "QR 스캔 위치 전송", "고객 요청 접수 시스템", "관리자 상태 처리" 등을 언급할 때 반드시 이 스킬을 사용하라.
---

# QR 제품 지원 요청 웹앱

## 1. 프로젝트 개요

```
[제품 QR] → 스캔 → [고객 모바일 페이지]
                        ↓ GPS 위치 + 전화번호 입력
                   [API 서버 (Next.js)]
                        ↓ 저장
                   [DB (SQLite/Supabase)]
                        ↓ 조회
                   [관리자 대시보드]
                        ↓ 상태 변경 (접수완료 → 처리중 → 처리완료)
```

## 2. 기술 스택 (기본 권장)

| 역할 | 기술 | 이유 |
|------|------|------|
| 풀스택 프레임워크 | **Next.js 14 (App Router)** | 프론트+API 단일 프로젝트 |
| DB (간단) | **SQLite + Prisma** | 서버 설치 없음, 로컬 파일 |
| DB (확장) | **Supabase** | 실시간 업데이트, 무료 tier |
| 역지오코딩 | **Kakao Maps API** | 한국 주소 정확도 최고 |
| 관리자 인증 | **HTTP Basic Auth** 또는 **NextAuth** | 빠른 구현 |
| 스타일 | **Tailwind CSS** | 모바일 최적화 쉬움 |
| 배포 | **Vercel** (SQLite 제외) / **Railway** | |

> SQLite는 Vercel 배포 불가. Vercel 배포 시 Supabase 또는 PlanetScale 사용.

## 3. 폴더 구조

```
qr-support-app/
├── app/
│   ├── page.tsx                  # (선택) 랜딩
│   ├── scan/
│   │   └── [productId]/
│   │       └── page.tsx          # ★ 고객 스캔 페이지
│   ├── admin/
│   │   ├── layout.tsx            # 관리자 인증 래퍼
│   │   └── page.tsx              # ★ 관리자 대시보드
│   └── api/
│       ├── request/
│       │   └── route.ts          # POST /api/request (고객 요청 접수)
│       ├── requests/
│       │   └── route.ts          # GET  /api/requests (관리자 목록 조회)
│       └── requests/[id]/
│           └── route.ts          # PATCH /api/requests/[id] (상태 변경)
├── prisma/
│   └── schema.prisma
├── lib/
│   ├── db.ts                     # Prisma 클라이언트
│   └── kakao.ts                  # 역지오코딩 유틸
├── components/
│   ├── PhoneInput.tsx             # 한국 전화번호 입력 컴포넌트
│   ├── LocationFetcher.tsx        # GPS + 주소 변환 컴포넌트
│   └── StatusBadge.tsx            # 상태 배지 컴포넌트
```

## 4. DB 스키마 (Prisma)

```prisma
model ServiceRequest {
  id          String   @id @default(cuid())
  productId   String                        // QR에 인코딩된 제품 ID
  phone       String
  latitude    Float
  longitude   Float
  address     String                        // 역지오코딩 결과 (예: "서울시 강남구 테헤란로 152")
  status      Status   @default(RECEIVED)
  memo        String?                       // 관리자 메모
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Status {
  RECEIVED    // 접수완료
  PROCESSING  // 처리중
  COMPLETED   // 처리완료
}
```

## 5. QR URL 구조

```
https://your-domain.com/scan/{productId}

예시:
https://your-domain.com/scan/PROD-001
https://your-domain.com/scan/SN-2024-ABC123
```

- `productId`는 제품 시리얼, 모델명, 또는 내부 코드로 자유 설정
- QR 생성은 외부 도구(qr.io, goqr.me, Adobe Express 등)에서 이 URL을 붙여넣으면 됩니다

## 6. 핵심 구현 상세

### 6-1. 고객 스캔 페이지 (`/scan/[productId]/page.tsx`)

구현 순서:
1. 페이지 진입 시 `navigator.geolocation.getCurrentPosition()` 호출
2. 위치 허용 → Kakao API로 위도/경도를 한국어 주소로 변환
3. 주소를 화면에 표시 (확인용)
4. 전화번호 입력 필드 (자동 포맷: `010-XXXX-XXXX`)
5. "지원 요청하기" 버튼 → `POST /api/request`
6. 성공 시 "접수 완료" 확인 화면

**UX 포인트:**
- 위치 로딩 중 스피너 표시
- 위치 거부 시 수동 주소 입력 fallback
- 전화번호 이전에 입력한 값 localStorage 캐싱 (재방문 시 자동 입력)

```typescript
// PhoneInput.tsx 핵심 로직
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
};
```

### 6-2. Kakao 역지오코딩 (`lib/kakao.ts`)

```typescript
// Kakao REST API Key는 .env에 저장
// NEXT_PUBLIC_KAKAO_REST_KEY=...

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
  });
  const data = await res.json();
  const doc = data.documents?.[0];
  if (!doc) return `${lat}, ${lng}`;
  return doc.road_address?.address_name || doc.address?.address_name || `${lat}, ${lng}`;
}
```

> 클라이언트 사이드에서는 REST Key 노출 금지. 반드시 서버사이드(API Route)에서 호출.

### 6-3. API Route: 요청 접수 (`POST /api/request`)

```typescript
// app/api/request/route.ts
export async function POST(req: Request) {
  const { productId, phone, latitude, longitude } = await req.json();

  // 서버에서 역지오코딩
  const address = await reverseGeocode(latitude, longitude);

  const record = await prisma.serviceRequest.create({
    data: { productId, phone, latitude, longitude, address },
  });

  return Response.json({ success: true, id: record.id });
}
```

### 6-4. 관리자 대시보드 (`/admin/page.tsx`)

필수 기능:
- 전체 요청 목록 (최신순)
- 필터: 상태별, 날짜별, 제품 ID 검색
- 각 행: 접수시각, 제품ID, 전화번호, 주소, 지도 링크, 상태 드롭다운, 메모
- 상태 변경 시 즉시 PATCH 요청 (낙관적 업데이트)
- 전화번호 클릭 → `tel:` 링크로 바로 전화 가능

**상태 색상 컨벤션:**
```
접수완료 (RECEIVED)   → 노란색 배지
처리중   (PROCESSING) → 파란색 배지
처리완료 (COMPLETED)  → 초록색 배지
```

### 6-5. 관리자 인증

빠른 구현 (HTTP Basic Auth via middleware):
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
export function middleware(req) {
  const auth = req.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${process.env.ADMIN_USER}:${process.env.ADMIN_PASS}`);
  if (req.nextUrl.pathname.startsWith('/admin') && auth !== expected) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    });
  }
}
export const config = { matcher: ['/admin/:path*', '/api/requests/:path*'] };
```

## 7. 환경변수 `.env.local`

```env
# DB
DATABASE_URL="file:./dev.db"           # SQLite
# DATABASE_URL="postgresql://..."      # Supabase

# Kakao
KAKAO_REST_KEY="your_kakao_rest_api_key"

# 관리자 인증
ADMIN_USER="admin"
ADMIN_PASS="your_secure_password"

# 앱 기본 URL
NEXT_PUBLIC_BASE_URL="https://your-domain.com"
```

## 8. 초기 셋업 커맨드

```bash
npx create-next-app@latest qr-support-app --typescript --tailwind --app
cd qr-support-app

# DB
npm install prisma @prisma/client
npx prisma init
# prisma/schema.prisma 작성 후:
npx prisma db push

# 기타
```

## 9. 구현 우선순위 (빠른 MVP 순서)

1. `prisma/schema.prisma` 작성 + `db push`
2. `POST /api/request` API Route
3. `/scan/[productId]` 고객 페이지 (GPS + 전화번호 + 전송)
4. `GET /api/requests` + `/admin` 대시보드 기본 목록
5. `PATCH /api/requests/[id]` + 상태 변경 UI
6. 관리자 인증 (middleware)
7. 배포

## 10. 추가 참고

- 상세 구현 예시 → `references/implementation-details.md`
- 배포 가이드 → `references/deployment.md`
- 보안 고려사항 → `references/security.md`
