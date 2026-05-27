# 보안 고려사항

## 필수 처리 사항

### 1. 전화번호 유효성 검사 (서버)
```typescript
function isValidKoreanPhone(phone: string): boolean {
  return /^(010|011|016|017|018|019)\d{7,8}$/.test(phone.replace(/\D/g, ''));
}
```

### 2. 요청 중복 방지 (Rate Limiting)
```typescript
// IP 기반 rate limiting (간단 구현)
import { LRUCache } from 'lru-cache';
const rateLimit = new LRUCache<string, number>({ max: 500, ttl: 60_000 });

// POST /api/request 에서:
const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
const count = rateLimit.get(ip) ?? 0;
if (count > 5) return Response.json({ error: 'Too many requests' }, { status: 429 });
rateLimit.set(ip, count + 1);
```

### 3. 관리자 페이지 HTTPS 강제
- Vercel / Railway 배포 시 자동 처리
- 자체 서버: nginx SSL 설정 필수

### 4. 좌표값 범위 검증 (서버)
```typescript
// 한국 좌표 범위 체크
if (latitude < 33 || latitude > 43 || longitude < 124 || longitude > 132) {
  // 한국 외 좌표 → 수동 주소만 허용
}
```

### 5. 개인정보 처리 (PIPA 준수)
- 수집 목적 명시 (UI에 "서비스 지원 목적으로만 사용됩니다" 문구)
- 보관 기간 설정 후 자동 삭제 스케줄러
- 전화번호 DB 저장 시 마스킹 고려: `010-****-5678`

---

# 배포 가이드

## 옵션 A: Vercel + Supabase (추천, 무료)

```bash
# 1. Supabase 프로젝트 생성 → DATABASE_URL 복사
# 2. prisma/schema.prisma에서 provider를 "postgresql"로 변경
npx prisma db push

# 3. Vercel 배포
npm install -g vercel
vercel --prod

# 4. Vercel 환경변수 설정
vercel env add DATABASE_URL
vercel env add KAKAO_REST_KEY
vercel env add ADMIN_USER
vercel env add ADMIN_PASS
```

## 옵션 B: Railway (SQLite 포함, $5/월)

```bash
# railway.app → New Project → Deploy from GitHub
# 환경변수: DATABASE_URL="file:./prod.db"
# Volume 마운트: /app/prisma → 데이터 영속성 확보
```

## 옵션 C: 홈 Ubuntu 서버 (현재 서버 활용)

```bash
# PM2로 프로세스 관리
npm install -g pm2
npm run build
pm2 start npm --name "qr-support" -- start
pm2 save
pm2 startup

# nginx 리버스 프록시
# /etc/nginx/sites-available/qr-support
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}

# certbot SSL
sudo certbot --nginx -d your-domain.com
```

---

# 추가 기능 제안 (v2)

## 우선순위 높음
- [ ] **SMS 알림**: 관리자에게 새 요청 시 문자 발송 (알리고, 솔라피 API)
- [ ] **카카오 알림톡**: 고객에게 처리 상태 변경 시 알림
- [ ] **엑셀 내보내기**: 관리자 → 필터된 목록 `.xlsx` 다운로드
- [ ] **실시간 업데이트**: Supabase Realtime 또는 Server-Sent Events

## 우선순위 중간
- [ ] **지도 뷰**: 관리자 대시보드에 요청 위치 클러스터 지도
- [ ] **사진 첨부**: 고객이 제품 불량 사진 업로드 (Cloudinary/S3)
- [ ] **다국어**: 외국인 고객 대응 (영어 버전)

## 우선순위 낮음  
- [ ] **통계 대시보드**: 일별 접수량, 처리율 차트
- [ ] **담당자 배정**: 관리자 여러 명 계정 + 요청 배정
- [ ] **API 웹훅**: 외부 CRM/ERP 연동
