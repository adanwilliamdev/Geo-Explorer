#!/usr/bin/env node
import { loadConfig } from './config';
import { createServices, Services } from './container';
import { GeoError } from './errors';
import { createLogger } from './logger';
import { SERVER_NAME, VERSION } from './version';

const HELP = `${SERVER_NAME} v${VERSION} - servidor MCP de trilhas de aprendizagem

Uso:
  geo-explorer                 Inicia o servidor MCP via stdio (padrão)
  geo-explorer verify <código> Verifica um certificado (saída JSON; código de saída 1 se inválido)
  geo-explorer --version       Mostra a versão
  geo-explorer --help          Mostra esta ajuda

Variáveis de ambiente:
  GEO_DATA_DIR               Pasta de dados (padrão: ~/.geo-explorer; use ":memory:" para não persistir)
  GEO_CERT_SECRET            Segredo HMAC dos certificados (padrão: gerado em <GEO_DATA_DIR>/secret.key)
  GEO_STRICT_CERTIFICATES    true = só emite certificados com conclusão comprovada (padrão: false)
  GEO_PASS_SCORE             Nota mínima (1-100) para aprovar desafios (padrão: 70)
  GEO_LOG_LEVEL              debug | info | warn | error | silent (padrão: info; logs vão para stderr)
  GEO_TIMEZONE               Fuso IANA das datas nos certificados (padrão: America/Sao_Paulo)
`;

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  createServices: () => Services;
  startServer: (services: Services) => Promise<unknown>;
}

const defaultIo: CliIo = {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  createServices: () => {
    const config = loadConfig();
    return createServices(config, createLogger(config.logLevel));
  },
  // Carregado sob demanda: `--help`, `--version` e `verify` não precisam do SDK MCP.
  startServer: async (services) => {
    const { runStdioServer } = await import('./mcp/server');
    return runStdioServer(services);
  },
};

/** Interpreta os argumentos e retorna o código de saída (null = servidor em execução). */
export async function runCli(argv: string[], io: CliIo = defaultIo): Promise<number | null> {
  const [command, ...rest] = argv;

  if (command === '--help' || command === '-h') {
    io.stdout(HELP);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    io.stdout(`${VERSION}\n`);
    return 0;
  }
  if (command === 'verify') {
    const code = rest[0];
    if (!code) {
      io.stderr('Uso: geo-explorer verify <código do certificado>\n');
      return 2;
    }
    const result = io.createServices().certificates.verify(code);
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return result.valid ? 0 : 1;
  }
  if (command !== undefined && command !== 'serve') {
    io.stderr(`Comando desconhecido: ${command}\n\n${HELP}`);
    return 2;
  }

  await io.startServer(io.createServices());
  return null;
}

/** Mantido por compatibilidade com a API anterior. */
export async function startMCPServer(): Promise<void> {
  await runCli(['serve']);
}

if (require.main === module) {
  runCli(process.argv.slice(2))
    .then((code) => {
      if (code !== null) process.exit(code);
    })
    .catch((error: unknown) => {
      const message = error instanceof GeoError ? error.message : error instanceof Error ? (error.stack ?? error.message) : String(error);
      process.stderr.write(`Erro fatal: ${message}\n`);
      process.exit(1);
    });
  process.on('unhandledRejection', (reason: unknown) => {
    process.stderr.write(`Promise rejeitada sem tratamento: ${String(reason)}\n`);
  });
}
