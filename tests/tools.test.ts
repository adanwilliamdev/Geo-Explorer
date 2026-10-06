import { getPrompt, listPrompts } from '../src/mcp/prompts';
import { listResources, readResource } from '../src/mcp/resources';
import { buildTools, executeTool, ToolResult } from '../src/mcp/tools';
import { silentLogger } from '../src/logger';
import { makeServices } from './helpers';

function setup() {
  const services = makeServices();
  const tools = buildTools(services);
  const call = (name: string, args?: unknown): ToolResult => executeTool(tools, name, args, silentLogger);
  const json = (name: string, args?: unknown): any => {
    const r = call(name, args);
    if (r.isError) throw new Error(r.content[0].text);
    return JSON.parse(r.content[0].text);
  };
  return { services, tools, call, json };
}

describe('ferramentas MCP', () => {
  test('expõe as 5 ferramentas originais e as novas, com schema consistente', () => {
    const { tools } = setup();
    const names = tools.map((t) => t.name);
    for (const n of ['get_trail', 'generate_challenge', 'issue_certificate', 'verify_certificate', 'list_technologies']) {
      expect(names).toContain(n);
    }
    expect(names.length).toBe(15);
    expect(new Set(names).size).toBe(names.length);
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(10);
      for (const req of t.inputSchema.required ?? []) expect(t.inputSchema.properties).toHaveProperty(req);
    }
  });

  test('list_technologies mantém o campo "technologies"', () => {
    const { json } = setup();
    const out = json('list_technologies');
    expect(out.technologies).toContain('java');
    expect(out.trails.length).toBe(6);
  });

  test('get_trail e get_learning_path', () => {
    const { json } = setup();
    expect(json('get_trail', { tech: 'node.js' }).tech).toBe('node');
    expect(json('get_learning_path', { tech: 'react', level: 'iniciante' }).steps.length).toBe(2);
  });

  test('search_content', () => {
    const { json } = setup();
    expect(json('search_content', { query: 'jwt' }).results[0].id).toBe('node-autenticacao-jwt');
  });

  test('fluxo completo: matrícula, módulos, desafio, certificado verificado', () => {
    const { json, services } = setup();
    const user = 'Ana Costa';
    json('enroll', { userName: user, tech: 'devops' });
    for (const step of services.trails.getLearningPath('devops').steps) {
      json('complete_module', { userName: user, moduleId: step.module.id });
    }
    for (const level of ['iniciante', 'intermediario', 'avancado']) {
      const ch = json('generate_challenge', { tech: 'devops', level, userName: user });
      const res = json('submit_challenge', {
        userName: user, challengeId: ch.id, requirementsMet: ch.requirements.map(() => true),
      });
      expect(res.firstPass).toBe(true);
    }
    const progress = json('get_progress', { userName: user, tech: 'devops' });
    expect(progress.trails[0].percent).toBe(100);
    expect(progress.certificateEligibility.every((e: any) => e.eligible)).toBe(true);

    const cert = json('issue_certificate', { userName: user, tech: 'devops' });
    expect(cert.certificate.basis).toBe('verified');
    const verified = json('verify_certificate', { certificateId: cert.certificate.id });
    expect(verified.valid).toBe(true);

    json('revoke_certificate', { certificateId: cert.certificate.id, reason: 'teste' });
    expect(json('verify_certificate', { certificateId: cert.certificate.id }).status).toBe('revoked');
    expect(json('list_certificates', { userName: user, includeRevoked: false }).total).toBe(0);
  });

  test('generate_challenge com userName evita desafios já concluídos', () => {
    const { json } = setup();
    const first = json('generate_challenge', { tech: 'java', level: 'intermediario' });
    json('submit_challenge', { userName: 'Ana Costa', challengeId: first.id, requirementsMet: first.requirements.map(() => true) });
    const next = json('generate_challenge', { tech: 'java', level: 'intermediario', userName: 'Ana Costa' });
    expect(next.id === first.id).toBe(false);
  });

  test('verify_certificate de código inexistente não é erro, e sim resultado not_found', () => {
    const { call } = setup();
    const r = call('verify_certificate', { certificateId: 'GEO-0000-0000-0000' });
    expect(r.isError).toBe(undefined);
    expect(JSON.parse(r.content[0].text).status).toBe('not_found');
  });

  test('erros de domínio e de validação viram isError com mensagem legível', () => {
    const { call } = setup();
    const unknown = call('get_trail', { tech: 'cobol' });
    expect(unknown.isError).toBe(true);
    expect(unknown.content[0].text).toContain('Erro: Trilha não encontrada');

    expect(call('get_trail', {}).content[0].text).toContain('obrigatório');
    expect(call('issue_certificate', { userName: 'Jo', tech: 'java' }).content[0].text).toContain('3 caracteres');
    expect(call('submit_challenge', { userName: 'Ana Costa', challengeId: 'java-basics-1', requirementsMet: [true] }).isError).toBe(true);
    expect(call('nao_existe').content[0].text).toContain('Ferramenta não encontrada');
  });

  test('delete_user_data exige confirmação e apaga progresso e certificados', () => {
    const { call, json } = setup();
    json('enroll', { userName: 'Ana Costa', tech: 'java' });
    json('issue_certificate', { userName: 'Ana Costa', tech: 'java' });

    expect(call('delete_user_data', { userName: 'Ana Costa', confirm: false }).isError).toBe(true);
    expect(json('get_progress', { userName: 'Ana Costa' }).user.name).toBe('Ana Costa');

    const out = json('delete_user_data', { userName: 'Ana Costa', confirm: true });
    expect(out).toEqual({ progressDeleted: true, certificatesDeleted: 1 });
    expect(call('get_progress', { userName: 'Ana Costa' }).isError).toBe(true);
  });

  test('erros inesperados não vazam detalhes internos', () => {
    const { tools } = setup();
    tools[0].handler = () => { throw new TypeError('caminho /etc/segredo'); };
    const r = executeTool(tools, tools[0].name, {}, silentLogger);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe('Erro: Erro interno inesperado');
  });
});

describe('resources e prompts MCP', () => {
  test('lista e lê recursos', () => {
    const { services } = setup();
    const resources = listResources(services);
    expect(resources.length).toBe(7);
    expect(JSON.parse(readResource(services, 'geo://trails').text).length).toBe(6);
    const md = readResource(services, 'geo://trails/java');
    expect(md.mimeType).toBe('text/markdown');
    expect(md.text).toContain('# Trilha Java Developer');
    expect(md.text).toContain('## Avancado');
    expect(() => readResource(services, 'geo://trails/cobol')).toThrow('Recurso não encontrado');
    expect(() => readResource(services, 'http://x')).toThrow('Recurso não encontrado');
  });

  test('prompts', () => {
    const { services } = setup();
    expect(listPrompts().map((p) => p.name)).toEqual(['study_plan', 'review_challenge', 'explain_module']);

    const plan = getPrompt(services, 'study_plan', { tech: 'ts', hoursPerWeek: '10' });
    expect(plan.messages[0].content.text).toContain('typescript');
    expect(plan.messages[0].content.text).toContain('10h por semana');
    expect(() => getPrompt(services, 'study_plan', { tech: 'java', hoursPerWeek: '-1' })).toThrow('entre 1 e 80');

    const review = getPrompt(services, 'review_challenge', { userName: 'Ana Costa', challengeId: 'java-basics-1' });
    expect(review.messages[0].content.text).toContain('1. Criar uma classe Calculator');

    expect(getPrompt(services, 'explain_module', { moduleId: 'java-poo' }).messages[0].content.text).toContain('herança e polimorfismo');
    expect(() => getPrompt(services, 'explain_module', {})).toThrow('obrigatório');
    expect(() => getPrompt(services, 'nada')).toThrow('Prompt não encontrado');
  });
});
