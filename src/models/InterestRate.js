const database = require('../config/database');

class InterestRate {
  constructor() {
    this.db = database.getDb();
  }

  // 모든 이자율 조회
  async findAll() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM interest_rates 
        ORDER BY period ASC
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

  // 특정 기간의 이자율 조회
  async findByPeriod(period) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM interest_rates WHERE period = ?`;

      this.db.get(sql, [period], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 이자율 업데이트
  async updateRate(period, rate) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE interest_rates 
        SET rate = ?, updated_at = CURRENT_TIMESTAMP
        WHERE period = ?
      `;

      this.db.run(sql, [rate, period], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            period, 
            rate, 
            changes: this.changes 
          });
        }
      });
    });
  }

  // 이자율 생성 또는 업데이트
  async createOrUpdate(period, rate) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO interest_rates (period, rate, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;

      this.db.run(sql, [period, rate], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            period, 
            rate, 
            id: this.lastID || null 
          });
        }
      });
    });
  }

  // 여러 이자율 일괄 업데이트
  async updateMultipleRates(rates) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO interest_rates (period, rate, updated_at) 
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `);

        const results = [];
        let errorOccurred = false;

        for (const [period, rate] of Object.entries(rates)) {
          stmt.run([parseInt(period), parseFloat(rate)], function(err) {
            if (err) {
              errorOccurred = true;
              console.error(`이자율 업데이트 실패 (${period}일):`, err);
            } else {
              results.push({ period: parseInt(period), rate: parseFloat(rate) });
            }
          });
        }

        stmt.finalize((err) => {
          if (err || errorOccurred) {
            this.db.run('ROLLBACK');
            reject(err || new Error('이자율 업데이트 중 오류 발생'));
          } else {
            this.db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                reject(commitErr);
              } else {
                resolve(results);
              }
            });
          }
        });
      });
    });
  }

  // 이자율 삭제 (필요시)
  async delete(period) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM interest_rates WHERE period = ?`;

      this.db.run(sql, [period], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            period, 
            changes: this.changes 
          });
        }
      });
    });
  }

  // 이자율 통계
  async getStats() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_rates,
          MIN(rate) as min_rate,
          MAX(rate) as max_rate,
          AVG(rate) as avg_rate
        FROM interest_rates
      `;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = new InterestRate(); 