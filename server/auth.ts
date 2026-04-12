import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'ai-trend-news-secret-key-2024';
const JWT_EXPIRES_IN = '7d';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@aitrend.com')
  .split(',').map(e => e.trim().toLowerCase());

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  department: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function loadUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_PATH)) return [];
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsers(users: User[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

function generateId(): string {
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeToken(user: User): string {
  const payload: JwtPayload = { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function safeUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, department: user.department, isAdmin: user.isAdmin };
}

export function signup(req: Request, res: Response): void {
  const { email, name, password, department } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: '이메일, 이름, 비밀번호를 모두 입력해주세요.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
    return;
  }

  const users = loadUsers();
  if (users.find(u => u.email === email)) {
    res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    return;
  }

  const user: User = {
    id: generateId(),
    email,
    name,
    password: bcrypt.hashSync(password, 10),
    department: department || '',
    isAdmin: ADMIN_EMAILS.includes(email.toLowerCase()),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);

  res.status(201).json({ token: makeToken(user), user: safeUser(user) });
}

export function login(req: Request, res: Response): void {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    return;
  }

  res.json({ token: makeToken(user), user: safeUser(user) });
}

export function getMe(req: AuthRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }
  const users = loadUsers();
  const full = users.find(u => u.id === req.user!.id);
  if (!full) { res.status(404).json({ error: '사용자를 찾을 수 없습니다.' }); return; }
  res.json({ user: safeUser(full) });
}

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { next(); return; }

  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    req.user = decoded;
  } catch { /* invalid token */ }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: '로그인이 필요합니다.' }); return; }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: '로그인이 필요합니다.' }); return; }
  if (!req.user.isAdmin) { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return; }
  next();
}
