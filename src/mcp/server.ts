import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { pathToFileURL } from 'node:url';
import { Services } from '../container';
import { GeoError } from '../errors';
import { SERVER_NAME, VERSION } from '../version';
import { getPrompt, listPrompts } from './prompts';
import { listResources, readResource } from './resources';
import { buildTools, executeTool } from './tools';

type ServerModule = typeof import('@modelcontextprotocol/sdk/server/index.js');
type StdioModule = typeof import('@modelcontextprotocol/sdk/server/stdio.js');
type TypesModule = typeof import('@modelcontextprotocol/sdk/types.js');

/**
 * O SDK MCP 0.5.x é somente ESM, e este projeto compila para CommonJS: o TypeScript transformaria
 * `import()` em `require()`, que falha com ERR_REQUIRE_ESM no Node < 22.12.
 * Por isso o SDK é carregado com um `import()` nativo (não transformado) a partir do caminho absoluto
 * resolvido aqui, o que também independe do diretório de trabalho do processo.
 * Os `import type` acima são apagados na compilação e mantêm a checagem de tipos.
 */
const nativeImport = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;

async function loadSdk<T>(specifier: string): Promise<T> {
  return (await nativeImport(pathToFileURL(require.resolve(specifier)).href)) as T;
}

/** Cria o servidor MCP (sem conectar a nenhum transporte). */
export async function createServer(services: Services): Promise<Server> {
  const { Server: ServerClass } = await loadSdk<ServerModule>('@modelcontextprotocol/sdk/server/index.js');
  const {
    CallToolRequestSchema,
    ErrorCode,
    GetPromptRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ReadResourceRequestSchema,
  } = await loadSdk<TypesModule>('@modelcontextprotocol/sdk/types.js');

  const tools = buildTools(services);
  const { logger } = services;

  /** Converte erros de domínio em erros JSON-RPC (para resources/prompts, que não têm `isError`). */
  const toMcpError = (error: unknown): Error => {
    if (error instanceof McpError) return error;
    if (error instanceof GeoError) {
      const invalid = error.code === 'NOT_FOUND' || error.code === 'VALIDATION';
      return new McpError(invalid ? ErrorCode.InvalidParams : ErrorCode.InternalError, error.message);
    }
    return new McpError(ErrorCode.InternalError, 'Erro interno inesperado');
  };

  const server = new ServerClass(
    { name: SERVER_NAME, version: VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema, annotations }) => ({
      name,
      description,
      inputSchema,
      annotations,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return { ...executeTool(tools, name, args, logger) };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResources(services),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      return { contents: [readResource(services, request.params.uri)] };
    } catch (error) {
      throw toMcpError(error);
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: listPrompts() }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      return { ...getPrompt(services, request.params.name, request.params.arguments ?? {}) };
    } catch (error) {
      throw toMcpError(error);
    }
  });

  return server;
}

/** Conecta o servidor ao stdio e o encerra com segurança em SIGINT/SIGTERM. */
export async function runStdioServer(services: Services): Promise<Server> {
  const server = await createServer(services);
  const { StdioServerTransport } = await loadSdk<StdioModule>('@modelcontextprotocol/sdk/server/stdio.js');
  await server.connect(new StdioServerTransport());
  services.logger.info(`${SERVER_NAME} v${VERSION} em execução (stdio)`);

  const shutdown = (signal: string): void => {
    services.logger.info(`${signal} recebido, encerrando`);
    server
      .close()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}
