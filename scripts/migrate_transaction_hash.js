const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 데이터베이스 경로 설정
const dbPath = path.join(__dirname, '../database/staking.db');
const sqlFilePath = path.join(__dirname, '../database/add_transaction_hash.sql');

// 마이그레이션 실행
function runMigration() {
  return new Promise((resolve, reject) => {
    // SQL 파일 읽기
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // 데이터베이스 연결
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('데이터베이스 연결 실패:', err);
        reject(err);
        return;
      }
      console.log('데이터베이스 연결 성공');
    });

    // SQL 실행
    db.exec(sqlScript, (err) => {
      if (err) {
        console.error('마이그레이션 실패:', err);
        reject(err);
      } else {
        console.log('✅ transaction_hash 컬럼 추가 완료!');
        console.log('✅ 인덱스 생성 완료!');
        resolve();
      }
      
      // 데이터베이스 연결 종료
      db.close((err) => {
        if (err) {
          console.error('데이터베이스 종료 오류:', err);
        } else {
          console.log('데이터베이스 연결 종료');
        }
      });
    });
  });
}

// 마이그레이션 실행
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 마이그레이션 완료!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 마이그레이션 실패:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };