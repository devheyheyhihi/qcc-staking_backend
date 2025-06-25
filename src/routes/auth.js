const express = require('express');
const User = require('../models/User');
const router = express.Router();

// 지갑 연결/등록
router.post('/connect-wallet', async (req, res) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: '지갑 주소가 필요합니다.'
      });
    }

    // 지갑 주소 형식 검증 (간단한 검증)
    if (wallet_address.length < 10) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 지갑 주소입니다.'
      });
    }

    // 사용자 찾기 또는 생성
    const user = await User.findOrCreate(wallet_address);

    res.json({
      success: true,
      data: {
        user_id: user.id,
        wallet_address: user.wallet_address,
        created_at: user.created_at
      },
      message: '지갑이 성공적으로 연결되었습니다.'
    });

  } catch (error) {
    console.error('지갑 연결 오류:', error);
    res.status(500).json({
      success: false,
      message: '지갑 연결 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 지갑 주소로 사용자 정보 조회
router.get('/user/:wallet_address', async (req, res) => {
  try {
    const { wallet_address } = req.params;

    const user = await User.findByWalletAddress(wallet_address);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        user_id: user.id,
        wallet_address: user.wallet_address,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 