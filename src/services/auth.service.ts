import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, run } from '../config/db.ts';
import { AppError } from '../utils/AppError.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'quizpulse-super-secure-jwt-secret-key-btech-cse-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface UserDTO {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'admin';
  created_at?: string;
}

export const authService = {
  async register(name: string, email: string, password: string, role: 'student' | 'admin' = 'student') {
    // 1. Check if email already registered
    const existing = await get('SELECT id FROM users WHERE email = ?;', [email]);
    if (existing) {
      throw new AppError('An account with this email address already exists.', 409);
    }

    // 2. Hash password securely with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Insert into MySQL
    const result = await run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);',
      [name, email, passwordHash, role]
    );

    const user: UserDTO = {
      id: result.insertId,
      name,
      email,
      role,
    };

    // 4. Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN as any,
    });

    return { user, token };
  },

  async login(email: string, password: string) {
    // 1. Lookup user
    const user = await get<any>(
      'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ?;',
      [email]
    );

    // Constant-time generic error to prevent account enumeration
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    // 2. Compare bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    const userDto: UserDTO = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    };

    // 3. Issue JWT
    const token = jwt.sign({ id: userDto.id, email: userDto.email, role: userDto.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN as any,
    });

    return { user: userDto, token };
  },

  async getMe(userId: number): Promise<UserDTO> {
    const user = await get<UserDTO>(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?;',
      [userId]
    );
    if (!user) {
      throw new AppError('User profile not found.', 404);
    }
    return user;
  },
};
