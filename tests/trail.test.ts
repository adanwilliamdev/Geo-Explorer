import trailService from '../src/services/trailService';

describe('TrailService', () => {
  test('deve retornar trilha Java corretamente', () => {
    const trail = trailService.getTrail('java');
    expect(trail.tech).toBe('java');
    expect(trail.title).toBe('Trilha Java Developer');
    expect(trail.levels).toContain('iniciante');
    expect(trail.levels).toContain('intermediario');
    expect(trail.levels).toContain('avancado');
  });

  test('deve retornar trilha Node.js corretamente', () => {
    const trail = trailService.getTrail('node');
    expect(trail.tech).toBe('node');
    expect(trail.title).toBe('Trilha Node.js Backend');
    expect(trail.levels).toContain('iniciante');
    expect(trail.levels).toContain('intermediario');
    expect(trail.levels).not.toContain('avancado');
  });

  test('deve lançar erro para tecnologia não existente', () => {
    expect(() => {
      trailService.getTrail('tecnologia-inexistente');
    }).toThrow('Trilha não encontrada');
  });

  test('deve listar todas as tecnologias', () => {
    const techs = trailService.listTechnologies();
    expect(techs).toContain('java');
    expect(techs).toContain('node');
    expect(techs).toContain('react');
    expect(techs).toContain('python');
    expect(techs.length).toBe(4);
  });

  test('deve extrair nomes dos módulos corretamente', () => {
    const trail = trailService.getTrail('java');
    expect(trail.modules).toBeDefined();
    expect(Array.isArray(trail.modules)).toBe(true);
    expect(trail.modules.length).toBeGreaterThan(0);
  });
});
