import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente do ficheiro .env na raiz do monorepo ou local
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export const env = {
  NOTIFICATIONS_API_URL: process.env.NOTIFICATIONS_API_URL || '',
  NOTIFICATIONS_API_TOKEN: process.env.NOTIFICATIONS_API_TOKEN || '',
  NOTIFICATIONS_TIMEOUT_MS: positiveInteger(process.env.NOTIFICATIONS_TIMEOUT_MS, 5000, 30000),
  NOTIFICATIONS_POLL_INTERVAL_MS: positiveInteger(process.env.NOTIFICATIONS_POLL_INTERVAL_MS, 30000, 3600000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.API_PORT || '4100', 10),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_campus_db?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'smart-campus-super-secret-key-ptp-iii-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
};
