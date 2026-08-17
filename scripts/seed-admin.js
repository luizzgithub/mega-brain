const { db } = require('../src/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const ADMIN_EMAIL = 'admin@teste.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Admin Teste';

async function seedAdmin() {
  try {
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL);
    if (existing) {
      console.log(`Usuário admin já existe: ${ADMIN_EMAIL}`);
      return;
    }

    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    db.prepare(
      'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(id, ADMIN_NAME, ADMIN_EMAIL, password_hash);

    console.log(`Usuário admin criado com sucesso: ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error('Erro ao criar usuário admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
