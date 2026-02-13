#!/bin/bash

# 크론 작업용 유효하지 않은 트랜잭션 검증/정리 스크립트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/validate-transactions-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export NODE_ENV=production

cd "$PROJECT_DIR"

echo "=====================================" >> "$LOG_FILE"
echo "🚀 크론 작업 시작: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "📁 작업 디렉토리: $PROJECT_DIR" >> "$LOG_FILE"
echo "=====================================" >> "$LOG_FILE"

echo "🔧 Node.js 버전: $(node --version)" >> "$LOG_FILE" 2>&1
echo "🔧 NPM 버전: $(npm --version)" >> "$LOG_FILE" 2>&1

echo "⏳ 전날 트랜잭션 검증 시작..." >> "$LOG_FILE"
node scripts/validateTransactions.js >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 크론 작업 성공: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
else
    echo "❌ 크론 작업 실패: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
fi

echo "=====================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 오래된 로그 파일 정리 (30일 이상)
find "$LOG_DIR" -name "validate-transactions-*.log" -mtime +30 -delete 2>/dev/null

exit 0
