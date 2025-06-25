const axios = require('axios');
const { buildSendRequestData } = require('./crypto');
const Decimal = require('decimal.js');

const QUANTUM_API_BASE_URL = process.env.QUANTUM_API_BASE_URL || 'https://qcc-backend.com';

// axios 인스턴스 생성
const api = axios.create({
  baseURL: QUANTUM_API_BASE_URL,
  timeout: 30000,
});

// 과학적 표기법을 일반 표기법으로 변환
const unscientificNotation = (decimal) => {
  return decimal.toFixed();
};

// 트랜잭션 전송
const sendTransaction = async ({ privateKey, toAddress, amount }) => {
  try {
    // 18자리 정밀도로 변환
    const amountWithDecimals = unscientificNotation(
      new Decimal(amount.toString()).times(1e18),
    );

    // 타임스탬프 가져오기
    const sTime = await api.get("/api/ts");

    // 서명된 트랜잭션 데이터 생성
    const data = buildSendRequestData(
      privateKey,
      toAddress,
      amountWithDecimals,
      sTime.data,
    );

    // 트랜잭션 브로드캐스트
    const response = await api.post("/broadcast/", data, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // 에러 체크
    if (response.data.output && response.data.output.includes("error")) {
      throw new Error("Failed to send transaction: " + response.data.output);
    }

    return response.data;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
};

// 트랜잭션 상세 정보 조회
const getTransactionDetails = async (txHash) => {
  try {
    const response = await api.get(`/txs/${txHash}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get transaction details:', error);
    throw error;
  }
};

// 트랜잭션 검증 (존재하는지 확인)
const verifyTransaction = async (txHash) => {
  try {
    const txDetails = await getTransactionDetails(txHash);
    return {
      exists: true,
      details: txDetails
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
};

module.exports = {
  sendTransaction,
  getTransactionDetails,
  verifyTransaction
};