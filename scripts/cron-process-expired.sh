#!/bin/bash

# 크론 작업용 만료 스테이킹 처리 스크립트
# 매일 자정에 실행되어 만료된 스테이킹을 자동 처리

# 스크립트 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/cron-expired-$(date +%Y%m%d).log"

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 환경 변수 로드 (Node.js 경로 포함)
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export NODE_ENV=production

# 프로젝트 디렉토리로 이동
cd "$PROJECT_DIR"

# 로그 시작
echo "=====================================" >> "$LOG_FILE"
echo "🚀 크론 작업 시작: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "📁 작업 디렉토리: $PROJECT_DIR" >> "$LOG_FILE"
echo "=====================================" >> "$LOG_FILE"

# Node.js 버전 확인
echo "🔧 Node.js 버전: $(node --version)" >> "$LOG_FILE" 2>&1
echo "🔧 NPM 버전: $(npm --version)" >> "$LOG_FILE" 2>&1

# 만료 스테이킹 처리 실행
echo "⏳ 만료 스테이킹 처리 시작..." >> "$LOG_FILE"
npm run check-expired >> "$LOG_FILE" 2>&1

# 실행 결과 확인
if [ $? -eq 0 ]; then
    echo "✅ 크론 작업 성공: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
else
    echo "❌ 크론 작업 실패: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
fi

echo "=====================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 오래된 로그 파일 정리 (30일 이상)
find "$LOG_DIR" -name "cron-expired-*.log" -mtime +30 -delete 2>/dev/null

exit 0 