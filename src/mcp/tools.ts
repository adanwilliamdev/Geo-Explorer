import { GeoError } from '../errors';
import { Logger } from '../logger';
import { Services } from '../container';
import {
  Args,
  asArgs,
  optionalBool,
  optionalInt,
  optionalString,
  requireBoolArray,
  requireString,
} from '../validation';

type JsonSchema = Record<string, unknown>;

export interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint: false;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, JsonSchema>; required?: string[] };
  annotations: ToolAnnotations;
  handler: (args: Args) => unknown;
}

// `type` (e não `interface`): o SDK exige tipos com assinatura de índice implícita.
export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const text = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});

const NAME_MAX = 80;

/** Define as ferramentas MCP. Nomes e parâmetros das 5 ferramentas originais foram mantidos. */
export function buildTools(s: Services): ToolDefinition[] {
  const techs = s.trails.listTechnologies().join(', ');
  const techProp = (extra = ''): JsonSchema => ({
    type: 'string',
    description: `Tecnologia da trilha (${techs}). Aceita aliases como "node.js" ou "ts".${extra}`,
  });
  const userProp: JsonSchema = {
    type: 'string',
    description: 'Nome da pessoa estudante (identifica o progresso; "João Silva" e "joao silva" são o mesmo usuário)',
  };
  const levelProp = (extra = ''): JsonSchema => ({
    type: 'string',
    description: `Nível (iniciante, intermediario, avancado).${extra}`,
    enum: ['iniciante', 'intermediario', 'avancado'],
  });

  return [
    {
      name: 'list_technologies',
      description: 'Lista as tecnologias disponíveis, com título, níveis, quantidade de módulos e carga horária',
      inputSchema: { type: 'object', properties: {} },
      annotations: { title: 'Listar tecnologias', readOnlyHint: true, openWorldHint: false },
      handler: () => ({ technologies: s.trails.listTechnologies(), trails: s.trails.listTrails() }),
    },
    {
      name: 'get_trail',
      description: 'Obtém os detalhes de uma trilha: módulos por nível, horas, tópicos e pré-requisitos',
      inputSchema: { type: 'object', properties: { tech: techProp() }, required: ['tech'] },
      annotations: { title: 'Detalhar trilha', readOnlyHint: true, openWorldHint: false },
      handler: (a) => s.trails.getTrail(requireString(a, 'tech')),
    },
    {
      name: 'get_learning_path',
      description: 'Ordem recomendada de estudo de uma trilha (respeitando pré-requisitos), com horas acumuladas',
      inputSchema: {
        type: 'object',
        properties: { tech: techProp(), level: levelProp(' Opcional: restringe a um nível.') },
        required: ['tech'],
      },
      annotations: { title: 'Roteiro de estudo', readOnlyHint: true, openWorldHint: false },
      handler: (a) => s.trails.getLearningPath(requireString(a, 'tech'), optionalString(a, 'level')),
    },
    {
      name: 'search_content',
      description: 'Busca trilhas, módulos e desafios por assunto (ex.: "docker", "streams", "jwt")',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca' },
          tech: techProp(' Opcional: restringe a uma trilha.'),
          limit: { type: 'integer', description: 'Máximo de resultados (1-25, padrão 10)', minimum: 1, maximum: 25 },
        },
        required: ['query'],
      },
      annotations: { title: 'Buscar conteúdo', readOnlyHint: true, openWorldHint: false },
      handler: (a) => {
        const query = requireString(a, 'query', { max: 100 });
        const results = s.search.search(query, {
          tech: optionalString(a, 'tech'),
          limit: optionalInt(a, 'limit', { min: 1, max: 25 }),
        });
        return { query, total: results.length, results };
      },
    },
    {
      name: 'generate_challenge',
      description:
        'Gera um desafio prático de código. Informe userName para evitar desafios que a pessoa já concluiu.',
      inputSchema: {
        type: 'object',
        properties: { tech: techProp(), level: levelProp(), userName: userProp },
        required: ['tech', 'level'],
      },
      annotations: { title: 'Gerar desafio', readOnlyHint: true, openWorldHint: false },
      handler: (a) => {
        const tech = requireString(a, 'tech');
        const level = requireString(a, 'level');
        const userName = optionalString(a, 'userName', { min: 3, max: NAME_MAX });
        const excludeIds = userName ? s.progress.passedChallengeIds(userName) : [];
        const { challenge, repeated } = s.challenges.pickChallenge(tech, level, { excludeIds });
        return repeated
          ? { ...challenge, note: 'Você já concluiu todos os desafios deste nível; este é uma repetição.' }
          : challenge;
      },
    },
    {
      name: 'submit_challenge',
      description:
        'Registra a avaliação de um desafio. Quem revisou o código informa, na ordem dos requisitos, quais foram atendidos. ' +
        'A nota é o percentual atendido; a aprovação concede XP apenas na primeira vez.',
      inputSchema: {
        type: 'object',
        properties: {
          userName: userProp,
          challengeId: { type: 'string', description: 'ID do desafio (retornado por generate_challenge)' },
          requirementsMet: {
            type: 'array',
            items: { type: 'boolean' },
            description: 'Um booleano por requisito do desafio, na mesma ordem (true = atendido)',
          },
          hintsUsed: { type: 'integer', minimum: 0, description: 'Quantidade de dicas usadas (reduz o XP em até 50%)' },
        },
        required: ['userName', 'challengeId', 'requirementsMet'],
      },
      annotations: { title: 'Registrar resultado de desafio', readOnlyHint: false, idempotentHint: false, openWorldHint: false },
      handler: (a) => {
        const userName = requireString(a, 'userName', { min: 3, max: NAME_MAX });
        const evaluation = s.challenges.evaluate(
          requireString(a, 'challengeId'),
          requireBoolArray(a, 'requirementsMet'),
          optionalInt(a, 'hintsUsed', { min: 0, max: 50 }) ?? 0
        );
        return s.progress.recordChallengeResult(userName, evaluation);
      },
    },
    {
      name: 'enroll',
      description: 'Matricula a pessoa em uma trilha (cria o perfil se necessário) e mostra os primeiros passos',
      inputSchema: {
        type: 'object',
        properties: { userName: userProp, tech: techProp(), level: levelProp(' Opcional: nível-alvo.') },
        required: ['userName', 'tech'],
      },
      annotations: { title: 'Matricular em trilha', readOnlyHint: false, idempotentHint: true, openWorldHint: false },
      handler: (a) =>
        s.progress.enroll(
          requireString(a, 'userName', { min: 3, max: NAME_MAX }),
          requireString(a, 'tech'),
          optionalString(a, 'level')
        ),
    },
    {
      name: 'complete_module',
      description:
        'Marca um módulo como concluído (exige os pré-requisitos), concede XP e pode desbloquear conquistas',
      inputSchema: {
        type: 'object',
        properties: {
          userName: userProp,
          moduleId: { type: 'string', description: 'ID do módulo (ex.: java-poo) ou o nome dele, se tech for informado' },
          tech: techProp(' Necessário apenas se moduleId for o nome do módulo.'),
        },
        required: ['userName', 'moduleId'],
      },
      annotations: { title: 'Concluir módulo', readOnlyHint: false, idempotentHint: true, openWorldHint: false },
      handler: (a) =>
        s.progress.completeModule(
          requireString(a, 'userName', { min: 3, max: NAME_MAX }),
          requireString(a, 'moduleId'),
          optionalString(a, 'tech')
        ),
    },
    {
      name: 'get_progress',
      description:
        'Painel de progresso: XP, rank, sequência de dias, conquistas e andamento por trilha. ' +
        'Com tech, mostra também a elegibilidade para certificados.',
      inputSchema: {
        type: 'object',
        properties: { userName: userProp, tech: techProp(' Opcional.') },
        required: ['userName'],
      },
      annotations: { title: 'Ver progresso', readOnlyHint: true, openWorldHint: false },
      handler: (a) =>
        s.progress.getProgress(requireString(a, 'userName', { min: 3, max: NAME_MAX }), optionalString(a, 'tech')),
    },
    {
      name: 'recommend_next',
      description: 'Recomenda os próximos módulos (pré-requisitos atendidos) e um desafio do nível atual',
      inputSchema: {
        type: 'object',
        properties: { userName: userProp, tech: techProp(' Opcional se a pessoa já estiver matriculada.') },
      },
      annotations: { title: 'Recomendar próximos passos', readOnlyHint: true, openWorldHint: false },
      handler: (a) =>
        s.progress.recommendNext(optionalString(a, 'userName', { min: 3, max: NAME_MAX }), optionalString(a, 'tech')),
    },
    {
      name: 'issue_certificate',
      description:
        'Emite um certificado de conclusão assinado. Se o progresso registrado comprovar a conclusão, ele é "verified"; ' +
        'caso contrário é "self-declared" (ou recusado, em modo estrito). Não duplica certificados idênticos.',
      inputSchema: {
        type: 'object',
        properties: {
          userName: { ...userProp, description: 'Nome que aparecerá no certificado' },
          tech: techProp(),
          level: {
            type: 'string',
            description: 'Nível concluído (opcional; padrão: completo = trilha inteira)',
            enum: ['iniciante', 'intermediario', 'avancado', 'completo'],
          },
        },
        required: ['userName', 'tech'],
      },
      annotations: { title: 'Emitir certificado', readOnlyHint: false, idempotentHint: true, openWorldHint: false },
      handler: (a) =>
        s.certificates.issueCertificate(
          requireString(a, 'userName', { min: 3, max: NAME_MAX }),
          requireString(a, 'tech'),
          optionalString(a, 'level') ?? 'completo'
        ),
    },
    {
      name: 'verify_certificate',
      description:
        'Verifica um certificado pelo código (GEO-XXXX-XXXX-XXXX): autêntico, revogado, adulterado ou inexistente',
      inputSchema: {
        type: 'object',
        properties: { certificateId: { type: 'string', description: 'Código do certificado' } },
        required: ['certificateId'],
      },
      annotations: { title: 'Verificar certificado', readOnlyHint: true, openWorldHint: false },
      handler: (a) => s.certificates.verify(requireString(a, 'certificateId', { max: 64 })),
    },
    {
      name: 'revoke_certificate',
      description: 'Revoga um certificado emitido (a verificação passa a retornar inválido)',
      inputSchema: {
        type: 'object',
        properties: {
          certificateId: { type: 'string', description: 'Código do certificado' },
          reason: { type: 'string', description: 'Motivo da revogação (opcional)' },
        },
        required: ['certificateId'],
      },
      annotations: { title: 'Revogar certificado', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      handler: (a) =>
        s.certificates.revokeCertificate(
          requireString(a, 'certificateId', { max: 64 }),
          optionalString(a, 'reason', { max: 200 })
        ),
    },
    {
      name: 'list_certificates',
      description: 'Lista certificados emitidos, com filtros opcionais por pessoa e tecnologia',
      inputSchema: {
        type: 'object',
        properties: {
          userName: userProp,
          tech: techProp(' Opcional.'),
          includeRevoked: { type: 'boolean', description: 'Incluir revogados (padrão: true)' },
        },
      },
      annotations: { title: 'Listar certificados', readOnlyHint: true, openWorldHint: false },
      handler: (a) => {
        const certificates = s.certificates.listCertificates({
          userName: optionalString(a, 'userName', { min: 3, max: NAME_MAX }),
          tech: optionalString(a, 'tech'),
          includeRevoked: optionalBool(a, 'includeRevoked'),
        });
        return { total: certificates.length, certificates };
      },
    },
    {
      name: 'delete_user_data',
      description:
        'Apaga PERMANENTEMENTE o progresso e os certificados de uma pessoa (direito de exclusão, LGPD). Exige confirm=true.',
      inputSchema: {
        type: 'object',
        properties: {
          userName: userProp,
          confirm: { type: 'boolean', description: 'Deve ser true para confirmar a exclusão' },
        },
        required: ['userName', 'confirm'],
      },
      annotations: { title: 'Excluir dados do usuário', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      handler: (a) => {
        const userName = requireString(a, 'userName', { min: 3, max: NAME_MAX });
        if (optionalBool(a, 'confirm') !== true) {
          throw new GeoError('VALIDATION', 'Exclusão não confirmada: envie confirm=true para apagar os dados');
        }
        const progressDeleted = s.progress.deleteUser(userName);
        const certificatesDeleted = s.certificates.deleteByUser(userName);
        return { progressDeleted, certificatesDeleted };
      },
    },
  ];
}

/** Valida e executa uma ferramenta; erros de domínio viram respostas `isError` legíveis. */
export function executeTool(
  tools: ToolDefinition[],
  name: string,
  rawArgs: unknown,
  logger: Logger
): ToolResult {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { content: [{ type: 'text', text: `Erro: Ferramenta não encontrada: ${name}` }], isError: true };
  }
  try {
    return text(tool.handler(asArgs(rawArgs)));
  } catch (error) {
    if (error instanceof GeoError && error.code !== 'INTERNAL' && error.code !== 'STORAGE') {
      return { content: [{ type: 'text', text: `Erro: ${error.message}` }], isError: true };
    }
    logger.error('falha ao executar ferramenta', {
      tool: name,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    const message = error instanceof GeoError ? error.message : 'Erro interno inesperado';
    return { content: [{ type: 'text', text: `Erro: ${message}` }], isError: true };
  }
}
