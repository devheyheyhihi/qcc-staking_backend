const express = require('express');
const router = express.Router();

// 스테이킹 설정 조회
router.get('/config', (req, res) => {
  try {
    const config = {
      stakingWalletAddress: process.env.STAKING_POOL_ADDRESS,
      apiUrl: process.env.QUANTUM_API_BASE_URL || 'https://qcc-backend.com',
      // 필요한 다른 설정들도 여기에 추가 가능
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('설정 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '설정 조회 중 오류가 발생했습니다'
    });
  }
});

module.exports = router; 