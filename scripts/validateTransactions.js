#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

// 데이터베이스 연결
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const QCC_API_BASE = 'https://qcc-backend.com';

// 트랜잭션 검증 함수
async function validateTransaction(txHash) {
  try {
    const response = await axios.get(`${QCC_API_BASE}/txs/${txHash}`, {
      timeout: 10000
    });
    
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

// 유효하지 않은 트랜잭션 삭제 함수
function deleteInvalidTransaction(id, txHash, walletAddress, stakedAmount) {
  return new Promise((resolve, reject) => {
    const deleteQuery = `DELETE FROM stakings WHERE id = ?`;
    
    db.run(deleteQuery, [id], function(err) {
      if (err) {
        reject(new Error(`데이터베이스 삭제 실패: ${err.message}`));
        return;
      }
      
      if (this.changes === 0) {
        reject(new Error('삭제할 데이터를 찾을 수 없습니다'));
        return;
      }
      
      // 삭제 로그 기록
      console.log(`🗑️  삭제된 스테이킹: ID=${id}, 지갑=${walletAddress}, 금액=${stakedAmount}QCC, 해시=${txHash.substring(0, 16)}...`);
      resolve();
    });
  });
}

// 유효하지 않은 트랜잭션 찾기 (전날 데이터만)
async function findInvalidTransactions() {
  console.log('🔍 전날 등록된 트랜잭션 검증을 시작합니다...\n');
  
  return new Promise((resolve, reject) => {
    // 전날 데이터만 조회 (created_at이 어제인 데이터)
    const query = `
      SELECT id, wallet_address, staked_amount, transaction_hash, status, created_at 
      FROM stakings 
      WHERE transaction_hash IS NOT NULL 
      AND transaction_hash != '' 
      AND DATE(created_at) = DATE('now', '-1 day')
      ORDER BY id DESC
    `;
    
    db.all(query, [], async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`📊 전날 등록된 ${rows.length}개의 트랜잭션을 검증합니다...\n`);
      
      const results = {
        valid: [],
        invalid: [],
        errors: [],
        deleted: []
      };
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const txHash = row.transaction_hash;
        
        console.log(`[${i + 1}/${rows.length}] 검증 중: ${txHash.substring(0, 16)}...`);
        
        const validation = await validateTransaction(txHash);
        
        if (validation.isValid) {
          results.valid.push({
            id: row.id,
            txHash: txHash,
            amount: row.staked_amount,
            status: '✅ 유효'
          });
          console.log(`   ✅ 유효한 트랜잭션`);
        } else {
          results.invalid.push({
            id: row.id,
            wallet_address: row.wallet_address,
            staked_amount: row.staked_amount,
            txHash: txHash,
            status: row.status,
            created_at: row.created_at,
            error: validation.error,
            http_status: validation.status
          });
          console.log(`   ❌ 유효하지 않은 트랜잭션 (${validation.status}): ${validation.error}`);
          
          // 자동으로 유효하지 않은 트랜잭션 삭제
          try {
            await deleteInvalidTransaction(row.id, txHash, row.wallet_address, row.staked_amount);
            results.deleted.push({
              id: row.id,
              txHash: txHash,
              wallet_address: row.wallet_address,
              staked_amount: row.staked_amount
            });
            console.log(`   🗑️  삭제 완료: ID ${row.id}`);
          } catch (deleteError) {
            console.log(`   ⚠️  삭제 실패: ID ${row.id} - ${deleteError.message}`);
            results.errors.push({
              id: row.id,
              error: deleteError.message
            });
          }
        }
        
        // API 요청 제한을 위한 대기
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      resolve(results);
    });
  });
}

// 결과 출력
function printResults(results) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 전날 트랜잭션 검증 및 정리 결과');
  console.log('='.repeat(80));
  
  console.log(`\n✅ 유효한 트랜잭션: ${results.valid.length}개`);
  console.log(`❌ 유효하지 않은 트랜잭션: ${results.invalid.length}개`);
  console.log(`🗑️  자동 삭제된 트랜잭션: ${results.deleted.length}개`);
  console.log(`⚠️  삭제 실패: ${results.errors.length}개`);
  
  if (results.deleted.length > 0) {
    console.log('\n🗑️  삭제된 트랜잭션 목록:');
    console.log('-'.repeat(80));
    
    results.deleted.forEach((tx, index) => {
      console.log(`${index + 1}. ID: ${tx.id} | 지갑: ${tx.wallet_address} | 금액: ${tx.staked_amount} QCC`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  삭제 실패한 트랜잭션:');
    console.log('-'.repeat(80));
    
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ID: ${error.id} | 오류: ${error.error}`);
    });
  }
  
  console.log('\n📊 요약:');
  console.log(`- 검증 대상: ${results.valid.length + results.invalid.length}개`);
  console.log(`- 유효한 트랜잭션: ${results.valid.length}개`);
  console.log(`- 자동 삭제 완료: ${results.deleted.length}개`);
  console.log(`- 삭제 실패: ${results.errors.length}개`);
  
  console.log('\n' + '='.repeat(80));
}

// 메인 실행
async function main() {
  try {
    console.log(`🕐 크론 작업 시작: ${new Date().toLocaleString('ko-KR')}`);
    console.log('📅 처리 대상: 전날 등록된 스테이킹 데이터');
    
    const results = await findInvalidTransactions();
    printResults(results);
    
    // 크론 작업 완료 로그
    console.log(`\n✅ 크론 작업 완료: ${new Date().toLocaleString('ko-KR')}`);
    
  } catch (error) {
    console.error('❌ 크론 작업 오류:', error.message);
    console.error('스택 트레이스:', error.stack);
  } finally {
    db.close();
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { validateTransaction, findInvalidTransactions };
