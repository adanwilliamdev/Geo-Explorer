import { Level, LEVELS, CertificateLevel } from './types';
import { ValidationError } from './errors';

/** minúsculas, sem acentos e com espaços normalizados. */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** "João da Silva" -> "joao-da-silva". Retorna '' se não restar nenhum caractere útil. */
export function slugify(value: string): string {
  return normalizeKey(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Sugere o candidato mais próximo quando a distância de edição é pequena. */
export function didYouMean(input: string, candidates: string[]): string | undefined {
  const needle = normalizeKey(input);
  let best: { value: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = levenshtein(needle, normalizeKey(candidate));
    if (!best || distance < best.distance) best = { value: candidate, distance };
  }
  const limit = Math.max(2, Math.floor(needle.length / 3));
  return best && best.distance <= limit ? best.value : undefined;
}

/** Monta " Você quis dizer "x"?" quando há uma sugestão plausível. */
export function suggestionSuffix(input: string, candidates: string[]): string {
  const hit = didYouMean(input, candidates);
  return hit ? ` Você quis dizer "${hit}"?` : '';
}

const LEVEL_ALIASES: Record<string, Level> = {
  iniciante: 'iniciante',
  basico: 'iniciante',
  beginner: 'iniciante',
  intermediario: 'intermediario',
  intermediate: 'intermediario',
  avancado: 'avancado',
  advanced: 'avancado',
};

export function tryParseLevel(input: string): Level | undefined {
  return LEVEL_ALIASES[normalizeKey(input)];
}

export function parseLevel(input: string): Level {
  const level = tryParseLevel(input);
  if (!level) {
    throw new ValidationError(`Nível inválido: "${input}". Use: ${LEVELS.join(', ')}`);
  }
  return level;
}

export function parseCertificateLevel(input: string): CertificateLevel {
  const key = normalizeKey(input);
  if (key === 'completo' || key === 'complete' || key === 'full') return 'completo';
  return parseLevel(input);
}

// ---------------------------------------------------------------------------
// Leitura segura de argumentos vindos do cliente MCP (tipo `unknown`)
// ---------------------------------------------------------------------------

export type Args = Record<string, unknown>;

export function asArgs(raw: unknown): Args {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Os argumentos devem ser um objeto JSON');
  }
  return raw as Args;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

interface StringOptions {
  min?: number;
  max?: number;
}

export function optionalString(args: Args, key: string, opts: StringOptions = {}): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ValidationError(`O campo "${key}" deve ser texto`);
  const text = value.trim();
  if (text === '') return undefined;
  if (CONTROL_CHARS.test(text)) {
    throw new ValidationError(`O campo "${key}" contém caracteres de controle`);
  }
  const { min = 1, max = 200 } = opts;
  if (text.length < min) {
    throw new ValidationError(`O campo "${key}" deve ter pelo menos ${min} caracteres`);
  }
  if (text.length > max) {
    throw new ValidationError(`O campo "${key}" deve ter no máximo ${max} caracteres`);
  }
  return text;
}

export function requireString(args: Args, key: string, opts: StringOptions = {}): string {
  const value = optionalString(args, key, opts);
  if (value === undefined) throw new ValidationError(`O campo "${key}" é obrigatório`);
  return value;
}

export function optionalInt(
  args: Args,
  key: string,
  opts: { min?: number; max?: number } = {}
): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`O campo "${key}" deve ser um número inteiro`);
  }
  const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = opts;
  if (value < min || value > max) {
    throw new ValidationError(`O campo "${key}" deve estar entre ${min} e ${max}`);
  }
  return value;
}

export function optionalBool(args: Args, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new ValidationError(`O campo "${key}" deve ser true ou false`);
  return value;
}

export function requireBoolArray(args: Args, key: string): boolean[] {
  const value = args[key];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'boolean')) {
    throw new ValidationError(`O campo "${key}" deve ser uma lista de true/false`);
  }
  return value as boolean[];
}
