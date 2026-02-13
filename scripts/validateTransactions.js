#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { validateTransaction } = require('../src/services/transactionValidator');

// 데이터베이스 연결
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// 유효하지 않은 트랜잭션 상태 변경 함수
function markInvalidTransaction(id, txHash, walletAddress, stakedAmount) {
  return new Promise((resolve, reject) => {
    const updateQuery = `
      UPDATE stakings 
      SET status = 'invalid',
          updated_at = datetime('now')
      WHERE id = ?
    `;
    
    db.run(updateQuery, [id], function(err) {
      if (err) {
        reject(new Error(`데이터베이스 업데이트 실패: ${err.message}`));
        return;
      }
      
      if (this.changes === 0) {
        reject(new Error('업데이트할 데이터를 찾을 수 없습니다'));
        return;
      }
      
      // 상태 변경 로그 기록
      console.log(`⚠️  invalid 처리됨: ID=${id}, 지갑=${walletAddress}, 금액=${stakedAmount}QCC, 해시=${txHash.substring(0, 16)}...`);
      resolve();
    });
  });
}

// 유효한 트랜잭션 상태 복구 함수
function markValidTransaction(id) {
  return new Promise((resolve, reject) => {
    const updateQuery = `
      UPDATE stakings
      SET status = 'active',
          updated_at = datetime('now')
      WHERE id = ?
    `;

    db.run(updateQuery, [id], function(err) {
      if (err) {
        reject(new Error(`데이터베이스 업데이트 실패: ${err.message}`));
        return;
      }

      if (this.changes === 0) {
        reject(new Error('업데이트할 데이터를 찾을 수 없습니다'));
        return;
      }

      resolve();
    });
  });
}

// 오래된 invalid 트랜잭션 삭제 함수
function deleteOldInvalidTransaction(id, txHash, walletAddress, stakedAmount) {
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

      console.log(`🗑️  자동 삭제됨: ID=${id}, 지갑=${walletAddress}, 금액=${stakedAmount}QCC, 해시=${txHash.substring(0, 16)}...`);
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
      AND status != 'invalid'
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
        markedInvalid: [],
        revalidated: {
          targetCount: 0,
          success: [],
          failed: []
        },
        deletedOldInvalid: []
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
          
          // 자동으로 유효하지 않은 트랜잭션 상태 변경
          try {
            await markInvalidTransaction(row.id, txHash, row.wallet_address, row.staked_amount);
            results.markedInvalid.push({
              id: row.id,
              txHash: txHash,
              wallet_address: row.wallet_address,
              staked_amount: row.staked_amount
            });
            console.log(`   ⚠️  invalid 처리 완료: ID ${row.id}`);
          } catch (deleteError) {
            console.log(`   ⚠️  invalid 처리 실패: ID ${row.id} - ${deleteError.message}`);
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

// 오래된 invalid 트랜잭션 재검증 및 자동 삭제
async function revalidateOldInvalidTransactions(results) {
  console.log('\n🔁 오래된 invalid 트랜잭션 재검증을 시작합니다...\n');

  return new Promise((resolve, reject) => {
    const query = `
      SELECT id, wallet_address, staked_amount, transaction_hash, status, created_at,
             CASE WHEN DATE(created_at) <= DATE('now', '-3 day') THEN 1 ELSE 0 END AS deletable
      FROM stakings
      WHERE status = 'invalid'
      AND DATE(created_at) <= DATE('now', '-2 day')
      ORDER BY id DESC
    `;

    db.all(query, [], async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      results.revalidated.targetCount = rows.length;
      console.log(`📊 재검증 대상 invalid 트랜잭션: ${rows.length}개\n`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const txHash = row.transaction_hash;

        if (!txHash) {
          results.revalidated.failed.push({
            id: row.id,
            reason: '트랜잭션 해시 없음'
          });
          console.log(`   ⚠️  해시 없음: ID ${row.id}`);
          continue;
        }

        console.log(`[${i + 1}/${rows.length}] 재검증 중: ${txHash.substring(0, 16)}...`);

        const validation = await validateTransaction(txHash);

        if (validation.isValid) {
          try {
            await markValidTransaction(row.id);
            results.revalidated.success.push({
              id: row.id,
              txHash: txHash
            });
            console.log(`   ✅ 재검증 성공: active 복구 (ID ${row.id})`);
          } catch (updateError) {
            results.revalidated.failed.push({
              id: row.id,
              reason: updateError.message
            });
            console.log(`   ⚠️  복구 실패: ID ${row.id} - ${updateError.message}`);
          }
          continue;
        }

        console.log(`   ❌ 재검증 실패 (${validation.status}): ${validation.error}`);
        results.revalidated.failed.push({
          id: row.id,
          reason: validation.error,
          http_status: validation.status
        });

        // 3일 이상 invalid이면 자동 삭제
        if (row.deletable === 1) {
          try {
            await deleteOldInvalidTransaction(row.id, txHash, row.wallet_address, row.staked_amount);
            results.deletedOldInvalid.push({
              id: row.id,
              txHash: txHash,
              wallet_address: row.wallet_address,
              staked_amount: row.staked_amount
            });
            console.log(`   🗑️  3일 이상 invalid 자동 삭제: ID ${row.id}`);
          } catch (deleteError) {
            results.errors.push({
              id: row.id,
              error: deleteError.message
            });
            console.log(`   ⚠️  자동 삭제 실패: ID ${row.id} - ${deleteError.message}`);
          }
        }

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
  console.log(`⚠️  invalid 처리된 트랜잭션: ${results.markedInvalid.length}개`);
  console.log(`⚠️  invalid 처리 실패: ${results.errors.length}개`);
  console.log(`🔁 재검증 대상: ${results.revalidated.targetCount}개`);
  console.log(`✅ 재검증 성공(복구): ${results.revalidated.success.length}개`);
  console.log(`❌ 재검증 실패: ${results.revalidated.failed.length}개`);
  console.log(`🗑️  자동 삭제(3일 이상 invalid): ${results.deletedOldInvalid.length}개`);
  
  if (results.markedInvalid.length > 0) {
    console.log('\n⚠️  invalid 처리된 트랜잭션 목록:');
    console.log('-'.repeat(80));
    
    results.markedInvalid.forEach((tx, index) => {
      console.log(`${index + 1}. ID: ${tx.id} | 지갑: ${tx.wallet_address} | 금액: ${tx.staked_amount} QCC`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  invalid 처리 실패한 트랜잭션:');
    console.log('-'.repeat(80));
    
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ID: ${error.id} | 오류: ${error.error}`);
    });
  }

  if (results.revalidated.failed.length > 0) {
    console.log('\n❌ 재검증 실패 목록:');
    console.log('-'.repeat(80));
    results.revalidated.failed.forEach((item, index) => {
      console.log(`${index + 1}. ID: ${item.id} | 오류: ${item.reason}`);
    });
  }

  if (results.deletedOldInvalid.length > 0) {
    console.log('\n🗑️  자동 삭제된 invalid 트랜잭션 목록:');
    console.log('-'.repeat(80));
    results.deletedOldInvalid.forEach((tx, index) => {
      console.log(`${index + 1}. ID: ${tx.id} | 지갑: ${tx.wallet_address} | 금액: ${tx.staked_amount} QCC`);
    });
  }
  
  console.log('\n📊 요약:');
  console.log(`- 검증 대상: ${results.valid.length + results.invalid.length}개`);
  console.log(`- 유효한 트랜잭션: ${results.valid.length}개`);
  console.log(`- invalid 처리 완료: ${results.markedInvalid.length}개`);
  console.log(`- invalid 처리 실패: ${results.errors.length}개`);
  console.log(`- 재검증 대상: ${results.revalidated.targetCount}개`);
  console.log(`- 재검증 성공(복구): ${results.revalidated.success.length}개`);
  console.log(`- 재검증 실패: ${results.revalidated.failed.length}개`);
  console.log(`- 자동 삭제: ${results.deletedOldInvalid.length}개`);
  
  console.log('\n' + '='.repeat(80));
}

// 메인 실행
async function main() {
  try {
    console.log(`🕐 크론 작업 시작: ${new Date().toLocaleString('ko-KR')}`);
    console.log('📅 처리 대상: 전날 등록된 스테이킹 데이터');
    
    const results = await findInvalidTransactions();
    await revalidateOldInvalidTransactions(results);
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
