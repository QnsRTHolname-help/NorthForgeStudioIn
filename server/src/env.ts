import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback ?? '';
  }
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

/**
 * Development fallback secret. Generated once and persisted to disk so
 * that restarting the dev server does not sign every session out.
 * Production refuses to start without a real secret from the environment.
 */
function devSecret() {
  const file = path.resolve(__dirname, '../../server/data/.dev-secret');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(48).toString('hex');
  }
}

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  databaseFile: path.resolve(__dirname, '../..', process.env.DATABASE_FILE ?? 'server/data/northforge.db'),
  jwtSecret: isProd ? required('JWT_SECRET') : process.env.JWT_SECRET || devSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'NorthForge <no-reply@northforge.studio>',
    /** Where password-reset links point. Defaults to the local dev server. */
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  },
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER ?? '',
  },
};

/** True when real mail can be sent; otherwise mail is recorded, not delivered. */
export const mailEnabled = Boolean(
  env.smtp.host && env.smtp.user && env.smtp.pass,
);

if (isProd && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
