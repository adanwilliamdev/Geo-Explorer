import { Level } from '../types';

export interface Enrollment {
  tech: string;
  level: Level;
  enrolledAt: string;
}

export interface ChallengeRecord {
  bestScore: number;
  attempts: number;
  passed: boolean;
  firstPassedAt?: string;
  lastAttemptAt: string;
  xpAwarded: number;
}

export interface UserRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  enrollments: Record<string, Enrollment>;
  modules: Record<string, { completedAt: string }>;
  challenges: Record<string, ChallengeRecord>;
  achievements: Record<string, { unlockedAt: string }>;
  /** Dias (YYYY-MM-DD, UTC) com atividade; usados para calcular a sequência (streak). */
  activityDays: string[];
  xp: number;
}

export interface ProgressState {
  version: 1;
  users: Record<string, UserRecord>;
}

export const emptyProgressState = (): ProgressState => ({ version: 1, users: {} });

// ---------------------------------------------------------------------------
// Ranking por XP
// ---------------------------------------------------------------------------

export interface Rank {
  level: number;
  title: string;
  xp: number;
  /** XP em que o nível atual começou. */
  currentLevelXp: number;
  /** XP necessário para o próximo nível. */
  nextLevelXp: number;
}

const xpForLevel = (level: number): number => 50 * (level - 1) * (level - 1);

const RANK_TITLES: Array<{ from: number; title: string }> = [
  { from: 1, title: 'Explorador' },
  { from: 2, title: 'Aprendiz' },
  { from: 3, title: 'Desbravador' },
  { from: 5, title: 'Navegador' },
  { from: 8, title: 'Cartógrafo' },
  { from: 12, title: 'Mestre Geo' },
];

export function rankFor(xp: number): Rank {
  const safeXp = Math.max(0, xp);
  const level = Math.floor(Math.sqrt(safeXp / 50)) + 1;
  const title = [...RANK_TITLES].reverse().find((r) => level >= r.from)?.title ?? 'Explorador';
  return {
    level,
    title,
    xp: safeXp,
    currentLevelXp: xpForLevel(level),
    nextLevelXp: xpForLevel(level + 1),
  };
}

// ---------------------------------------------------------------------------
// Sequência de dias (streak)
// ---------------------------------------------------------------------------

const dayNumber = (isoDay: string): number => Math.floor(Date.parse(`${isoDay}T00:00:00Z`) / 86_400_000);

export interface Streak {
  current: number;
  longest: number;
}

/** `days`: dias ISO (YYYY-MM-DD) únicos e ordenados. A sequência atual continua viva se o último dia for hoje ou ontem. */
export function computeStreak(days: string[], today: string): Streak {
  if (days.length === 0) return { current: 0, longest: 0 };
  const nums = days.map(dayNumber);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] - nums[i - 1] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = nums[nums.length - 1];
  const gap = dayNumber(today) - last;
  if (gap > 1 || gap < 0) return { current: gap < 0 ? run : 0, longest };
  return { current: run, longest };
}
