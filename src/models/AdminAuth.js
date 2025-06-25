const database = require('../config/database');
const bcrypt = require('bcrypt');

class AdminAuth {
  constructor() {
    this.db = database.getDb();
  }

  // 비밀번호 해싱
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // 비밀번호 검증
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // 관리자 비밀번호 조회
  async getAdminPassword() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM admin_auth ORDER BY created_at DESC LIMIT 1`;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 관리자 비밀번호 인증
  async authenticate(password) {
    try {
      const adminData = await this.getAdminPassword();
      
      if (!adminData) {
        return { success: false, message: '관리자 계정이 설정되지 않았습니다.' };
      }

      const isValid = await this.verifyPassword(password, adminData.password_hash);
      
      if (isValid) {
        return { success: true, message: '인증 성공' };
      } else {
        return { success: false, message: '비밀번호가 올바르지 않습니다.' };
      }
    } catch (error) {
      console.error('관리자 인증 오류:', error);
      return { success: false, message: '인증 중 오류가 발생했습니다.' };
    }
  }

  // 관리자 비밀번호 설정/변경
  async setPassword(newPassword) {
    return new Promise(async (resolve, reject) => {
      try {
        const hashedPassword = await this.hashPassword(newPassword);
        
        // 기존 비밀번호가 있는지 확인
        const existingAdmin = await this.getAdminPassword();
        
        let sql, params;
        if (existingAdmin) {
          // 업데이트
          sql = `UPDATE admin_auth SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
          params = [hashedPassword, existingAdmin.id];
        } else {
          // 새로 생성
          sql = `INSERT INTO admin_auth (password_hash, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
          params = [hashedPassword];
        }

        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              message: existingAdmin ? '비밀번호가 변경되었습니다.' : '관리자 비밀번호가 설정되었습니다.',
              id: existingAdmin ? existingAdmin.id : this.lastID
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 비밀번호 변경 (기존 비밀번호 확인 후)
  async changePassword(currentPassword, newPassword) {
    try {
      // 현재 비밀번호 확인
      const authResult = await this.authenticate(currentPassword);
      
      if (!authResult.success) {
        return { success: false, message: '현재 비밀번호가 올바르지 않습니다.' };
      }

      // 새 비밀번호 설정
      const result = await this.setPassword(newPassword);
      return result;
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      return { success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' };
    }
  }

  // 관리자 계정 상태 확인
  async getStatus() {
    try {
      const adminData = await this.getAdminPassword();
      
      return {
        success: true,
        data: {
          isSetup: !!adminData,
          createdAt: adminData?.created_at || null,
          updatedAt: adminData?.updated_at || null
        }
      };
    } catch (error) {
      console.error('관리자 상태 확인 오류:', error);
      return { success: false, message: '상태 확인 중 오류가 발생했습니다.' };
    }
  }
}

module.exports = new AdminAuth(); 