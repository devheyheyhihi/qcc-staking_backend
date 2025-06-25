# Quantum Chain Staking Backend API

## 개요
Quantum Chain 스테이킹 플랫폼의 백엔드 API 서버입니다.

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm start
```

## API 엔드포인트

### 인증 (Authentication)

#### 지갑 연결
```
POST /api/auth/connect-wallet
Content-Type: application/json

{
  "wallet_address": "0x1234567890abcdef..."
}
```

#### 사용자 정보 조회
```
GET /api/auth/user/:wallet_address
```

### 스테이킹 (Staking)

#### 스테이킹 신청
```
POST /api/staking/create
Content-Type: application/json

{
  "wallet_address": "0x1234567890abcdef...",
  "amount": 1000,
  "period_days": 30
}
```

#### 스테이킹 내역 조회
```
GET /api/staking/history/:wallet_address
```

#### 활성 스테이킹 조회
```
GET /api/staking/active/:wallet_address
```

#### 스테이킹 기간 옵션 조회
```
GET /api/staking/periods
```

#### 수익 계산 (미리보기)
```
POST /api/staking/calculate
Content-Type: application/json

{
  "amount": 1000,
  "period_days": 30
}
```

### 사용자 (User)

#### 사용자 프로필 조회
```
GET /api/user/profile/:wallet_address
```

### 통계 (Statistics)

#### 사용자 통계 조회
```
GET /api/stats/user/:wallet_address
```

#### 플랫폼 통계 조회
```
GET /api/stats/platform
```

## 스테이킹 기간 및 APY

- 30일: 연 3% APY
- 90일: 연 6% APY  
- 180일: 연 10% APY
- 365일: 연 15% APY

## 데이터베이스

SQLite 데이터베이스를 사용하며, 다음 테이블들이 자동으로 생성됩니다:

- `users`: 사용자 정보
- `staking_records`: 스테이킹 기록
- `rewards`: 수익 기록
- `transactions`: 트랜잭션 로그

## 환경 변수

`.env` 파일에서 다음 변수들을 설정할 수 있습니다:

```
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
DB_PATH=./database.sqlite
```

## 테스트

서버가 실행되면 `http://localhost:5000`에서 API를 테스트할 수 있습니다.

기본 상태 확인:
```
GET http://localhost:5000/
```

## 주요 기능

1. **지갑 기반 사용자 관리**: 지갑 주소를 기반으로 사용자 계정 자동 생성
2. **스테이킹 관리**: 다양한 기간의 스테이킹 상품 제공
3. **수익 계산**: 복리 이자 기반 정확한 수익 계산
4. **실시간 통계**: 사용자별 스테이킹 현황 및 통계 제공
5. **RESTful API**: 표준 REST API 구조로 프론트엔드와 쉬운 연동 