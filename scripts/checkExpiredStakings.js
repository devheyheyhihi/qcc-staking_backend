#!/usr/bin/env node

/**
 * 만료된 스테이킹 확인 및 처리 스크립트
 * 
 * 사용법:
 * node scripts/checkExpiredStakings.js
 * node scripts/checkExpiredStakings.js --dry-run    # 실제 처리 없이 확인만
 * node scripts/checkExpiredStakings.js --upcoming 7 # 7일 내 만료 예정 확인
 */

const path = require('path');
const { processExpiredStakings, getUpcomingExpirations, printStakingStats } = require('../src/jobs/processExpiredStakings');

// 명령행 인수 파싱
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const upcomingIndex = args.indexOf('--upcoming');
const upcomingDays = upcomingIndex !== -1 ? parseInt(args[upcomingIndex + 1]) || 3 : null;

async function main() {
  console.log('🚀 스테이킹 만료 확인 스크립트 시작');
  console.log('📍 실행 위치:', __dirname);
  console.log('⏰ 실행 시간:', new Date().toLocaleString('ko-KR'));
  
  if (isDryRun) {
    console.log('🔍 DRY RUN 모드: 실제 처리 없이 확인만 수행');
  }
  
  console.log('='.repeat(60));
  
  try {
    // 1. 현재 스테이킹 통계 출력
    console.log('📊 현재 스테이킹 현황:');
    await printStakingStats();
    console.log('');
    
    // 2. 만료 예정 스테이킹 확인 (옵션)
    if (upcomingDays !== null) {
      console.log(`🔔 ${upcomingDays}일 내 만료 예정 스테이킹:`);
      const upcoming = await getUpcomingExpirations(upcomingDays);
      
      if (upcoming.length > 0) {
        upcoming.forEach((staking, index) => {
          const daysLeft = Math.ceil((new Date(staking.end_date) - new Date()) / (1000 * 60 * 60 * 24));
          console.log(`   ${index + 1}. ID ${staking.id} - ${staking.staked_amount} QTC - ${daysLeft}일 남음`);
          console.log(`      👤 ${staking.wallet_address}`);
          console.log(`      📅 ${staking.end_date}`);
        });
      }
      console.log('');
    }
    
    // 3. 만료된 스테이킹 처리
    if (isDryRun) {
      console.log('🔍 만료된 스테이킹 확인 (DRY RUN):');
      // DRY RUN 로직 구현
      const Staking = require('../src/models/Staking');
      const expiredStakings = await Staking.findExpiredStakings();
      
      if (expiredStakings.length === 0) {
        console.log('✅ 만료된 스테이킹이 없습니다.');
      } else {
        console.log(`📋 처리 대상 만료 스테이킹: ${expiredStakings.length}개`);
        expiredStakings.forEach((staking, index) => {
          console.log(`   ${index + 1}. ID ${staking.id} - ${staking.staked_amount} QTC`);
          console.log(`      👤 ${staking.wallet_address}`);
          console.log(`      📅 만료일: ${staking.end_date}`);
          console.log(`      💰 예상 보상: ${staking.expected_reward} QTC`);
        });
        console.log(`\\n⚠️  실제 처리하려면 --dry-run 옵션을 제거하고 다시 실행하세요.`);
      }
    } else {
      console.log('⚡ 만료된 스테이킹 실제 처리:');
      await processExpiredStakings();
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 스크립트 실행 완료!');
    
  } catch (error) {
    console.error('💥 스크립트 실행 중 오류 발생:');
    console.error(error);
    process.exit(1);
  }
}

// 도움말 출력
function printHelp() {
  console.log(`
📖 사용법:
  node scripts/checkExpiredStakings.js                # 만료된 스테이킹 처리
  node scripts/checkExpiredStakings.js --dry-run      # 확인만 (실제 처리 안함)
  node scripts/checkExpiredStakings.js --upcoming 7   # 7일 내 만료 예정 확인
  node scripts/checkExpiredStakings.js --help         # 도움말

📝 옵션:
  --dry-run          실제 처리 없이 확인만 수행
  --upcoming <days>  N일 내 만료 예정 스테이킹 확인
  --help             도움말 출력
  `);
}

// 도움말 요청 시
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

// 메인 함수 실행
main().catch(error => {
  console.error('스크립트 실행 실패:', error);
  process.exit(1);
});