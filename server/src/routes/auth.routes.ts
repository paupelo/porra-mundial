import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) { res.status(400).json({ error: 'Faltan credenciales' }); return; }

  const admin = getDb().prepare('SELECT id,email,password_hash FROM admin_users WHERE email=?').get(email) as
    { id: string; email: string; password_hash: string } | undefined;

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const token = jwt.sign(
    { adminId: admin.id, email: admin.email },
    process.env.JWT_SECRET ?? 'dev-secret',
    { expiresIn: '12h' },
  );
  res.json({ token });
});

export default router;
