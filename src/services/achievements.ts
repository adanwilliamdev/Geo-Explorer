import { LEVELS } from '../types';
import { computeStreak, UserRecord } from './progressTypes';
import { TrailService } from './trailService';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  check(user: UserRecord, trails: TrailService): boolean;
}

const completedIds = (user: UserRecord): string[] => Object.keys(user.modules);

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-steps',
    title: 'Primeiros Passos',
    description: 'Concluiu o primeiro módulo.',
    check: (u) => completedIds(u).length >= 1,
  },
  {
    id: 'challenger',
    title: 'Desafiante',
    description: 'Foi aprovado no primeiro desafio prático.',
    check: (u) => Object.values(u.challenges).some((c) => c.passed),
  },
  {
    id: 'perfectionist',
    title: 'Perfeccionista',
    description: 'Atingiu nota 100 em um desafio.',
    check: (u) => Object.values(u.challenges).some((c) => c.bestScore === 100),
  },
  {
    id: 'on-fire',
    title: 'Em Chamas',
    description: 'Estudou em 3 dias consecutivos.',
    check: (u) => computeStreak(u.activityDays, u.activityDays[u.activityDays.length - 1] ?? '').longest >= 3,
  },
  {
    id: 'level-clear',
    title: 'Nível Concluído',
    description: 'Concluiu todos os módulos de um nível de alguma trilha.',
    check: (u, trails) =>
      trails.listTechnologies().some((tech) =>
        LEVELS.some((level) => {
          const modules = trails.getModules(tech, level);
          return modules.length > 0 && modules.every((m) => u.modules[m.id]);
        })
      ),
  },
  {
    id: 'trail-master',
    title: 'Mestre da Trilha',
    description: 'Concluiu todos os módulos de uma trilha.',
    check: (u, trails) =>
      trails.listTechnologies().some((tech) => trails.getModules(tech).every((m) => u.modules[m.id])),
  },
  {
    id: 'polyglot',
    title: 'Poliglota',
    description: 'Concluiu módulos em 3 tecnologias diferentes.',
    check: (u, trails) => new Set(completedIds(u).map((id) => trails.getModule(id).tech)).size >= 3,
  },
  {
    id: 'xp-500',
    title: 'Meio Milhar',
    description: 'Acumulou 500 XP.',
    check: (u) => u.xp >= 500,
  },
];

/** Retorna as conquistas cujo critério foi atingido e que ainda não estavam desbloqueadas. */
export function findNewAchievements(user: UserRecord, trails: TrailService): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !user.achievements[a.id] && a.check(user, trails));
}
