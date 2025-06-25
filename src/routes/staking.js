const express = require('express');
const router = express.Router();
const stakingController = require('../controllers/stakingController');

// 이자율 정보 조회
router.get('/rates', stakingController.getInterestRates);

// 이자율 수정 (관리자 전용)
router.put('/rates', stakingController.updateInterestRates);

// 관리자 로그인 인증
router.post('/admin/login', stakingController.adminLogin);

// 관리자 계정 상태 확인
router.get('/admin/status', stakingController.getAdminStatus);

// 관리자 비밀번호 변경
router.put('/admin/password', stakingController.changeAdminPassword);

// 스테이킹 통계 조회
router.get('/stats', stakingController.getStakingStats);

// 만료된 스테이킹 처리 (관리자용)
router.post('/process-expired', stakingController.processExpiredStakings);

// 전체 스테이킹 목록 조회
router.get('/all', stakingController.getAllStakings);

// 스테이킹 신청
router.post('/', stakingController.createStaking);

// 특정 지갑의 스테이킹 목록 조회
router.get('/wallet/:walletAddress', stakingController.getStakingsByWallet);

// 특정 스테이킹 상세 조회
router.get('/:id', stakingController.getStakingById);

// 스테이킹 취소 (중도 해지)
router.put('/:id/cancel', stakingController.cancelStaking);

module.exports = router; 