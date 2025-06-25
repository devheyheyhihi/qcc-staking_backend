const database = require('../config/database');

class User {
  static async findByWalletAddress(walletAddress) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      db.get(
        'SELECT * FROM users WHERE wallet_address = ?',
        [walletAddress],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  static async create(walletAddress) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      db.run(
        'INSERT INTO users (wallet_address) VALUES (?)',
        [walletAddress],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              wallet_address: walletAddress,
              created_at: new Date().toISOString()
            });
          }
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      const db = database.getDb();
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  static async findOrCreate(walletAddress) {
    try {
      let user = await this.findByWalletAddress(walletAddress);
      if (!user) {
        user = await this.create(walletAddress);
      }
      return user;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User; 