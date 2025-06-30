const Staking = require('../models/Staking');
// const { calculateInterestReward } = require('../utils/stakingCalculator');
const blockchainService = require('../services/blockchainService');
require('dotenv').config();


function calculateInterestReward(principal, annualRate, days) {
    // 일 이자율 계산
    const dailyRate = annualRate / 100 / 365;

    // 단리 계산: Interest = P * r * t
    const interestAmount = principal * dailyRate * days;

    // 소수점 8자리까지 반올림 (QTC 정밀도)
    return Math.round(interestAmount * 100000000) / 100000000;
}
  

/**
 * 만료된 스테이킹 처리 메인 함수
 */
async function processExpiredStakings() {
  console.log('🔍 만료된 스테이킹 확인 작업 시작...');
  console.log('📅 현재 시간:', new Date().toLocaleString('ko-KR'));
  
  // 환경 설정 확인
  const config = blockchainService.checkConfiguration();
  console.log('⚙️  환경 설정 상태:');
  console.log(`   🔑 Private Key: ${config.hasPrivateKey ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`   🏦 Staking Pool: ${config.hasStakingPoolAddress ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`   💸 실제 전송: ${config.realTransactionsEnabled ? '✅ 활성화' : '🔍 DRY RUN 모드'}`);
  console.log(`   🌐 API URL: ${config.apiUrl}`);
  console.log('');
  
  try {
    // 1. 만료된 스테이킹 조회
    const expiredStakings = await Staking.findExpiredStakings();
    
    if (expiredStakings.length === 0) {
      console.log('✅ 만료된 스테이킹이 없습니다.');
      return;
    }
    
    console.log(`📋 처리할 만료 스테이킹: ${expiredStakings.length}개`);
    console.log('');
    
    // 2. 각 만료된 스테이킹 처리
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < expiredStakings.length; i++) {
      const staking = expiredStakings[i];
      console.log(`⏳ [${i + 1}/${expiredStakings.length}] 스테이킹 ID ${staking.id} 처리 중...`);
      
      try {
        await processSingleStaking(staking);
        successCount++;
        console.log(`✅ 스테이킹 ID ${staking.id} 처리 완료`);
      } catch (error) {
        failCount++;
        console.error(`❌ 스테이킹 ID ${staking.id} 처리 실패:`, error.message);
      }
      
      console.log('');
    }
    
    // 3. 결과 요약
    console.log('📊 처리 결과 요약:');
    console.log(`   ✅ 성공: ${successCount}개`);
    console.log(`   ❌ 실패: ${failCount}개`);
    console.log(`   📈 총 처리: ${expiredStakings.length}개`);
    
  } catch (error) {
    console.error('💥 만료 스테이킹 처리 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 개별 스테이킹 처리
 */
async function processSingleStaking(staking) {
  console.log(`   👤 지갑: ${staking.wallet_address}`);
  console.log(`   💰 원금: ${staking.staked_amount} QCC`);
  console.log(`   📅 기간: ${staking.staking_period}일`);
  console.log(`   📊 이자율: ${staking.interest_rate}%`);
  console.log(`   ⏰ 만료일: ${staking.end_date}`);
  
  // 1. 이자 계산
  const interestAmount = calculateInterestReward(
    staking.staked_amount,
    staking.interest_rate,
    staking.staking_period
  );
  
  const totalReturnAmount = parseFloat(staking.staked_amount) + parseFloat(interestAmount);
  
  console.log(`   🎯 이자: ${interestAmount} QCC`);
  console.log(`   💎 총 반환액: ${totalReturnAmount} QCC`);
  
  // 2. 실제 블록체인 송금
  let transactionHash = null;
  let isDryRun = false;
  
  try {
    console.log(`   🚀 블록체인 송금 시작...`);
    
    const txResult = await blockchainService.sendStakingReward({
      toAddress: staking.wallet_address,
      amount: totalReturnAmount.toString()
    });
    
    if (txResult.success) {
      transactionHash = txResult.txHash;
      isDryRun = txResult.isDryRun || false;
      
      if (isDryRun) {
        console.log(`   🔍 [DRY RUN] 가상 송금 성공! 트랜잭션: ${transactionHash}`);
        console.log(`   📤 DRY RUN 결과: ${txResult.output}`);
      } else {
        console.log(`   ✅ 실제 송금 성공! 트랜잭션: ${transactionHash}`);
        console.log(`   📤 송금 결과: ${txResult.output}`);
      }
      
      // 3. 트랜잭션이 성공했을 때만 데이터베이스 상태 업데이트
      await Staking.updateStatusWithTransaction(staking.id, 'completed', interestAmount, transactionHash);
      console.log(`   ✨ 데이터베이스 업데이트 완료`);
      
    } else {
      throw new Error(txResult.error || '송금 실패');
    }
    
  } catch (error) {
    console.error(`   ❌ 블록체인 송금 실패: ${error.message}`);
    // 트랜잭션 실패 시 DB 업데이트 하지 않음
    throw new Error(`블록체인 송금 실패: ${error.message}`);
  }
}

/**
 * 만료 예정 스테이킹 조회 (알림용)
 */
async function getUpcomingExpirations(days = 3) {
  console.log(`🔔 ${days}일 내 만료 예정 스테이킹 조회...`);
  
  try {
    const upcomingStakings = await Staking.findUpcomingExpirations(days);
    
    if (upcomingStakings.length === 0) {
      console.log(`✅ ${days}일 내 만료 예정 스테이킹이 없습니다.`);
      return [];
    }
    
    console.log(`📋 ${days}일 내 만료 예정: ${upcomingStakings.length}개`);
    
    upcomingStakings.forEach((staking, index) => {
      console.log(`   ${index + 1}. ID ${staking.id} - ${staking.wallet_address} - ${staking.end_date}`);
    });
    
    return upcomingStakings;
    
  } catch (error) {
    console.error('만료 예정 스테이킹 조회 실패:', error);
    return [];
  }
}

/**
 * 스테이킹 통계 출력
 */
async function printStakingStats() {
  console.log('📈 스테이킹 현황 통계:');
  
  try {
    const stats = await Staking.getStats();
    const activeStakings = await Staking.findActiveStakings();
    
    console.log(`   📊 총 스테이킹 수: ${stats.total_count}개`);
    console.log(`   🟢 활성 스테이킹: ${stats.active_count}개`);
    console.log(`   💰 총 활성 금액: ${stats.total_active_amount || 0} QCC`);
    console.log(`   🎁 총 지급 보상: ${stats.total_earned_rewards || 0} QCC`);
    
  } catch (error) {
    console.error('통계 조회 실패:', error);
  }
}

// 직접 실행 시
if (require.main === module) {
  (async () => {
    try {
      console.log('🚀 스테이킹 만료 처리 프로그램 시작');
      console.log('='.repeat(50));
      
      // 현재 통계 출력
      await printStakingStats();
      console.log('');
      
      // 만료 예정 스테이킹 확인
      await getUpcomingExpirations(3);
      console.log('');
      
      // 만료된 스테이킹 처리
      await processExpiredStakings();
      
      console.log('');
      console.log('='.repeat(50));
      console.log('🎉 작업 완료!');
      
    } catch (error) {
      console.error('💥 프로그램 실행 중 오류:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  processExpiredStakings,
  getUpcomingExpirations,
  printStakingStats
};