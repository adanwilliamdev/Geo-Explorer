import * as os from 'node:os';
import * as path from 'node:path';
import { ValidationError } from './errors';
import { LOG_LEVELS, LogLevel } from './logger';

/** Valor de GEO_DATA_DIR que desativa a persistência (tudo em memória). */
export const MEMORY_DIR = ':memory:';

export interface AppConfig {
  /** Diretório de dados; null = somente memória. */
  dataDir: string | null;
  /** Segredo HMAC dos certificados; null = gerado/lido do diretório de dados. */
  certSecret: string | null;
  /** Se true, certificados só são emitidos com conclusão comprovada pelo progresso. */
  strictCertificates: boolean;
  /** Pontuação mínima (1-100) para aprovar um desafio. */
  passScore: number;
  logLevel: LogLevel;
  /** Fuso IANA usado para formatar datas nos certificados. */
  timezone: string;
}

type Env = Record<string, string | undefined>;

function parseBool(env: Env, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  throw new ValidationError(`Variável ${key} inválida: use true ou false`);
}

export function loadConfig(env: Env = process.env): AppConfig {
  const rawDir = env.GEO_DATA_DIR?.trim();
  const dataDir =
    rawDir === MEMORY_DIR ? null : path.resolve(rawDir || path.join(os.homedir(), '.geo-explorer'));

  const secret = env.GEO_CERT_SECRET?.trim() || null;
  if (secret !== null && secret.length < 16) {
    throw new ValidationError('GEO_CERT_SECRET deve ter pelo menos 16 caracteres');
  }

  const passRaw = env.GEO_PASS_SCORE?.trim();
  const passScore = passRaw ? Number(passRaw) : 70;
  if (!Number.isInteger(passScore) || passScore < 1 || passScore > 100) {
    throw new ValidationError('GEO_PASS_SCORE deve ser um inteiro entre 1 e 100');
  }

  const logLevel = (env.GEO_LOG_LEVEL?.trim().toLowerCase() || 'info') as LogLevel;
  if (!LOG_LEVELS.includes(logLevel)) {
    throw new ValidationError(`GEO_LOG_LEVEL inválido. Use: ${LOG_LEVELS.join(', ')}`);
  }

  const timezone = env.GEO_TIMEZONE?.trim() || 'America/Sao_Paulo';
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone });
  } catch {
    throw new ValidationError(`GEO_TIMEZONE inválido: ${timezone}`);
  }

  return {
    dataDir,
    certSecret: secret,
    strictCertificates: parseBool(env, 'GEO_STRICT_CERTIFICATES', false),
    passScore,
    logLevel,
    timezone,
  };
}
