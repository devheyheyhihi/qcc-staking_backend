const express = require('express');
const User = require('../models/User');
const router = express.Router();

// 사용자 프로필 조회
router.get('/profile/:wallet_address', async (req, res) => {
  try {
    const { wallet_address } = req.params;

    if (!wallet_address) {
      return res.status(400).json({
        success: false,
        message: '지갑 주소가 필요합니다.'
      });
    }

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
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('사용자 프로필 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 프로필 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 