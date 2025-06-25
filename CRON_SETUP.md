# 스테이킹 만료 처리 크론 작업 설정

## 📋 개요

이 프로젝트는 만료된 스테이킹을 자동으로 처리하기 위한 크론 작업을 제공합니다.
매일 자정(00:00)과 낮 12시(12:00)에 자동으로 실행되어 만료된 스테이킹에 대해 원금 + 이자를 사용자에게 반환합니다.

## 🚀 설정 방법

### 1. 환경 변수 설정

`.env` 파일에 다음 변수들이 설정되어 있어야 합니다:

```bash
# 블록체인 설정
QUANTUM_API_BASE_URL=https://qcc-backend.com
PRIVATE_KEY=your_private_key_here
STAKING_POOL_ADDRESS=your_staking_pool_address

# 실제 전송 활성화 (production에서만 true)
ENABLE_REAL_TRANSACTIONS=true
```

### 2. 크론 작업 등록

```bash
# NPM 명령어 사용
npm run cron:start

# 또는 직접 스크립트 실행
./scripts/cron-manager.sh start
```

## 🔧 크론 관리 명령어

### NPM 명령어

```bash
# 크론 작업 시작 (등록)
npm run cron:start

# 크론 작업 중지 (제거)
npm run cron:stop

# 크론 작업 상태 확인
npm run cron:status

# 최근 실행 로그 확인
npm run cron:logs

# 수동 테스트 실행
npm run cron:test
```

### 직접 스크립트 실행

```bash
# 크론 관리 도구 사용법
./scripts/cron-manager.sh [start|stop|status|logs|test]

# 예시
./scripts/cron-manager.sh status   # 상태 확인
./scripts/cron-manager.sh logs     # 로그 확인
./scripts/cron-manager.sh test     # 수동 테스트
```

## ⏰ 실행 스케줄

현재 설정된 크론 스케줄:

- **매일 자정 (00:00)**: 만료된 스테이킹 처리
- **매일 낮 12시 (12:00)**: 추가 안전장치로 재처리

## 📁 로그 관리

### 로그 파일 위치
```
backend/logs/cron-expired-YYYYMMDD.log
```

### 로그 파일 예시
```
backend/logs/cron-expired-20250624.log
backend/logs/cron-expired-20250625.log
```

### 로그 확인 방법
```bash
# 최근 로그 확인
npm run cron:logs

# 특정 날짜 로그 확인
cat logs/cron-expired-20250624.log

# 실시간 로그 모니터링 (새 로그 생성 시)
tail -f logs/cron-expired-$(date +%Y%m%d).log
```

## 🔍 트러블슈팅

### 1. 크론 작업이 실행되지 않는 경우

```bash
# 크론 서비스 상태 확인
npm run cron:status

# 크론 작업이 등록되었는지 확인
crontab -l

# 수동 테스트 실행
npm run cron:test
```

### 2. 권한 문제

```bash
# 스크립트 실행 권한 확인
ls -la scripts/cron-process-expired.sh
ls -la scripts/cron-manager.sh

# 권한 부여 (필요시)
chmod +x scripts/cron-process-expired.sh
chmod +x scripts/cron-manager.sh
```

### 3. 환경 변수 문제

```bash
# 환경 변수 확인
cat .env

# 테스트 실행으로 설정 확인
npm run cron:test
```

## 📊 모니터링

### 상태 확인
```bash
# 전체 상태 확인
npm run cron:status

# 스테이킹 통계 확인
npm run check-expired

# 만료 예정 스테이킹 확인
npm run check-upcoming
```

### 로그 모니터링
```bash
# 최근 실행 결과 확인
npm run cron:logs

# 특정 기간 로그 확인
ls -la logs/cron-expired-*.log
```

## 🚨 주의사항

1. **Production 환경에서만 `ENABLE_REAL_TRANSACTIONS=true` 설정**
2. **Private Key와 Staking Pool Address 보안 관리**
3. **로그 파일 정기적 확인 (30일 후 자동 삭제됨)**
4. **네트워크 연결 상태 확인**
5. **블록체인 API 서버 상태 확인**

## 📝 수동 실행

크론 작업 외에도 수동으로 만료 처리를 실행할 수 있습니다:

```bash
# 실제 처리 (ENABLE_REAL_TRANSACTIONS=true 시)
npm run check-expired

# 드라이런 (테스트 모드)
npm run check-expired-dry

# 만료 예정 확인 (7일 내)
npm run check-upcoming
```

## 🔄 업데이트 시 주의사항

1. 크론 작업 중지
2. 코드 업데이트
3. 테스트 실행
4. 크론 작업 재시작

```bash
npm run cron:stop
# 코드 업데이트...
npm run cron:test
npm run cron:start
``` 