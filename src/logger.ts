export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const LOG_LEVELS = Object.keys(ORDER) as LogLevel[];

/**
 * Logger que escreve SEMPRE em stderr.
 * O transporte MCP usa stdout para o protocolo JSON-RPC: qualquer texto extra ali corrompe a sessão.
 */
export function createLogger(
  level: LogLevel = 'info',
  write: (line: string) => void = (line) => {
    process.stderr.write(line);
  }
): Logger {
  const emit = (lvl: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>) => {
    if (ORDER[lvl] < ORDER[level]) return;
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    write(`${new Date().toISOString()} [${lvl}] ${message}${suffix}\n`);
  };
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
  };
}

export const silentLogger: Logger = createLogger('silent');
