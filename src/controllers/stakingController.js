const Staking = require('../models/Staking');
const InterestRate = require('../models/InterestRate');
const AdminAuth = require('../models/AdminAuth');

// 보상 계산 함수
const calculateReward = (stakedAmount, interestRate, periodDays) => {
  // 단리 계산: 원금 × (연이율 / 100) × (기간 / 365)
  return stakedAmount * (interestRate / 100) * (periodDays / 365);
};

// 날짜 계산 함수
const calculateEndDate = (startDate, periodDays) => {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + periodDays);
  return end.toISOString();
};

// 지갑 주소 유효성 검사 (간단한 형태로 수정)
const isValidWalletAddress = (address) => {
  return typeof address === 'string' && address.length > 10;
};

class StakingController {
  // 스테이킹 신청 (블록체인 전송 해시 포함)
  async createStaking(req, res) {
    try {
      const { walletAddress, stakedAmount, stakingPeriod, transactionHash } = req.body;

      // 입력값 검증
      if (!walletAddress || !stakedAmount || !stakingPeriod) {
        return res.status(400).json({
          success: false,
          message: '필수 필드가 누락되었습니다. (walletAddress, stakedAmount, stakingPeriod 필요)'
        });
      }

      // 지갑 주소 형식 검증
      if (!isValidWalletAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: '올바르지 않은 지갑 주소 형식입니다.'
        });
      }

      // 금액 검증
      if (stakedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: '스테이킹 금액은 0보다 커야 합니다.'
        });
      }

      // DB에서 이자율 조회
      const interestRateData = await InterestRate.findByPeriod(stakingPeriod);
      if (!interestRateData) {
        return res.status(400).json({
          success: false,
          message: '허용되지 않은 스테이킹 기간입니다. (30, 90, 180, 365일만 가능)'
        });
      }

      const interestRate = interestRateData.rate;

      // 스테이킹 데이터 준비
      const now = new Date().toISOString();
      const startDate = now;
      const endDate = calculateEndDate(startDate, stakingPeriod);
      const expectedReward = calculateReward(stakedAmount, interestRate, stakingPeriod);

      const stakingData = {
        walletAddress,
        stakedAmount,
        stakingPeriod,
        interestRate,
        startDate,
        endDate,
        expectedReward,
        transactionHash // 블록체인 전송 해시 추가
      };

      // 스테이킹 생성
      const newStaking = await Staking.create(stakingData);

      res.status(201).json({
        success: true,
        message: '스테이킹이 성공적으로 신청되었습니다.',
        data: {
          ...newStaking,
          totalAmount: stakedAmount + expectedReward
        }
      });

    } catch (error) {
      console.error('스테이킹 신청 오류:', error);
      res.status(500).json({
        success: false,
        message: '스테이킹 신청 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 특정 지갑의 스테이킹 목록 조회
  async getStakingsByWallet(req, res) {
    try {
      const { walletAddress } = req.params;

      if (!isValidWalletAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: '올바르지 않은 지갑 주소 형식입니다.'
        });
      }

      const stakings = await Staking.findByWalletAddress(walletAddress);
      
      res.json({
        success: true,
        data: stakings,
        count: stakings.length
      });

    } catch (error) {
      console.error('스테이킹 목록 조회 오류:', error);
      res.status(500).json({
        success: false,
        message: '스테이킹 목록 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 특정 스테이킹 상세 조회
  async getStakingById(req, res) {
    try {
      const { id } = req.params;

      const staking = await Staking.findById(id);
      
      if (!staking) {
        return res.status(404).json({
          success: false,
          message: '스테이킹을 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: staking
      });

    } catch (error) {
      console.error('스테이킹 조회 오류:', error);
      res.status(500).json({
        success: false,
        message: '스테이킹 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 전체 스테이킹 목록 조회
  async getAllStakings(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const status = req.query.status || null;

      // 페이지와 제한값 유효성 검사
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: '잘못된 페이지 또는 제한값입니다. (page >= 1, 1 <= limit <= 100)'
        });
      }

      const result = await Staking.findAll(page, limit, status);
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        count: result.data.length
      });

    } catch (error) {
      console.error('전체 스테이킹 목록 조회 오류:', error);
      res.status(500).json({
        success: false,
        message: '전체 스테이킹 목록 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 스테이킹 취소 (중도 해지)
  async cancelStaking(req, res) {
    try {
      const { id } = req.params;
      const { walletAddress } = req.body;

      if (!isValidWalletAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: '올바르지 않은 지갑 주소 형식입니다.'
        });
      }

      // 스테이킹 존재 및 소유권 확인
      const staking = await Staking.findById(id);
      if (!staking) {
        return res.status(404).json({
          success: false,
          message: '스테이킹을 찾을 수 없습니다.'
        });
      }

      if (staking.wallet_address !== walletAddress) {
        return res.status(403).json({
          success: false,
          message: '본인의 스테이킹만 취소할 수 있습니다.'
        });
      }

      // 실제 블록체인 트랜잭션을 포함한 취소 처리
      const result = await Staking.cancel(id, walletAddress);

      res.json({
        success: true,
        message: result.message,
        data: {
          stakingId: id,
          transactionHash: result.transactionHash,
          returnedAmount: result.returnedAmount,
          isDryRun: result.isDryRun
        }
      });

    } catch (error) {
      console.error('스테이킹 취소 오류:', error);
      res.status(500).json({
        success: false,
        message: error.message || '스테이킹 취소 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 스테이킹 통계 조회
  async getStakingStats(req, res) {
    try {
      const { walletAddress } = req.query;

      if (walletAddress && !isValidWalletAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: '올바르지 않은 지갑 주소 형식입니다.'
        });
      }

      const stats = await Staking.getStats(walletAddress);

      res.json({
        success: true,
        data: {
          totalStakings: stats.total_count || 0,
          activeStakings: stats.active_count || 0,
          totalActiveAmount: stats.total_active_amount || 0,
          totalEarnedRewards: stats.total_earned_rewards || 0
        }
      });

    } catch (error) {
      console.error('스테이킹 통계 조회 오류:', error);
      res.status(500).json({
        success: false,
        message: '스테이킹 통계 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 만료된 스테이킹 처리 (배치 작업용)
  async processExpiredStakings(req, res) {
    try {
      const expiredStakings = await Staking.findExpiredStakings();
      
      const results = [];
      for (const staking of expiredStakings) {
        try {
          const result = await Staking.complete(staking.id);
          results.push(result);
        } catch (error) {
          console.error(`스테이킹 ${staking.id} 완료 처리 실패:`, error);
        }
      }

      res.json({
        success: true,
        message: `${results.length}개의 만료된 스테이킹이 처리되었습니다.`,
        data: results
      });

    } catch (error) {
      console.error('만료 스테이킹 처리 오류:', error);
      res.status(500).json({
        success: false,
        message: '만료 스테이킹 처리 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 현재 이자율 정보
  async getInterestRates(req, res) {
    try {
      const rates = await InterestRate.findAll();
      
      // 프론트엔드에서 사용하기 쉽도록 포맷팅
      const formattedRates = rates.map(rate => ({
        period: rate.period,
        rate: rate.rate,
        name: `${rate.period}일`,
        label: rate.period === 30 ? '1개월' : 
               rate.period === 90 ? '3개월' : 
               rate.period === 180 ? '6개월' : '1년',
        updated_at: rate.updated_at
      }));

      res.json({
        success: true,
        data: formattedRates
      });
    } catch (error) {
      console.error('이자율 조회 오류:', error);
      res.status(500).json({
        success: false,
        message: '이자율 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 이자율 수정 (관리자 전용)
  async updateInterestRates(req, res) {
    try {
      const { password, rates } = req.body;

      // 관리자 패스워드 확인 - AdminAuth 모델 사용
      const authResult = await AdminAuth.authenticate(password);
      if (!authResult.success) {
        return res.status(401).json({
          success: false,
          message: authResult.message
        });
      }

      // 이자율 데이터 유효성 검증
      if (!rates || typeof rates !== 'object') {
        return res.status(400).json({
          success: false,
          message: '올바른 이자율 데이터가 필요합니다.'
        });
      }

      // 필수 기간들이 모두 포함되어 있는지 확인
      const requiredPeriods = ['30', '90', '180', '365'];
      for (const period of requiredPeriods) {
        if (!(period in rates) || typeof rates[period] !== 'number' || rates[period] < 0) {
          return res.status(400).json({
            success: false,
            message: `${period}일 기간의 올바른 이자율이 필요합니다.`
          });
        }
      }

      // DB에 이자율 업데이트
      const updatedRates = await InterestRate.updateMultipleRates(rates);

      // 업데이트된 전체 이자율 조회
      const allRates = await InterestRate.findAll();

      res.json({
        success: true,
        message: '이자율이 성공적으로 업데이트되었습니다.',
        data: allRates,
        updated: updatedRates
      });

    } catch (error) {
      console.error('이자율 업데이트 오류:', error);
      res.status(500).json({
        success: false,
        message: '이자율 업데이트 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 관리자 비밀번호 변경
  async changeAdminPassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      // 입력값 검증
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: '현재 비밀번호와 새 비밀번호가 모두 필요합니다.'
        });
      }

      // 새 비밀번호 강도 검사
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: '새 비밀번호는 최소 8자 이상이어야 합니다.'
        });
      }

      // 비밀번호 변경
      const result = await AdminAuth.changePassword(currentPassword, newPassword);

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      console.error('관리자 비밀번호 변경 오류:', error);
      res.status(500).json({
        success: false,
        message: '비밀번호 변경 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 관리자 계정 상태 확인
  async getAdminStatus(req, res) {
    try {
      const status = await AdminAuth.getStatus();
      
      res.json({
        success: true,
        data: status.data
      });

    } catch (error) {
      console.error('관리자 상태 확인 오류:', error);
      res.status(500).json({
        success: false,
        message: '관리자 상태 확인 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }

  // 관리자 로그인 인증
  async adminLogin(req, res) {
    try {
      const { password } = req.body;

      // 입력값 검증
      if (!password) {
        return res.status(400).json({
          success: false,
          message: '관리자 비밀번호가 필요합니다.'
        });
      }

      // 관리자 패스워드 확인
      const authResult = await AdminAuth.authenticate(password);
      
      if (authResult.success) {
        res.json({
          success: true,
          message: '관리자 인증이 완료되었습니다.',
          data: {
            authenticated: true,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(401).json({
          success: false,
          message: authResult.message || '관리자 비밀번호가 올바르지 않습니다.'
        });
      }

    } catch (error) {
      console.error('관리자 로그인 인증 오류:', error);
      res.status(500).json({
        success: false,
        message: '관리자 인증 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  }
}

module.exports = new StakingController(); 