import challengeService from '../src/services/challengeService';

describe('ChallengeService', () => {
  test('deve gerar desafio para Java iniciante', () => {
    const challenge = challengeService.generateChallenge('java', 'iniciante');
    expect(challenge.tech).toBe('java');
    expect(challenge.level).toBe('iniciante');
    expect(challenge.title).toBeDefined();
    expect(challenge.description).toBeDefined();
    expect(challenge.requirements).toBeDefined();
    expect(Array.isArray(challenge.requirements)).toBe(true);
  });

  test('deve gerar desafio para Node.js intermediário', () => {
    const challenge = challengeService.generateChallenge('node', 'intermediario');
    expect(challenge.tech).toBe('node');
    expect(challenge.level).toBe('intermediario');
    expect(challenge.id).toContain('node');
  });

  test('deve lançar erro para tecnologia não suportada', () => {
    expect(() => {
      challengeService.generateChallenge('rust', 'iniciante');
    }).toThrow('Tecnologia não suportada');
  });

  test('deve lançar erro para nível não encontrado', () => {
    expect(() => {
      challengeService.generateChallenge('java', 'nivel-inexistente');
    }).toThrow('Nível não encontrado');
  });

  test('deve gerar múltiplos desafios', () => {
    const challenges = challengeService.generateMultipleChallenges('java', 'iniciante', 2);
    expect(Array.isArray(challenges)).toBe(true);
    expect(challenges.length).toBeLessThanOrEqual(2);
    challenges.forEach(c => {
      expect(c.tech).toBe('java');
      expect(c.level).toBe('iniciante');
    });
  });

  test('deve listar níveis disponíveis', () => {
    const levels = challengeService.getAvailableLevels('java');
    expect(levels).toContain('iniciante');
    expect(levels).toContain('intermediario');
    expect(levels).toContain('avancado');
  });
});
