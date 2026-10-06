import challengeService, { ChallengeService } from '../src/services/challengeService';
import { TrailService } from '../src/services/trailService';

describe('ChallengeService', () => {
  test('deve gerar desafio para Java iniciante', () => {
    const challenge = challengeService.generateChallenge('java', 'iniciante');
    expect(challenge.tech).toBe('java');
    expect(challenge.level).toBe('iniciante');
    expect(challenge.difficulty).toBe('easy');
    expect(challenge.xp).toBe(50);
    expect(Array.isArray(challenge.requirements)).toBe(true);
  });

  test('deve gerar desafio para Node.js intermediário e aceitar variações do nível', () => {
    const challenge = challengeService.generateChallenge('node', 'Intermediário');
    expect(challenge.tech).toBe('node');
    expect(challenge.level).toBe('intermediario');
    expect(challenge.id).toContain('node');
  });

  test('o id do desafio é estável (permite submeter a solução depois)', () => {
    const a = challengeService.getChallenge('java-basics-1');
    const b = challengeService.getChallenge('java-basics-1');
    expect(a.id).toBe(b.id);
    expect(a.id).toBe('java-basics-1');
  });

  test('deve lançar erro para tecnologia não suportada', () => {
    expect(() => challengeService.generateChallenge('rust', 'iniciante')).toThrow('Tecnologia não suportada');
  });

  test('deve lançar erro para nível não encontrado', () => {
    expect(() => challengeService.generateChallenge('java', 'nivel-inexistente')).toThrow('Nível não encontrado');
  });

  test('todas as trilhas têm desafios nos três níveis', () => {
    for (const tech of new TrailService().listTechnologies()) {
      expect(challengeService.getAvailableLevels(tech)).toEqual(['iniciante', 'intermediario', 'avancado']);
    }
  });

  test('deve gerar múltiplos desafios distintos', () => {
    const challenges = challengeService.generateMultipleChallenges('java', 'intermediario', 5);
    expect(challenges.length).toBe(2);
    expect(new Set(challenges.map((c) => c.id)).size).toBe(2);
    challenges.forEach((c) => expect(c.tech).toBe('java'));
  });

  test('excludeIds evita desafios concluídos e sinaliza repetição quando acabam as opções', () => {
    const svc = new ChallengeService({ rng: () => 0 });
    const first = svc.pickChallenge('java', 'intermediario');
    const second = svc.pickChallenge('java', 'intermediario', { excludeIds: [first.challenge.id] });
    expect(second.challenge.id === first.challenge.id).toBe(false);
    expect(second.repeated).toBe(false);

    const all = svc.listChallenges({ tech: 'java', level: 'intermediario' }).map((c) => c.id);
    expect(svc.pickChallenge('java', 'intermediario', { excludeIds: all }).repeated).toBe(true);
  });

  test('avaliação calcula nota, aprovação, XP e requisitos pendentes', () => {
    const svc = new ChallengeService({ passScore: 70 });
    const reqs = svc.getChallenge('java-spring-1').requirements.length; // 4 requisitos, XP base 200
    const full = svc.evaluate('java-spring-1', Array(reqs).fill(true));
    expect(full.score).toBe(100);
    expect(full.passed).toBe(true);
    expect(full.xp).toBe(200);

    const partial = svc.evaluate('java-spring-1', [true, true, true, false]);
    expect(partial.score).toBe(75);
    expect(partial.passed).toBe(true);
    expect(partial.unmet.length).toBe(1);
    expect(partial.xp).toBe(150);

    const failed = svc.evaluate('java-spring-1', [true, false, false, false]);
    expect(failed.passed).toBe(false);
    expect(failed.xp).toBe(0);
  });

  test('dicas reduzem o XP em até 50%', () => {
    const svc = new ChallengeService();
    const n = svc.getChallenge('java-spring-1').requirements.length;
    expect(svc.evaluate('java-spring-1', Array(n).fill(true), 2).xp).toBe(160);
    expect(svc.evaluate('java-spring-1', Array(n).fill(true), 9).xp).toBe(100);
  });

  test('avaliação valida o tamanho da lista e o desafio', () => {
    expect(() => challengeService.evaluate('java-basics-1', [true])).toThrow('deve ter 4 itens');
    expect(() => challengeService.evaluate('nao-existe', [true])).toThrow('Desafio não encontrado');
  });

  test('desafios referenciam apenas módulos da própria trilha', () => {
    const trails = new TrailService();
    for (const c of challengeService.listChallenges()) {
      for (const id of c.moduleIds) expect(trails.getModule(id).tech).toBe(c.tech);
    }
  });
});
