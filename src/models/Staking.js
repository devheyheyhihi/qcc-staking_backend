const database = require('../config/database');
const blockchainService = require('../services/blockchainService');

class Staking {
  constructor() {
    this.db = database.getDb();
  }

  // 스테이킹 신청 (블록체인 전송 해시 포함)
  async create(stakingData) {
    const {
      walletAddress,
      stakedAmount,
      stakingPeriod,
      interestRate,
      startDate,
      endDate,
      expectedReward,
      transactionHash // 블록체인 전송 해시 추가
    } = stakingData;

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO stakings (
          wallet_address, staked_amount, staking_period, interest_rate,
          start_date, end_date, expected_reward, transaction_hash, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `;

      this.db.run(sql, [
        walletAddress,
        stakedAmount,
        stakingPeriod,
        interestRate,
        startDate,
        endDate,
        expectedReward,
        transactionHash || null // null 값 허용
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            walletAddress,
            stakedAmount,
            stakingPeriod,
            interestRate,
            startDate,
            endDate,
            expectedReward,
            transactionHash,
            status: 'active'
          });
        }
      });
    });
  }

  // 특정 지갑의 스테이킹 목록 조회
  async findByWalletAddress(walletAddress) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM stakings 
        WHERE wallet_address = ? 
        ORDER BY created_at DESC
      `;

      this.db.all(sql, [walletAddress], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // snake_case를 camelCase로 변환
          const camelCaseRows = rows.map(row => ({
            id: row.id,
            walletAddress: row.wallet_address,
            stakedAmount: row.staked_amount,
            stakingPeriod: row.staking_period,
            interestRate: row.interest_rate,
            startDate: row.start_date,
            endDate: row.end_date,
            expectedReward: row.expected_reward,
            actualReward: row.actual_reward,
            transactionHash: row.transaction_hash, // 트랜잭션 해시 추가
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          resolve(camelCaseRows);
        }
      });
    });
  }

  // 특정 스테이킹 조회
  async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM stakings WHERE id = ?`;

      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 전체 스테이킹 목록 조회 (페이지네이션 지원)
  async findAll(page = 1, limit = 50, status = null, search = null) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * limit;
      let sql = `
        SELECT * FROM stakings 
      `;
      let countSql = `SELECT COUNT(*) as total FROM stakings`;
      let params = [];
      let countParams = [];

      // 상태 필터링
      if (status) {
        sql += ` WHERE status = ?`;
        countSql += ` WHERE status = ?`;
        params.push(status);
        countParams.push(status);
      }

      // 검색 필터링 (지갑주소/트랜잭션 해시)
      if (search) {
        const hasWhere = sql.includes('WHERE');
        const searchClause = `(wallet_address LIKE ? OR transaction_hash LIKE ? OR return_transaction_hash LIKE ?)`;
        sql += hasWhere ? ` AND ${searchClause}` : ` WHERE ${searchClause}`;
        countSql += countSql.includes('WHERE') ? ` AND ${searchClause}` : ` WHERE ${searchClause}`;
        const like = `%${search}%`;
        params.push(like, like, like);
        countParams.push(like, like, like);
      }

      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // 전체 개수 조회
      this.db.get(countSql, countParams, (err, countResult) => {
        if (err) {
          reject(err);
          return;
        }

        // 데이터 조회
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // snake_case를 camelCase로 변환
            const camelCaseRows = rows.map(row => ({
              id: row.id,
              walletAddress: row.wallet_address,
              stakedAmount: row.staked_amount,
              stakingPeriod: row.staking_period,
              interestRate: row.interest_rate,
              startDate: row.start_date,
              endDate: row.end_date,
              expectedReward: row.expected_reward,
              actualReward: row.actual_reward,
              transactionHash: row.transaction_hash,
              returnTransactionHash: row.return_transaction_hash,
              status: row.status,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }));

            resolve({
              data: camelCaseRows,
              pagination: {
                currentPage: page,
                totalPages: Math.ceil(countResult.total / limit),
                totalItems: countResult.total,
                itemsPerPage: limit
              }
            });
          }
        });
      });
    });
  }

  // 활성 스테이킹 목록 조회
  async findActiveStakings() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM stakings 
        WHERE status = 'active' 
        ORDER BY created_at DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 만료된 스테이킹 조회
  async findExpiredStakings() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM stakings 
        WHERE status = 'active' AND end_date <= datetime('now')
        ORDER BY end_date ASC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 만료 예정 스테이킹 조회 (N일 내)
  async findUpcomingExpirations(days = 3) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM stakings 
        WHERE status = 'active' 
        AND end_date > datetime('now') 
        AND end_date <= datetime('now', '+${days} days')
        ORDER BY end_date ASC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 스테이킹 상태 업데이트
  async updateStatus(id, status, actualReward = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE stakings 
        SET status = ?, actual_reward = ?, updated_at = datetime('now')
        WHERE id = ?
      `;

      this.db.run(sql, [status, actualReward, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, status, actualReward, changes: this.changes });
        }
      });
    });
  }

  // 스테이킹 삭제 (관리자용)
  async deleteById(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM stakings WHERE id = ?`;
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, changes: this.changes });
        }
      });
    });
  }

  // 스테이킹 상태 업데이트 (반환 트랜잭션 해시 포함)
  async updateStatusWithTransaction(id, status, actualReward = null, returnTransactionHash = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE stakings 
        SET status = ?, actual_reward = ?, return_transaction_hash = ?, updated_at = datetime('now')
        WHERE id = ?
      `;

      this.db.run(sql, [status, actualReward, returnTransactionHash, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            id, 
            status, 
            actualReward, 
            returnTransactionHash, 
            changes: this.changes 
          });
        }
      });
    });
  }

  /**
   * 스테이킹 취소 (실제 블록체인 트랜잭션 포함)
   * @param {number} id - 스테이킹 ID
   * @param {string} walletAddress - 지갑 주소 (검증용)
   * @returns {Promise<Object>} 취소 결과
   */
  async cancel(id, walletAddress) {
    try {
      // 1. 스테이킹 정보 조회
      const staking = await this.findById(id);
      if (!staking) {
        throw new Error('스테이킹을 찾을 수 없습니다');
      }

      // 2. 권한 확인 (지갑 주소 일치)
      if (staking.wallet_address !== walletAddress) {
        throw new Error('해당 스테이킹을 취소할 권한이 없습니다');
      }

      // 3. 상태 확인 (active만 취소 가능)
      if (staking.status !== 'active') {
        throw new Error('활성 상태의 스테이킹만 취소할 수 있습니다');
      }

      console.log(`🔄 스테이킹 취소 시작: ID ${id}, 원금 ${staking.staked_amount} QCC`);

      // 4. 실제 블록체인 트랜잭션 실행 (원금만 반환)
      const transactionResult = await blockchainService.sendStakingReward({
        toAddress: staking.wallet_address,
        amount: parseFloat(staking.staked_amount) // 원금만 반환
      });

      if (!transactionResult.success) {
        throw new Error('블록체인 트랜잭션 실행 실패');
      }

      console.log(`✅ 취소 트랜잭션 성공: ${transactionResult.txHash}`);

      // 5. 데이터베이스 업데이트
      const query = `
        UPDATE stakings 
        SET status = 'cancelled',
            actual_reward = 0,
            return_transaction_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await new Promise((resolve, reject) => {
        this.db.run(query, [transactionResult.txHash, id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      });

      console.log(`✅ 스테이킹 취소 완료: ID ${id}`);

      return {
        success: true,
        message: '스테이킹이 성공적으로 취소되었습니다',
        transactionHash: transactionResult.txHash,
        returnedAmount: staking.staked_amount,
        isDryRun: transactionResult.isDryRun || false
      };

    } catch (error) {
      console.error('❌ 스테이킹 취소 실패:', error.message);
      throw error;
    }
  }

  // 스테이킹 완료 처리
  async complete(id) {
    return new Promise((resolve, reject) => {
      this.findById(id).then(staking => {
        if (!staking) {
          reject(new Error('스테이킹을 찾을 수 없습니다.'));
          return;
        }

        // 만료일 도달 시 전체 보상 지급
        this.updateStatus(id, 'completed', staking.expected_reward).then(resolve).catch(reject);
      }).catch(reject);
    });
  }

  // 총 스테이킹 통계
  async getStats(walletAddress = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT 
          COUNT(*) as total_count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status = 'active' THEN staked_amount ELSE 0 END) as total_active_amount,
          SUM(CASE WHEN status = 'completed' THEN actual_reward ELSE 0 END) as total_earned_rewards
        FROM stakings
      `;
      
      const params = [];
      if (walletAddress) {
        sql += ` WHERE wallet_address = ?`;
        params.push(walletAddress);
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = new Staking(); 
