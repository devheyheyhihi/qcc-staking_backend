const axios = require('axios');
require('dotenv').config();

const apiBaseUrl = process.env.QUANTUM_API_BASE_URL || 'https://qcc-backend.com';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000
});

async function validateTransaction(txHash) {
  try {
    const response = await api.get(`/txs/${txHash}`);
    return {
      isValid: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message,
      status: error.response?.status || 'unknown'
    };
  }
}

module.exports = {
  validateTransaction,
  apiBaseUrl
};
