import { Catalog, orderModules, TrailService, validateCatalog } from '../src/services/trailService';
import trailService from '../src/services/trailService';

describe('TrailService', () => {
  test('deve retornar trilha Java corretamente', () => {
    const trail = trailService.getTrail('java');
    expect(trail.tech).toBe('java');
    expect(trail.title).toBe('Trilha Java Developer');
    expect(trail.levels).toEqual(['iniciante', 'intermediario', 'avancado']);
    expect(trail.suggestedLevel).toBe('iniciante');
  });

  test('toda trilha possui os três níveis', () => {
    for (const tech of trailService.listTechnologies()) {
      expect(trailService.getTrail(tech).levels).toHaveLength(3);
    }
  });

  test('deve manter modules como lista de nomes e expor detalhes', () => {
    const trail = trailService.getTrail('java');
    expect(trail.modules).toContain('Spring Boot');
    expect(trail.moduleDetails.length).toBe(trail.modules.length);
    expect(trail.totalHours).toBeGreaterThan(0);
    expect(trail.levelSummary.iniciante?.modules).toBe(2);
  });

  test('deve aceitar aliases e variações de escrita', () => {
    expect(trailService.getTrail('Node.js').tech).toBe('node');
    expect(trailService.getTrail('  TS ').tech).toBe('typescript');
    expect(trailService.getTrail('k8s').tech).toBe('devops');
  });

  test('deve lançar erro com sugestão para tecnologia inexistente', () => {
    expect(() => trailService.getTrail('tecnologia-inexistente')).toThrow('Trilha não encontrada');
    expect(() => trailService.getTrail('pyton')).toThrow('Você quis dizer "python"');
  });

  test('deve listar todas as tecnologias', () => {
    const techs = trailService.listTechnologies();
    for (const t of ['java', 'node', 'react', 'python', 'typescript', 'devops']) {
      expect(techs).toContain(t);
    }
    expect(techs.length).toBe(6);
    expect(trailService.listTrails().length).toBe(6);
  });

  test('deve resolver módulo por id e por nome', () => {
    expect(trailService.getModule('java-poo').tech).toBe('java');
    expect(trailService.resolveModule('collections api', 'java').id).toBe('java-collections');
    expect(() => trailService.getModule('java-pooo')).toThrow('Você quis dizer "java-poo"');
  });

  test('learning path respeita pré-requisitos e acumula horas', () => {
    for (const tech of trailService.listTechnologies()) {
      const path = trailService.getLearningPath(tech);
      const seen = new Set<string>();
      for (const step of path.steps) {
        for (const pre of step.module.prerequisites) expect(seen.has(pre)).toBe(true);
        seen.add(step.module.id);
      }
      expect(path.steps[path.steps.length - 1].cumulativeHours).toBe(path.totalHours);
    }
  });

  test('learning path pode ser filtrado por nível', () => {
    const path = trailService.getLearningPath('java', 'Avançado');
    expect(path.level).toBe('avancado');
    expect(path.steps.every((s) => s.module.level === 'avancado')).toBe(true);
  });

  test('validateCatalog rejeita pré-requisito inexistente, ciclo e dependência de nível superior', () => {
    const mod = (id: string, level: string, prerequisites: string[]) => ({
      id, name: id, level, hours: 1, topics: [], prerequisites,
    });
    const make = (modules: unknown[]): Catalog =>
      ({ t: { title: 'T', description: 'd', modules } }) as unknown as Catalog;

    expect(() => validateCatalog(make([mod('t-a', 'iniciante', ['t-x'])]))).toThrow('não existe');
    expect(() =>
      validateCatalog(make([mod('t-a', 'iniciante', ['t-b']), mod('t-b', 'iniciante', ['t-a'])]))
    ).toThrow('ciclo');
    expect(() =>
      validateCatalog(make([mod('t-a', 'iniciante', ['t-b']), mod('t-b', 'avancado', [])]))
    ).toThrow('nível mais alto');
    expect(() => new TrailService(make([mod('t-a', 'iniciante', [])]))).not.toThrow();
  });

  test('orderModules lança erro quando há ciclo', () => {
    const m = (id: string, p: string[]) => ({ id, name: id, level: 'iniciante' as const, hours: 1, topics: [], prerequisites: p });
    expect(() => orderModules([m('a', ['b']), m('b', ['a'])])).toThrow('ciclo');
  });
});
