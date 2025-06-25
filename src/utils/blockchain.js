const { ethers } = require('ethers');
require('dotenv').config();

/**
 * 블록체인 트랜잭션 유틸리티
 * QTC 토큰 전송 및 관련 기능 제공
 */

class BlockchainService {
  constructor() {
    this.privateKey = process.env.PRIVATE_KEY;
    this.rpcUrl = process.env.RPC_URL || 'https://rpc.qtum.info'; // 기본 QTUM RPC
    this.stakingPoolAddress = process.env.STAKING_POOL_ADDRESS;
    
    if (!this.privateKey) {
      throw new Error('PRIVATE_KEY가 .env 파일에 설정되지 않았습니다.');
    }
    
    // Provider 및 Wallet 초기화
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.wallet = new ethers.Wallet(this.privateKey, this.provider);
    
    console.log('🔗 블록체인 서비스 초기화 완료');
    console.log('📍 지갑 주소:', this.wallet.address);
  }

  /**
   * QTC 토큰 전송
   * @param {string} toAddress - 받는 주소
   * @param {string} amount - 전송할 QTC 양 (예: "1.5")
   * @param {string} memo - 트랜잭션 메모 (선택사항)
   * @returns {Promise<Object>} 트랜잭션 결과
   */
  async sendQTC(toAddress, amount, memo = '') {
    try {
      console.log(`💸 QTC 전송 시작: ${amount} QTC → ${toAddress}`);
      
      // 주소 검증
      if (!ethers.isAddress(toAddress)) {
        throw new Error(`잘못된 주소 형식: ${toAddress}`);
      }
      
      // 금액을 Wei 단위로 변환 (QTC는 18 decimals)
      const amountWei = ethers.parseEther(amount.toString());
      
      // 현재 잔액 확인
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`💰 현재 잔액: ${ethers.formatEther(balance)} QTC`);
      
      if (balance < amountWei) {
        throw new Error(`잔액 부족: 필요 ${amount} QTC, 보유 ${ethers.formatEther(balance)} QTC`);
      }
      
      // 가스 가격 및 한도 설정
      const gasPrice = await this.provider.getFeeData();
      
      // 트랜잭션 구성
      const transaction = {
        to: toAddress,
        value: amountWei,
        gasLimit: 21000, // 기본 전송 가스 한도
        gasPrice: gasPrice.gasPrice,
      };
      
      // 메모가 있으면 data 필드에 추가
      if (memo) {
        transaction.data = ethers.toUtf8Bytes(memo);
        transaction.gasLimit = 50000; // 데이터가 있을 때 가스 한도 증가
      }
      
      console.log('📋 트랜잭션 정보:', {
        to: transaction.to,
        value: ethers.formatEther(transaction.value),
        gasLimit: transaction.gasLimit.toString(),
        gasPrice: ethers.formatUnits(transaction.gasPrice, 'gwei') + ' gwei'
      });
      
      // 트랜잭션 전송
      console.log('🚀 트랜잭션 전송 중...');
      const txResponse = await this.wallet.sendTransaction(transaction);
      
      console.log('⏳ 트랜잭션 확인 대기 중...');
      console.log('🔗 트랜잭션 해시:', txResponse.hash);
      
      // 트랜잭션 확인 대기 (최대 3분)
      const receipt = await txResponse.wait(1); // 1 confirmation
      
      const result = {
        success: true,
        transactionHash: txResponse.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        from: this.wallet.address,
        to: toAddress,
        amount: amount,
        timestamp: new Date().toISOString(),
        memo: memo
      };
      
      console.log('✅ 트랜잭션 성공!');
      console.log('📊 결과:', {
        hash: result.transactionHash,
        block: result.blockNumber,
        gasUsed: result.gasUsed
      });
      
      return result;
      
    } catch (error) {
      console.error('💥 트랜잭션 실패:', error.message);
      
      return {
        success: false,
        error: error.message,
        from: this.wallet.address,
        to: toAddress,
        amount: amount,
        timestamp: new Date().toISOString(),
        memo: memo
      };
    }
  }

  /**
   * 잔액 조회
   * @param {string} address - 조회할 주소 (선택사항, 기본값: 현재 지갑)
   * @returns {Promise<string>} QTC 잔액
   */
  async getBalance(address = null) {
    try {
      const targetAddress = address || this.wallet.address;
      const balance = await this.provider.getBalance(targetAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('잔액 조회 실패:', error.message);
      throw error;
    }
  }

  /**
   * 트랜잭션 상태 확인
   * @param {string} txHash - 트랜잭션 해시
   * @returns {Promise<Object>} 트랜잭션 정보
   */
  async getTransactionStatus(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      return {
        hash: txHash,
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
        blockNumber: receipt?.blockNumber || null,
        gasUsed: receipt?.gasUsed?.toString() || null,
        from: tx?.from || null,
        to: tx?.to || null,
        value: tx?.value ? ethers.formatEther(tx.value) : null
      };
    } catch (error) {
      console.error('트랜잭션 상태 확인 실패:', error.message);
      throw error;
    }
  }

  /**
   * 네트워크 정보 확인
   * @returns {Promise<Object>} 네트워크 정보
   */
  async getNetworkInfo() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.provider.getFeeData();
      
      return {
        chainId: network.chainId.toString(),
        name: network.name,
        currentBlock: blockNumber,
        gasPrice: ethers.formatUnits(gasPrice.gasPrice, 'gwei') + ' gwei'
      };
    } catch (error) {
      console.error('네트워크 정보 조회 실패:', error.message);
      throw error;
    }
  }
}

module.exports = BlockchainService;