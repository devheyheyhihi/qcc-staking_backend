/**
 * 스테이킹 이자 계산 유틸리티
 */

/**
 * 단리 이자 계산 (기본 계산 방식)
 * @param {number} principal - 원금
 * @param {number} annualRate - 연 이자율 (%)
 * @param {number} days - 스테이킹 기간 (일)
 * @returns {number} 이자 금액
 */
function calculateInterestReward(principal, annualRate, days) {
  // 일 이자율 계산
  const dailyRate = annualRate / 100 / 365;
  
  // 단리 계산: Interest = P * r * t
  const interestAmount = principal * dailyRate * days;
  
  // 소수점 8자리까지 반올림 (QTC 정밀도)
  return Math.round(interestAmount * 100000000) / 100000000;
}

/**
 * 복리 이자 계산 (참고용)
 * @param {number} principal - 원금
 * @param {number} annualRate - 연 이자율 (%)
 * @param {number} days - 스테이킹 기간 (일)
 * @returns {number} 이자 금액
 */
function calculateCompoundInterest(principal, annualRate, days) {
  // 일 이자율 계산
  const dailyRate = annualRate / 100 / 365;
  
  // 복리 계산: A = P(1 + r)^n - P
  const compoundAmount = principal * Math.pow(1 + dailyRate, days);
  const interestAmount = compoundAmount - principal;
  
  // 소수점 8자리까지 반올림 (QTC 정밀도)
  return Math.round(interestAmount * 100000000) / 100000000;
}

/**
 * 단리 이자 계산 (별칭 - 호환성 유지)
 * @param {number} principal - 원금
 * @param {number} annualRate - 연 이자율 (%)
 * @param {number} days - 스테이킹 기간 (일)
 * @returns {number} 이자 금액
 */
function calculateSimpleInterest(principal, annualRate, days) {
  return calculateInterestReward(principal, annualRate, days);
}

/**
 * 기간별 예상 수익률 계산
 * @param {number} amount - 스테이킹 금액
 * @param {number} days - 기간
 * @returns {object} 수익률 정보
 */
function calculateExpectedReturns(amount, days) {
  const rates = {
    30: 5.0,   // 30일: 5%
    90: 8.0,   // 90일: 8%
    180: 12.0, // 180일: 12%
    365: 20.0  // 365일: 20%
  };
  
  const rate = rates[days] || 5.0;
  const interest = calculateInterestReward(amount, rate, days);
  const total = amount + interest;
  
  return {
    principal: amount,
    interestRate: rate,
    period: days,
    interestAmount: interest,
    totalReturn: total,
    roi: (interest / amount) * 100 // ROI 퍼센트
  };
}

/**
 * 중도 해지 시 패널티 계산
 * @param {number} principal - 원금
 * @param {number} interestRate - 이자율
 * @param {number} totalDays - 전체 기간
 * @param {number} elapsedDays - 경과 기간
 * @param {number} penaltyRate - 패널티율 (기본 50%)
 * @returns {object} 중도 해지 정보
 */
function calculateEarlyWithdrawal(principal, interestRate, totalDays, elapsedDays, penaltyRate = 0.5) {
  // 경과 기간에 대한 이자 계산
  const earnedInterest = calculateInterestReward(principal, interestRate, elapsedDays);
  
  // 패널티 적용
  const penaltyAmount = earnedInterest * penaltyRate;
  const finalInterest = earnedInterest - penaltyAmount;
  const totalReturn = principal + finalInterest;
  
  return {
    principal,
    elapsedDays,
    totalDays,
    earnedInterest,
    penaltyRate: penaltyRate * 100,
    penaltyAmount,
    finalInterest,
    totalReturn,
    lossAmount: penaltyAmount
  };
}

/**
 * 스테이킹 상태 분석
 * @param {object} staking - 스테이킹 정보
 * @returns {object} 상태 분석 결과
 */
function analyzeStakingStatus(staking) {
  const now = new Date();
  const startDate = new Date(staking.start_date);
  const endDate = new Date(staking.end_date);
  
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  
  const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  
  let status = 'active';
  if (now >= endDate) {
    status = 'expired';
  } else if (remainingDays <= 3) {
    status = 'expiring_soon';
  }
  
  return {
    status,
    totalDays,
    elapsedDays,
    remainingDays,
    progress: Math.round(progress * 100) / 100,
    isExpired: now >= endDate,
    isExpiringSoon: remainingDays <= 3 && remainingDays > 0
  };
}

module.exports = {
  calculateInterestReward,
  calculateCompoundInterest,
  calculateSimpleInterest,
  calculateExpectedReturns,
  calculateEarlyWithdrawal,
  analyzeStakingStatus
};