import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { supabase } from './supabase.js';

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
  is_admin: boolean;
  created_at: string;
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

export async function loadUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('[Auth] Failed to load users:', error.message);
    return [];
  }
  return data || [];
}

function generateId(): string {
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeToken(user: User): string {
  const payload: JwtPayload = { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function safeUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, department: user.department, isAdmin: user.is_admin };
}

export async function signup(req: Request, res: Response): Promise<void> {
  const { email, name, password, department } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: '이메일, 이름, 비밀번호를 모두 입력해주세요.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
    return;
  }

  const { data: existing } = await supabase
    .from('users').select('id').eq('email', email).single();

  if (existing) {
    res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    return;
  }

  const user: User = {
    id: generateId(),
    email,
    name,
    password: bcrypt.hashSync(password, 10),
    department: department || '',
    is_admin: ADMIN_EMAILS.includes(email.toLowerCase()),
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('users').insert(user);
  if (error) {
    console.error('[Auth] Signup insert error:', error.message);
    res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다.' });
    return;
  }

  res.status(201).json({ token: makeToken(user), user: safeUser(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  const { data: user, error } = await supabase
    .from('users').select('*').eq('email', email).single();

  if (error || !user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    return;
  }

  res.json({ token: makeToken(user), user: safeUser(user) });
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }

  const { data: user } = await supabase
    .from('users').select('*').eq('id', req.user.id).single();

  if (!user) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }

  res.json({ user: safeUser(user) });
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
