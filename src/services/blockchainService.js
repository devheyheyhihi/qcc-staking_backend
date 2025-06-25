const axios = require('axios');
const Decimal = require('decimal.js');
const crypto = require('../lib/crypto');
require('dotenv').config();

class BlockchainService {
  constructor() {
    this.apiBaseUrl = process.env.QUANTUM_API_BASE_URL || 'https://qcc-backend.com';
    this.privateKey = process.env.PRIVATE_KEY;
    this.stakingPoolAddress = process.env.STAKING_POOL_ADDRESS;
    this.enableRealTransactions = process.env.ENABLE_REAL_TRANSACTIONS === 'true';
    
    // axios 인스턴스 생성
    this.api = axios.create({
      baseURL: this.apiBaseUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000 // 30초 타임아웃
    });
  }

  /**
   * 환경 설정 확인
   */
  checkConfiguration() {
    return {
      hasPrivateKey: !!this.privateKey,
      hasStakingPoolAddress: !!this.stakingPoolAddress,
      realTransactionsEnabled: this.enableRealTransactions,
      apiUrl: this.apiBaseUrl,
      stakingPoolAddress: this.stakingPoolAddress
    };
  }

  /**
   * 과학적 표기법을 일반 문자열로 변환
   */
  unscientificNotation(decimal) {
    return decimal.toFixed();
  }

  /**
   * 스테이킹 보상 전송 (실제 QCC 블록체인 전송)
   * @param {string} toAddress - 받을 지갑 주소
   * @param {number} amount - 전송할 금액
   * @param {string} memo - 메모 (선택사항)
   * @returns {Promise<string>} 트랜잭션 해시
   */
  async sendStakingReward({ toAddress, amount }) {
    try {
      console.log(`🔍 전송 설정 확인:`);
      console.log(`   📍 API URL: ${this.apiBaseUrl}`);
      console.log(`   🔑 Private Key: ${this.privateKey ? '✅ 설정됨' : '❌ 없음'}`);
      console.log(`   🏦 스테이킹 풀: ${this.stakingPoolAddress || '❌ 없음'}`);
      console.log(`   💸 실제 전송: ${this.enableRealTransactions ? '✅ 활성화' : '🔍 DRY RUN'}`);
      console.log(`   👤 수신자: ${toAddress}`);
      console.log(`   💰 금액: ${amount} QCC`);
      console.log(`   🔄 전송 방향: 스테이킹풀 → 사용자`);

      // Private Key 확인
      if (!this.privateKey) {
        throw new Error('Private Key가 설정되지 않았습니다');
      }

      // 스테이킹 풀 주소 확인
      if (!this.stakingPoolAddress) {
        throw new Error('스테이킹 풀 주소가 설정되지 않았습니다');
      }

      // DRY RUN 모드인 경우
      if (!this.enableRealTransactions) {
        console.log('🔍 [DRY RUN] 실제 전송 비활성화됨');
        return {
          success: true,
          isDryRun: true,
          txHash: `dry_run_${Date.now()}`,
          output: 'DRY RUN - 실제 전송 안됨'
        };
      }

      // 실제 전송 로직
      console.log('🚀 실제 블록체인 전송 시작...');
      
      // 1. 금액을 18자리 소수점으로 변환 (1e18 곱하기)
      const amountWithDecimals = this.unscientificNotation(
        new Decimal(amount.toString()).times(1e18)
      );
      
      console.log(`   💎 변환된 금액: ${amountWithDecimals} (wei 단위)`);

      // 2. 서버에서 타임스탬프 가져오기
      console.log('   ⏰ 타임스탬프 요청...');
      const timeResponse = await this.api.get('/api/ts');
      const timestamp = timeResponse.data;
      
      console.log(`   ⏰ 타임스탬프: ${timestamp}`);

      // 3. 서명된 트랜잭션 데이터 생성
      console.log('   🔐 트랜잭션 서명 중...');
      const signedData = crypto.buildSendRequestData(
        this.privateKey,
        toAddress,
        amountWithDecimals,
        timestamp
      );

      console.log('   📡 블록체인에 브로드캐스트...');
      
      // 4. 블록체인에 트랜잭션 브로드캐스트
      const response = await this.api.post('/broadcast/', signedData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`   📡 브로드캐스트 응답:`, response.data);

      // 5. 응답 확인 - error 필드도 체크
      if (response.data.error) {
        throw new Error(`트랜잭션 실패: ${response.data.error}`);
      }
      
      if (response.data.output && response.data.output.includes('error')) {
        throw new Error(`트랜잭션 실패: ${response.data.output}`);
      }

      // 성공 - 실제 블록체인 트랜잭션 해시 추출
      let txHash = null;
      
      // 1순위: txhash 필드 (블록체인 응답에서 제공)
      if (response.data.txhash) {
        txHash = response.data.txhash;
      }
      // 2순위: txid 필드
      else if (response.data.txid) {
        txHash = response.data.txid;
      }
      // 3순위: hash 필드
      else if (response.data.hash) {
        txHash = response.data.hash;
      }
      // 4순위: 임시 해시 (실제 전송이지만 해시를 받지 못한 경우)
      else {
        txHash = `tx_${Date.now()}`;
        console.log('⚠️  블록체인에서 트랜잭션 해시를 받지 못했습니다. 임시 해시 사용:', txHash);
      }
      
      return {
        success: true,
        isDryRun: false,
        txHash: txHash,
        output: response.data.output || '전송 성공',
        fullResponse: response.data
      };

    } catch (error) {
      console.error('❌ 블록체인 전송 실패:', error.message);
      
      // 네트워크 오류인 경우
      if (error.code === 'ECONNABORTED') {
        throw new Error('네트워크 타임아웃: 블록체인 서버에 연결할 수 없습니다');
      }
      
      // API 오류인 경우
      if (error.response) {
        const errorMsg = error.response.data?.error || error.response.data?.output || error.message;
        throw new Error(`API 오류: ${errorMsg}`);
      }
      
      throw error;
    }
  }

  /**
   * 지갑 잔액 조회
   */
  async getBalance(address) {
    try {
      const response = await this.api.get(`/balance/${address}`);
      return {
        success: true,
        balance: response.data.balance || '0'
      };
    } catch (error) {
      console.error('잔액 조회 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 트랜잭션 상태 조회
   */
  async getTransactionStatus(txHash) {
    try {
      const response = await this.api.get(`/txs/${txHash}`);
      return {
        success: true,
        transaction: response.data
      };
    } catch (error) {
      console.error('트랜잭션 조회 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new BlockchainService();