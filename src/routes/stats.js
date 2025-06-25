const express = require('express');
const StakingService = require('../services/stakingService');
const router = express.Router();

// 사용자 통계 조회
router.get('/user/:wallet_address', async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: '지갑 주소가 필요합니다.'
      });
    }

    const result = await StakingService.getUserStats(wallet_address);
    res.json(result);

  } catch (error) {
    console.error('사용자 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 전체 플랫폼 통계 (추후 구현)
router.get('/platform', async (req, res) => {
  try {
    // 추후 전체 플랫폼 통계 구현
    res.json({
      success: true,
      data: {
        total_users: 0,
        total_staked: 0,
        total_rewards: 0,
        active_stakings: 0
      },
      message: '전체 통계 기능은 추후 구현 예정입니다.'
    });

  } catch (error) {
    console.error('플랫폼 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '플랫폼 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 