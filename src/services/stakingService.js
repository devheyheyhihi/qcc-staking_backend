const User = require('../models/User');
const Staking = require('../models/Staking');

// 스테이킹 기간 설정 (프론트엔드와 동일)
const STAKING_PERIODS = [
  { days: 30, apy: 3.0 },
  { days: 90, apy: 6.0 },
  { days: 180, apy: 10.0 },
  { days: 365, apy: 15.0 }
];

class StakingService {
  // 스테이킹 신청
  static async createStaking(walletAddress, amount, periodDays) {
    try {
      // 사용자 찾기 또는 생성
      const user = await User.findOrCreate(walletAddress);
      
      // 스테이킹 기간 유효성 검사
      const period = STAKING_PERIODS.find(p => p.days === periodDays);
      if (!period) {
        throw new Error('유효하지 않은 스테이킹 기간입니다.');
      }

      // 스테이킹 시작일과 종료일 계산
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + periodDays);

      // 스테이킹 기록 생성
      const stakingData = {
        user_id: user.id,
        amount: parseFloat(amount),
        period_days: periodDays,
        apy: period.apy,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      };

      const staking = await Staking.create(stakingData);
      
      return {
        success: true,
        data: staking,
        message: '스테이킹이 성공적으로 신청되었습니다.'
      };
    } catch (error) {
      throw error;
    }
  }

  // 사용자 스테이킹 내역 조회
  static async getUserStakingHistory(walletAddress) {
    try {
      const stakingRecords = await Staking.findByWalletAddress(walletAddress);
      
      // 각 스테이킹에 대한 예상 수익 계산
      const enrichedRecords = stakingRecords.map(record => {
        const expectedReward = this.calculateExpectedReward(
          record.amount, 
          record.apy, 
          record.period_days
        );
        
        return {
          ...record,
          expected_reward: expectedReward,
          total_return: record.amount + expectedReward,
          progress: this.calculateProgress(record.start_date, record.end_date)
        };
      });

      return {
        success: true,
        data: enrichedRecords
      };
    } catch (error) {
      throw error;
    }
  }

  // 활성 스테이킹 조회
  static async getActiveStaking(walletAddress) {
    try {
      const activeStaking = await Staking.findActiveByWalletAddress(walletAddress);
      
      const enrichedRecords = activeStaking.map(record => {
        const expectedReward = this.calculateExpectedReward(
          record.amount, 
          record.apy, 
          record.period_days
        );
        
        return {
          ...record,
          expected_reward: expectedReward,
          total_return: record.amount + expectedReward,
          progress: this.calculateProgress(record.start_date, record.end_date),
          days_remaining: this.calculateDaysRemaining(record.end_date)
        };
      });

      return {
        success: true,
        data: enrichedRecords
      };
    } catch (error) {
      throw error;
    }
  }

  // 예상 수익 계산
  static calculateExpectedReward(amount, apy, days) {
    const dailyRate = apy / 100 / 365;
    const compoundInterest = amount * Math.pow(1 + dailyRate, days) - amount;
    return Math.round(compoundInterest * 100) / 100;
  }

  // 진행률 계산
  static calculateProgress(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const totalDuration = end - start;
    const elapsed = now - start;
    
    return Math.round((elapsed / totalDuration) * 100);
  }

  // 남은 일수 계산
  static calculateDaysRemaining(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    
    if (now > end) return 0;
    
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  // 사용자 통계 조회
  static async getUserStats(walletAddress) {
    try {
      const stakingRecords = await Staking.findByWalletAddress(walletAddress);
      const activeStaking = await Staking.findActiveByWalletAddress(walletAddress);
      
      const totalStaked = stakingRecords.reduce((sum, record) => sum + record.amount, 0);
      const activeAmount = activeStaking.reduce((sum, record) => sum + record.amount, 0);
      const totalExpectedReward = stakingRecords.reduce((sum, record) => {
        return sum + this.calculateExpectedReward(record.amount, record.apy, record.period_days);
      }, 0);

      return {
        success: true,
        data: {
          total_staked: totalStaked,
          active_amount: activeAmount,
          total_records: stakingRecords.length,
          active_records: activeStaking.length,
          total_expected_reward: totalExpectedReward
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // 스테이킹 기간 옵션 조회
  static getStakingPeriods() {
    return {
      success: true,
      data: STAKING_PERIODS
    };
  }
}

module.exports = StakingService; 