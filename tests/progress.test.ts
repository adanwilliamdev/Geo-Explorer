import { computeStreak, rankFor } from '../src/services/progressTypes';
import { completeUpTo, makeServices, passChallenges } from './helpers';

describe('ProgressService', () => {
  test('enroll cria o usuário, é idempotente e sugere os primeiros passos', () => {
    const { progress } = makeServices();
    const first = progress.enroll('João Silva', 'java');
    expect(first.created).toBe(true);
    expect(first.alreadyEnrolled).toBe(false);
    expect(first.firstSteps[0].id).toBe('java-sintaxe-basica');

    const again = progress.enroll('joao silva', 'Java', 'intermediario');
    expect(again.created).toBe(false);
    expect(again.alreadyEnrolled).toBe(true);
    expect(again.trail.targetLevel).toBe('intermediario');
  });

  test('valida nome e trilha', () => {
    const { progress } = makeServices();
    expect(() => progress.enroll('Jo', 'java')).toThrow('pelo menos 3 caracteres');
    expect(() => progress.enroll('!!!', 'java')).toThrow('letras ou números');
    expect(() => progress.enroll('João Silva', 'cobol')).toThrow('Trilha não encontrada');
  });

  test('completar módulo concede XP (10 por hora) e atualiza o percentual', () => {
    const { progress } = makeServices();
    const r = progress.completeModule('João Silva', 'java-sintaxe-basica');
    expect(r.xpEarned).toBe(60);
    expect(r.user.xp).toBe(60);
    expect(r.trail.modulesCompleted).toBe(1);
    expect(r.trail.percent).toBe(13);
    expect(r.newAchievements.map((a) => a.id)).toContain('first-steps');
  });

  test('completar de novo não concede XP duas vezes', () => {
    const { progress } = makeServices();
    progress.completeModule('João Silva', 'java-sintaxe-basica');
    const again = progress.completeModule('João Silva', 'java-sintaxe-basica');
    expect(again.alreadyCompleted).toBe(true);
    expect(again.xpEarned).toBe(0);
    expect(again.user.xp).toBe(60);
  });

  test('exige pré-requisitos e não grava nada quando falha', () => {
    const { progress } = makeServices();
    expect(() => progress.completeModule('João Silva', 'java-poo')).toThrow('pré-requisitos');
    expect(progress.hasUser('João Silva')).toBe(false);
  });

  test('aceita o nome do módulo quando a trilha é informada', () => {
    const { progress } = makeServices();
    const r = progress.completeModule('João Silva', 'sintaxe basica', 'java');
    expect(r.module.id).toBe('java-sintaxe-basica');
  });

  test('registra resultado de desafio e só concede XP na primeira aprovação', () => {
    const s = makeServices();
    const ch = s.challenges.getChallenge('java-basics-1');
    const ok = s.challenges.evaluate(ch.id, ch.requirements.map(() => true));

    const first = s.progress.recordChallengeResult('João Silva', ok);
    expect(first.firstPass).toBe(true);
    expect(first.xpEarned).toBe(50);
    expect(first.newAchievements.map((a) => a.id)).toEqual(['challenger', 'perfectionist']);

    const second = s.progress.recordChallengeResult('João Silva', ok);
    expect(second.firstPass).toBe(false);
    expect(second.xpEarned).toBe(0);
    expect(second.attempts).toBe(2);
    expect(second.user.xp).toBe(50);
  });

  test('reprovação não concede XP e permite nova tentativa', () => {
    const s = makeServices();
    const ch = s.challenges.getChallenge('java-basics-1');
    const bad = s.challenges.evaluate(ch.id, [true, false, false, false]);
    const r = s.progress.recordChallengeResult('João Silva', bad);
    expect(r.evaluation.passed).toBe(false);
    expect(r.xpEarned).toBe(0);

    const good = s.challenges.evaluate(ch.id, [true, true, true, false]);
    const r2 = s.progress.recordChallengeResult('João Silva', good);
    expect(r2.firstPass).toBe(true);
    expect(r2.bestScore).toBe(75);
    expect(r2.attempts).toBe(2);
  });

  test('passedChallengeIds alimenta a exclusão de desafios repetidos', () => {
    const s = makeServices();
    passChallenges(s, 'João Silva', 'java', ['intermediario']);
    expect(s.progress.passedChallengeIds('João Silva')).toEqual(['java-oop-1']);
    expect(s.progress.passedChallengeIds('Alguém Novo')).toEqual([]);
  });

  test('getProgress retorna painel e falha para usuário desconhecido', () => {
    const s = makeServices();
    expect(() => s.progress.getProgress('Ninguém Aqui')).toThrow('Usuário não encontrado');
    s.progress.enroll('João Silva', 'node');
    s.progress.completeModule('João Silva', 'node-fundamentos-http');
    const p = s.progress.getProgress('João Silva');
    expect(p.trails.length).toBe(1);
    expect(p.trails[0].tech).toBe('node');
    expect(p.user.xp).toBe(50);
    expect(p.user.rank.title).toBe('Aprendiz');
    expect(p.certificateEligibility).toBe(undefined);
  });

  test('getProgress com tech informa a elegibilidade por nível', () => {
    const s = makeServices();
    completeUpTo(s, 'João Silva', 'java', 'iniciante');
    const p = s.progress.getProgress('João Silva', 'java');
    const elig = p.certificateEligibility ?? [];
    expect(elig.map((e) => e.level)).toEqual(['iniciante', 'intermediario', 'avancado', 'completo']);
    expect(elig[0].eligible).toBe(false);
    expect(elig[0].missingChallengeLevels).toEqual(['iniciante']);
    expect(elig[0].missingModules.length).toBe(0);
    expect(elig[1].missingModules.length).toBe(3);
  });

  test('recommendNext sugere módulos disponíveis e um desafio do nível atual', () => {
    const s = makeServices();
    s.progress.enroll('João Silva', 'java');
    const r = s.progress.recommendNext('João Silva').recommendations[0];
    expect(r.status).toBe('in_progress');
    expect(r.nextModules.map((m) => m.id)).toEqual(['java-sintaxe-basica']);
    expect(r.suggestedChallenge?.id).toBe('java-basics-1');

    s.progress.completeModule('João Silva', 'java-sintaxe-basica');
    expect(s.progress.recommendNext('João Silva').recommendations[0].nextModules[0].id).toBe('java-estruturas-controle');
  });

  test('recommendNext funciona sem usuário quando a tecnologia é informada, e exige contexto', () => {
    const s = makeServices();
    expect(s.progress.recommendNext(undefined, 'python').recommendations[0].nextModules[0].id).toBe('python-basico');
    expect(() => s.progress.recommendNext()).toThrow('Informe uma tecnologia');
  });

  test('trilha concluída é reportada como completed', () => {
    const s = makeServices();
    completeUpTo(s, 'João Silva', 'typescript');
    const r = s.progress.recommendNext('João Silva', 'typescript').recommendations[0];
    expect(r.status).toBe('completed');
    expect(r.nextModules.length).toBe(0);
  });

  test('conquistas de trilha e nível são desbloqueadas', () => {
    const s = makeServices();
    completeUpTo(s, 'João Silva', 'java');
    const ids = s.progress.getProgress('João Silva').user.achievements.map((a) => a.id);
    for (const id of ['first-steps', 'level-clear', 'trail-master', 'xp-500']) expect(ids).toContain(id);
  });

  test('poliglota exige módulos em 3 tecnologias', () => {
    const s = makeServices();
    s.progress.completeModule('João Silva', 'java-sintaxe-basica');
    s.progress.completeModule('João Silva', 'python-basico');
    const last = s.progress.completeModule('João Silva', 'devops-git');
    expect(last.newAchievements.map((a) => a.id)).toContain('polyglot');
  });

  test('streak de 3 dias consecutivos desbloqueia "on-fire"', () => {
    const s = makeServices();
    s.progress.completeModule('João Silva', 'java-sintaxe-basica');
    s.clockState.now = new Date('2026-01-11T09:00:00Z');
    s.progress.completeModule('João Silva', 'java-estruturas-controle');
    s.clockState.now = new Date('2026-01-12T09:00:00Z');
    const r = s.progress.completeModule('João Silva', 'devops-git');
    expect(r.user.streak.current).toBe(3);
    expect(r.newAchievements.map((a) => a.id)).toContain('on-fire');
  });

  test('deleteUser apaga o perfil', () => {
    const s = makeServices();
    s.progress.enroll('João Silva', 'java');
    expect(s.progress.deleteUser('João Silva')).toBe(true);
    expect(s.progress.deleteUser('João Silva')).toBe(false);
    expect(s.progress.hasUser('João Silva')).toBe(false);
  });
});

describe('rankFor e computeStreak', () => {
  test('rank por XP', () => {
    expect(rankFor(0).level).toBe(1);
    expect(rankFor(49).level).toBe(1);
    expect(rankFor(50).level).toBe(2);
    expect(rankFor(200).title).toBe('Desbravador');
    expect(rankFor(200).nextLevelXp).toBe(450);
    expect(rankFor(5000).title).toBe('Cartógrafo');
    expect(rankFor(6050).title).toBe('Mestre Geo');
  });

  test('streak', () => {
    expect(computeStreak([], '2026-01-10')).toEqual({ current: 0, longest: 0 });
    expect(computeStreak(['2026-01-08', '2026-01-09', '2026-01-10'], '2026-01-10')).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(['2026-01-08', '2026-01-09'], '2026-01-10').current).toBe(2); // ainda viva (ontem)
    expect(computeStreak(['2026-01-05', '2026-01-06'], '2026-01-10')).toEqual({ current: 0, longest: 2 });
    expect(computeStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-09', '2026-01-10'], '2026-01-10')).toEqual({ current: 2, longest: 3 });
  });
});
