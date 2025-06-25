#!/bin/bash

# 크론 작업 관리 스크립트
# 사용법: ./cron-manager.sh [start|stop|status|logs|test]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRONTAB_CONFIG="$PROJECT_DIR/crontab-config.txt"
LOG_DIR="$PROJECT_DIR/logs"

case "$1" in
    "start")
        echo "🚀 크론 작업 시작..."
        if [ -f "$CRONTAB_CONFIG" ]; then
            crontab "$CRONTAB_CONFIG"
            echo "✅ 크론 작업이 등록되었습니다."
            echo "📋 등록된 작업:"
            crontab -l | grep -v "^#"
        else
            echo "❌ 크론 설정 파일을 찾을 수 없습니다: $CRONTAB_CONFIG"
            exit 1
        fi
        ;;
        
    "stop")
        echo "🛑 크론 작업 중지..."
        crontab -r 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ 모든 크론 작업이 제거되었습니다."
        else
            echo "ℹ️  제거할 크론 작업이 없습니다."
        fi
        ;;
        
    "status")
        echo "📊 크론 작업 상태:"
        echo "===================="
        
        # 크론 서비스 상태 확인 (macOS)
        if pgrep -x "cron" > /dev/null || launchctl list | grep -q "com.vix.cron"; then
            echo "🟢 크론 서비스: 실행 중"
        else
            echo "🔴 크론 서비스: 중지됨"
        fi
        
        # 등록된 크론 작업 확인
        if crontab -l > /dev/null 2>&1; then
            echo "📋 등록된 크론 작업:"
            crontab -l | grep -v "^#" | grep -v "^$" | while read line; do
                echo "   ⏰ $line"
            done
        else
            echo "❌ 등록된 크론 작업이 없습니다."
        fi
        
        # 최근 로그 파일 확인
        echo ""
        echo "📁 최근 로그 파일:"
        if [ -d "$LOG_DIR" ]; then
            ls -lt "$LOG_DIR"/cron-expired-*.log 2>/dev/null | head -5 | while read line; do
                echo "   📄 $line"
            done
        else
            echo "   ❌ 로그 디렉토리가 없습니다."
        fi
        ;;
        
    "logs")
        echo "📋 최근 크론 실행 로그:"
        echo "====================="
        
        if [ -d "$LOG_DIR" ]; then
            # 가장 최근 로그 파일 표시
            LATEST_LOG=$(ls -t "$LOG_DIR"/cron-expired-*.log 2>/dev/null | head -1)
            if [ -n "$LATEST_LOG" ]; then
                echo "📄 파일: $(basename "$LATEST_LOG")"
                echo "---"
                tail -50 "$LATEST_LOG"
            else
                echo "❌ 로그 파일이 없습니다."
            fi
        else
            echo "❌ 로그 디렉토리가 없습니다."
        fi
        ;;
        
    "test")
        echo "🧪 크론 스크립트 테스트 실행..."
        echo "================================"
        
        CRON_SCRIPT="$SCRIPT_DIR/cron-process-expired.sh"
        if [ -f "$CRON_SCRIPT" ]; then
            echo "📍 스크립트 경로: $CRON_SCRIPT"
            echo "⏳ 실행 중..."
            echo ""
            
            "$CRON_SCRIPT"
            
            echo ""
            echo "✅ 테스트 완료! 로그를 확인하세요:"
            echo "   ./cron-manager.sh logs"
        else
            echo "❌ 크론 스크립트를 찾을 수 없습니다: $CRON_SCRIPT"
            exit 1
        fi
        ;;
        
    *)
        echo "🔧 크론 작업 관리 도구"
        echo "====================="
        echo ""
        echo "사용법: $0 [명령어]"
        echo ""
        echo "명령어:"
        echo "  start   - 크론 작업 시작 (등록)"
        echo "  stop    - 크론 작업 중지 (제거)"
        echo "  status  - 크론 작업 상태 확인"
        echo "  logs    - 최근 실행 로그 보기"
        echo "  test    - 스크립트 수동 테스트 실행"
        echo ""
        echo "예시:"
        echo "  $0 start    # 크론 작업 등록"
        echo "  $0 status   # 상태 확인"
        echo "  $0 logs     # 로그 확인"
        echo "  $0 test     # 수동 테스트"
        echo "  $0 stop     # 크론 작업 제거"
        ;;
esac 