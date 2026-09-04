import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import trailService from '../services/trailService.js';
import challengeService from '../services/challengeService.js';
import certificateService from '../services/certificateService.js';

// Criar servidor MCP
const server = new Server(
  {
    name: 'geo-explorer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Registrar ferramentas disponíveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_trail',
        description: 'Obtém informações detalhadas de uma trilha de aprendizagem',
        inputSchema: {
          type: 'object',
          properties: {
            tech: {
              type: 'string',
              description: 'Tecnologia da trilha (java, node, react, python)',
            },
          },
          required: ['tech'],
        },
      },
      {
        name: 'generate_challenge',
        description: 'Gera um desafio prático de código para uma tecnologia e nível',
        inputSchema: {
          type: 'object',
          properties: {
            tech: {
              type: 'string',
              description: 'Tecnologia para o desafio (java, node, react, python)',
            },
            level: {
              type: 'string',
              description: 'Nível do desafio (iniciante, intermediario, avancado)',
              enum: ['iniciante', 'intermediario', 'avancado'],
            },
          },
          required: ['tech', 'level'],
        },
      },
      {
        name: 'issue_certificate',
        description: 'Emite um certificado de conclusão para uma trilha',
        inputSchema: {
          type: 'object',
          properties: {
            userName: {
              type: 'string',
              description: 'Nome do usuário para o certificado',
            },
            tech: {
              type: 'string',
              description: 'Tecnologia concluída (java, node, react, python)',
            },
            level: {
              type: 'string',
              description: 'Nível concluído (opcional)',
              enum: ['iniciante', 'intermediario', 'avancado', 'completo'],
            },
          },
          required: ['userName', 'tech'],
        },
      },
      {
        name: 'list_technologies',
        description: 'Lista todas as tecnologias disponíveis para trilhas',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'verify_certificate',
        description: 'Verifica a autenticidade de um certificado',
        inputSchema: {
          type: 'object',
          properties: {
            certificateId: {
              type: 'string',
              description: 'ID do certificado para verificação',
            },
          },
          required: ['certificateId'],
        },
      },
    ],
  };
});

// Processar chamadas de ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_trail': {
        const { tech } = args as { tech: string };
        const trail = trailService.getTrail(tech);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(trail, null, 2),
            },
          ],
        };
      }

      case 'generate_challenge': {
        const { tech, level } = args as { tech: string; level: string };
        const challenge = challengeService.generateChallenge(tech, level);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(challenge, null, 2),
            },
          ],
        };
      }

      case 'issue_certificate': {
        const { userName, tech, level = 'completo' } = args as {
          userName: string;
          tech: string;
          level?: string;
        };
        const result = certificateService.issueCertificate(userName, tech, level);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_technologies': {
        const techs = trailService.listTechnologies();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ technologies: techs }, null, 2),
            },
          ],
        };
      }

      case 'verify_certificate': {
        const { certificateId } = args as { certificateId: string };
        const cert = certificateService.verifyCertificate(certificateId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ valid: true, certificate: cert }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Ferramenta não encontrada: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Iniciar o servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Geo-Explorer MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Erro ao iniciar servidor:', error);
  process.exit(1);
});
