const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { randomUUID } = require('crypto');

const dbPath = process.env.DB_DATABASE || path.join(__dirname, '../../data/data.db');
const db = new sqlite3.Database(dbPath);

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin@agentvoiceresponse.com';
  const password = process.env.ADMIN_PASSWORD || 'agentvoiceresponse';
  
  return new Promise((resolve, reject) => {
    // Check if user exists
    db.get('SELECT id FROM user WHERE username = ?', [username], async (err, row) => {
      if (err) {
        console.error('Error checking user:', err);
        db.close();
        reject(err);
        return;
      }
      
      if (row) {
        console.log(`User '${username}' already exists`);
        db.close();
        resolve();
        return;
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = randomUUID();
      
      // Insert user
      db.run(
        `INSERT INTO user (id, username, passwordHash, role) VALUES (?, ?, ?, ?)`,
        [userId, username, passwordHash, 'admin'],
        function(err) {
          if (err) {
            console.error('Error creating user:', err);
            db.close();
            reject(err);
            return;
          }
          
          console.log(`Created admin user '${username}' with ID: ${userId}`);
          db.close();
          resolve();
        }
      );
    });
  });
}

createAdmin().catch(console.error);
