const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
      } else {
        console.log('✅ SQLite 데이터베이스 연결 성공');
        this.initTables();
      }
    });
  }

  initTables() {
    this.db.serialize(() => {
      // 스테이킹 테이블 생성 (transaction_hash 컬럼 포함)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS stakings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_address TEXT NOT NULL,
          staked_amount REAL NOT NULL,
          staking_period INTEGER NOT NULL,
          interest_rate REAL NOT NULL,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          expected_reward REAL NOT NULL,
          actual_reward REAL DEFAULT NULL,
          transaction_hash TEXT DEFAULT NULL,
          return_transaction_hash TEXT DEFAULT NULL,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ 스테이킹 테이블 생성 실패:', err.message);
        } else {
          console.log('✅ 스테이킹 테이블 생성 완료');
          this.createInterestRateTable();
        }
      });
    });
  }

  createInterestRateTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS interest_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period INTEGER NOT NULL UNIQUE,
        rate REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ 이자율 테이블 생성 실패:', err.message);
      } else {
        console.log('✅ 이자율 테이블 생성 완료');
        this.insertDefaultInterestRates();
      }
    });
  }

  insertDefaultInterestRates() {
    // 데이터가 이미 있는지 확인
    this.db.get('SELECT COUNT(*) as count FROM interest_rates', (err, row) => {
      if (err) {
        console.error('❌ 이자율 데이터 확인 실패:', err.message);
        return;
      }

      // 데이터가 없는 경우에만 기본값 삽입
      if (row.count === 0) {
        console.log('🌱 기본 이자율 데이터 삽입 중...');
        const defaultRates = [
          { period: 30, rate: 3.0 },
          { period: 90, rate: 6.0 },
          { period: 180, rate: 10.0 },
          { period: 365, rate: 15.0 }
        ];

        const stmt = this.db.prepare(`
          INSERT INTO interest_rates (period, rate) VALUES (?, ?)
        `);

        defaultRates.forEach(({ period, rate }) => {
          stmt.run([period, rate], (err) => {
            if (err) {
              console.error(`❌ 기본 이자율 삽입 실패 (${period}일):`, err.message);
            }
          });
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('❌ 기본 이자율 삽입 완료 실패:', err.message);
          } else {
            console.log('✅ 기본 이자율 데이터 삽입 완료');
          }
          // 관리자 테이블 생성은 항상 호출
          this.createAdminAuthTable();
        });
      } else {
        console.log('✅ 기존 이자율 데이터가 존재하여, 삽입을 건너뜁니다.');
        // 관리자 테이블 생성은 항상 호출
        this.createAdminAuthTable();
      }
    });
  }

  createAdminAuthTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS admin_auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('❌ 관리자 인증 테이블 생성 실패:', err.message);
      } else {
        console.log('✅ 관리자 인증 테이블 생성 완료');
        
        // 기본 관리자 비밀번호 설정
        this.setDefaultAdminPassword();
      }
    });
  }

  async setDefaultAdminPassword() {
    try {
      // bcrypt는 여기서 직접 사용하지 않고, AdminAuth 모델을 통해 설정
      // 하지만 초기화 시에는 직접 설정
      const bcrypt = require('bcrypt');
      const defaultPassword = 'admin123!@#'; // 기본 비밀번호
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);
      
      // 기존 관리자 계정이 있는지 확인
      this.db.get('SELECT id FROM admin_auth LIMIT 1', [], (err, row) => {
        if (err) {
          console.error('❌ 관리자 계정 확인 실패:', err.message);
        } else if (!row) {
          // 기존 계정이 없으면 기본 계정 생성
          this.db.run(
            'INSERT INTO admin_auth (password_hash) VALUES (?)',
            [hashedPassword],
            function(err) {
              if (err) {
                console.error('❌ 기본 관리자 계정 생성 실패:', err.message);
              } else {
                console.log('✅ 기본 관리자 계정 생성 완료 (비밀번호: admin123!@#)');
                console.log('⚠️  보안을 위해 관리자 페이지에서 비밀번호를 변경해주세요!');
              }
            }
          );
        } else {
          console.log('✅ 기존 관리자 계정이 존재합니다.');
        }
        
        // 인덱스 생성
        this.createIndexes();
      });
    } catch (error) {
      console.error('❌ 기본 관리자 비밀번호 설정 실패:', error.message);
      this.createIndexes();
    }
  }

  createIndexes() {
    this.db.serialize(() => {
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_wallet_address ON stakings (wallet_address)`, (err) => {
        if (err) console.error('지갑 주소 인덱스 생성 실패:', err.message);
      });
      
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON stakings (status)`, (err) => {
        if (err) console.error('상태 인덱스 생성 실패:', err.message);
      });
      
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_end_date ON stakings (end_date)`, (err) => {
        if (err) console.error('만료일 인덱스 생성 실패:', err.message);
      });
      
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_transaction_hash ON stakings (transaction_hash)`, (err) => {
        if (err) console.error('트랜잭션 해시 인덱스 생성 실패:', err.message);
        else console.log('📋 데이터베이스 인덱스 생성 완료');
      });
    });
  }

  getDb() {
    return this.db;
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('데이터베이스 종료 실패:', err.message);
      } else {
        console.log('데이터베이스 연결 종료');
      }
    });
  }
}

const database = new Database();
module.exports = database; 