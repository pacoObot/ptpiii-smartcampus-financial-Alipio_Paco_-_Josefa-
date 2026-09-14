import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente do ficheiro .env na raiz do monorepo ou local
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.API_PORT || '4100', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_campus_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'smart-campus-super-secret-key-ptp-iii-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
};
