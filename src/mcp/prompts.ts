import { Services } from '../container';
import { NotFoundError, ValidationError } from '../errors';

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptInfo {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

// `type` (e não `interface`): o SDK exige tipos com assinatura de índice implícita.
export type PromptResult = {
  description: string;
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
};

const PROMPTS: PromptInfo[] = [
  {
    name: 'study_plan',
    description: 'Monta um plano de estudos semanal para uma trilha',
    arguments: [
      { name: 'tech', description: 'Tecnologia da trilha', required: true },
      { name: 'hoursPerWeek', description: 'Horas de estudo por semana (padrão: 6)', required: false },
      { name: 'userName', description: 'Nome da pessoa, para considerar o progresso já registrado', required: false },
    ],
  },
  {
    name: 'review_challenge',
    description: 'Revisa a solução de um desafio e registra a nota com submit_challenge',
    arguments: [
      { name: 'userName', description: 'Nome da pessoa estudante', required: true },
      { name: 'challengeId', description: 'ID do desafio', required: true },
    ],
  },
  {
    name: 'explain_module',
    description: 'Explica um módulo com exemplos e exercícios curtos',
    arguments: [{ name: 'moduleId', description: 'ID do módulo (ex.: java-poo)', required: true }],
  },
];

export function listPrompts(): PromptInfo[] {
  return PROMPTS;
}

const user = (text: string): PromptResult['messages'] => [{ role: 'user', content: { type: 'text', text } }];

function need(args: Record<string, string>, key: string): string {
  const value = args[key]?.trim();
  if (!value) throw new ValidationError(`Argumento obrigatório ausente: ${key}`);
  return value;
}

export function getPrompt(s: Services, name: string, args: Record<string, string> = {}): PromptResult {
  switch (name) {
    case 'study_plan': {
      const tech = s.trails.resolveTech(need(args, 'tech'));
      const hours = Number(args.hoursPerWeek ?? 6);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 80) {
        throw new ValidationError('hoursPerWeek deve ser um número entre 1 e 80');
      }
      const who = args.userName?.trim()
        ? `Consulte também o progresso de "${args.userName.trim()}" com get_progress e comece do que falta. `
        : '';
      return {
        description: `Plano de estudos para ${tech}`,
        messages: user(
          `Monte um plano de estudos semanal para a trilha "${tech}" com ${hours}h por semana. ` +
            `Use a ferramenta get_learning_path para obter a ordem dos módulos e as horas de cada um. ${who}` +
            `Distribua os módulos por semana respeitando a ordem, indique um desafio (generate_challenge) ao fim de cada nível ` +
            `e estime a data de conclusão.`
        ),
      };
    }
    case 'review_challenge': {
      const challenge = s.challenges.getChallenge(need(args, 'challengeId'));
      const who = need(args, 'userName');
      return {
        description: `Revisão do desafio ${challenge.id}`,
        messages: user(
          `Revise a solução de "${who}" para o desafio "${challenge.title}" (${challenge.id}).\n\n` +
            `Requisitos, na ordem:\n${challenge.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n` +
            `Peça o código se ele ainda não foi enviado. Para cada requisito, diga se foi atendido e por quê. ` +
            `Depois chame submit_challenge com requirementsMet na mesma ordem e explique a nota e os pontos de melhoria.`
        ),
      };
    }
    case 'explain_module': {
      const mod = s.trails.getModule(need(args, 'moduleId'));
      return {
        description: `Explicação do módulo ${mod.name}`,
        messages: user(
          `Explique o módulo "${mod.name}" da trilha ${mod.tech} (nível ${mod.level}, ~${mod.hours}h). ` +
            `Cubra os tópicos: ${mod.topics.join('; ')}. Para cada tópico, dê uma explicação curta, um exemplo de código ` +
            `e um exercício. Ao final, pergunte se a pessoa quer marcar o módulo como concluído (complete_module).`
        ),
      };
    }
    default:
      throw new NotFoundError(`Prompt não encontrado: ${name}`);
  }
}
