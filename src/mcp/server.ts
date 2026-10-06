import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Services } from '../container';
import { GeoError } from '../errors';
import { SERVER_NAME, VERSION } from '../version';
import { getPrompt, listPrompts } from './prompts';
import { listResources, readResource } from './resources';
import { buildTools, executeTool } from './tools';

/** Converte erros de domínio em erros JSON-RPC (para resources/prompts, que não têm `isError`). */
function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) return error;
  if (error instanceof GeoError) {
    const code = error.code === 'NOT_FOUND' || error.code === 'VALIDATION' ? ErrorCode.InvalidParams : ErrorCode.InternalError;
    return new McpError(code, error.message);
  }
  return new McpError(ErrorCode.InternalError, 'Erro interno inesperado');
}

/** Cria o servidor MCP (sem conectar a nenhum transporte). */
export function createServer(services: Services): Server {
  const tools = buildTools(services);
  const { logger } = services;

  const server = new Server(
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
  const server = createServer(services);
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
