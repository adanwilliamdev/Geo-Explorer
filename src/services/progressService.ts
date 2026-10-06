import { NotFoundError, PreconditionError, ValidationError } from '../errors';
import { CertificateLevel, Clock, Level, LEVELS, systemClock } from '../types';
import { parseLevel, slugify } from '../validation';
import { MemoryStore, Store } from '../storage/store';
import { ACHIEVEMENTS, findNewAchievements } from './achievements';
import challengeServiceDefault, { Challenge, ChallengeEvaluation, ChallengeService } from './challengeService';
import {
  computeStreak,
  emptyProgressState,
  ProgressState,
  Rank,
  rankFor,
  Streak,
  UserRecord,
} from './progressTypes';
import trailServiceDefault, { Module, TrailService } from './trailService';

export interface ProgressServiceDeps {
  store?: Store<ProgressState>;
  trails?: TrailService;
  challenges?: ChallengeService;
  clock?: Clock;
}

export interface AchievementView {
  id: string;
  title: string;
  description: string;
  unlockedAt?: string;
}

export interface UserSummary {
  id: string;
  name: string;
  xp: number;
  rank: Rank;
  streak: Streak;
  modulesCompleted: number;
  challengesPassed: number;
  enrolledIn: string[];
  achievements: AchievementView[];
}

export interface ModuleBrief {
  id: string;
  name: string;
  level: Level;
  hours: number;
}

export interface TrailProgress {
  tech: string;
  title: string;
  targetLevel: Level | null;
  modulesCompleted: number;
  modulesTotal: number;
  percent: number;
  hoursCompleted: number;
  hoursTotal: number;
  challengesPassed: number;
  byLevel: Partial<Record<Level, { completed: number; total: number }>>;
  nextModules: ModuleBrief[];
}

export interface CompletionStatus {
  userKnown: boolean;
  tech: string;
  level: CertificateLevel;
  eligible: boolean;
  modulesCompleted: number;
  modulesRequired: number;
  missingModules: Array<{ id: string; name: string }>;
  /** Níveis exigidos que ainda não têm nenhum desafio aprovado. */
  missingChallengeLevels: Level[];
}

export interface EnrollResult {
  created: boolean;
  alreadyEnrolled: boolean;
  user: UserSummary;
  trail: TrailProgress;
  firstSteps: ModuleBrief[];
}

export interface CompleteModuleResult {
  module: ModuleBrief & { tech: string };
  alreadyCompleted: boolean;
  xpEarned: number;
  user: UserSummary;
  newAchievements: AchievementView[];
  trail: TrailProgress;
}

export interface ChallengeResult {
  evaluation: ChallengeEvaluation;
  /** true na primeira aprovação (única que concede XP). */
  firstPass: boolean;
  xpEarned: number;
  attempts: number;
  bestScore: number;
  user: UserSummary;
  newAchievements: AchievementView[];
}

export interface Recommendation {
  tech: string;
  status: 'in_progress' | 'completed';
  nextModules: ModuleBrief[];
  suggestedChallenge?: Pick<Challenge, 'id' | 'title' | 'level' | 'estimatedTime'>;
  tip: string;
}

const ACHIEVEMENT_INDEX = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

const brief = (m: Module): ModuleBrief => ({ id: m.id, name: m.name, level: m.level, hours: m.hours });

export class ProgressService {
  private readonly store: Store<ProgressState>;
  private readonly trails: TrailService;
  private readonly challenges: ChallengeService;
  private readonly clock: Clock;

  constructor(deps: ProgressServiceDeps = {}) {
    this.store = deps.store ?? new MemoryStore<ProgressState>(emptyProgressState());
    this.trails = deps.trails ?? trailServiceDefault;
    this.challenges = deps.challenges ?? challengeServiceDefault;
    this.clock = deps.clock ?? systemClock;
  }

  // -------------------------------------------------------------------------
  // Identidade
  // -------------------------------------------------------------------------

  /** O ID do usuário é derivado do nome: "João Silva" e "joao silva" são a mesma pessoa. */
  static userIdFor(userName: string): string {
    const name = userName.trim();
    if (name.length < 3) throw new ValidationError('Nome do usuário deve ter pelo menos 3 caracteres');
    const id = slugify(name);
    if (!id) throw new ValidationError('Nome do usuário deve conter letras ou números');
    return id;
  }

  private newUser(id: string, name: string, now: string): UserRecord {
    return {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      enrollments: {},
      modules: {},
      challenges: {},
      achievements: {},
      activityDays: [],
      xp: 0,
    };
  }

  private getOrCreate(state: ProgressState, userName: string, now: string): UserRecord {
    const id = ProgressService.userIdFor(userName);
    return (state.users[id] ??= this.newUser(id, userName.trim(), now));
  }

  private findUser(userName: string): UserRecord {
    const id = ProgressService.userIdFor(userName);
    const user = this.store.read().users[id];
    if (!user) {
      throw new NotFoundError(
        `Usuário não encontrado: ${userName.trim()}. Use enroll para iniciar uma trilha.`
      );
    }
    return user;
  }

  private touch(user: UserRecord, now: string): void {
    user.updatedAt = now;
    const day = now.slice(0, 10);
    if (!user.activityDays.includes(day)) {
      user.activityDays.push(day);
      user.activityDays.sort();
      if (user.activityDays.length > 400) user.activityDays.splice(0, user.activityDays.length - 400);
    }
  }

  private unlockAchievements(user: UserRecord, now: string): AchievementView[] {
    const unlocked = findNewAchievements(user, this.trails);
    for (const a of unlocked) user.achievements[a.id] = { unlockedAt: now };
    return unlocked.map(({ id, title, description }) => ({ id, title, description, unlockedAt: now }));
  }

  // -------------------------------------------------------------------------
  // Ações
  // -------------------------------------------------------------------------

  enroll(userName: string, tech: string, level?: string): EnrollResult {
    const key = this.trails.resolveTech(tech);
    const trail = this.trails.getTrail(key);
    const parsedLevel = level ? parseLevel(level) : undefined;
    if (parsedLevel && !trail.levels.includes(parsedLevel)) {
      throw new ValidationError(`A trilha "${key}" não possui o nível ${parsedLevel}`);
    }
    const now = this.clock().toISOString();

    const { user, created, alreadyEnrolled } = this.store.update((state) => {
      const existed = Boolean(state.users[ProgressService.userIdFor(userName)]);
      const record = this.getOrCreate(state, userName, now);
      const current = record.enrollments[key];
      record.enrollments[key] = {
        tech: key,
        level: parsedLevel ?? current?.level ?? trail.suggestedLevel,
        enrolledAt: current?.enrolledAt ?? now,
      };
      this.touch(record, now);
      return { user: record, created: !existed, alreadyEnrolled: Boolean(current) };
    });

    const progress = this.trailProgress(user, key);
    return {
      created,
      alreadyEnrolled,
      user: this.summarize(user),
      trail: progress,
      firstSteps: progress.nextModules,
    };
  }

  /** `moduleRef`: id do módulo ou (com `tech`) o nome dele. */
  completeModule(userName: string, moduleRef: string, tech?: string): CompleteModuleResult {
    const mod = this.trails.resolveModule(moduleRef, tech);
    const now = this.clock().toISOString();

    const outcome = this.store.update((state) => {
      const user = this.getOrCreate(state, userName, now);
      if (user.modules[mod.id]) {
        return { user, alreadyCompleted: true, xpEarned: 0, newAchievements: [] as AchievementView[] };
      }

      const missing = mod.prerequisites.filter((p) => !user.modules[p]);
      if (missing.length > 0) {
        const names = missing.map((id) => this.trails.getModule(id).name);
        throw new PreconditionError(
          `Conclua antes os pré-requisitos de "${mod.name}": ${names.join(', ')}`,
          { missing }
        );
      }

      user.modules[mod.id] = { completedAt: now };
      const xpEarned = Math.round(mod.hours * 10);
      user.xp += xpEarned;
      user.enrollments[mod.tech] ??= { tech: mod.tech, level: mod.level, enrolledAt: now };
      this.touch(user, now);
      return { user, alreadyCompleted: false, xpEarned, newAchievements: this.unlockAchievements(user, now) };
    });

    return {
      module: { ...brief(mod), tech: mod.tech },
      alreadyCompleted: outcome.alreadyCompleted,
      xpEarned: outcome.xpEarned,
      user: this.summarize(outcome.user),
      newAchievements: outcome.newAchievements,
      trail: this.trailProgress(outcome.user, mod.tech),
    };
  }

  /** Registra o resultado de uma avaliação. Apenas a primeira aprovação concede XP (sem "farm" de XP). */
  recordChallengeResult(userName: string, evaluation: ChallengeEvaluation): ChallengeResult {
    const challenge = this.challenges.getChallenge(evaluation.challengeId);
    const now = this.clock().toISOString();

    const outcome = this.store.update((state) => {
      const user = this.getOrCreate(state, userName, now);
      const record = (user.challenges[challenge.id] ??= {
        bestScore: 0,
        attempts: 0,
        passed: false,
        lastAttemptAt: now,
        xpAwarded: 0,
      });
      record.attempts += 1;
      record.bestScore = Math.max(record.bestScore, evaluation.score);
      record.lastAttemptAt = now;

      let xpEarned = 0;
      const firstPass = evaluation.passed && !record.passed;
      if (firstPass) {
        record.passed = true;
        record.firstPassedAt = now;
        xpEarned = evaluation.xp;
        record.xpAwarded = xpEarned;
        user.xp += xpEarned;
      }
      user.enrollments[challenge.tech] ??= {
        tech: challenge.tech,
        level: challenge.level,
        enrolledAt: now,
      };
      this.touch(user, now);
      return {
        user,
        firstPass,
        xpEarned,
        attempts: record.attempts,
        bestScore: record.bestScore,
        newAchievements: this.unlockAchievements(user, now),
      };
    });

    return {
      evaluation,
      firstPass: outcome.firstPass,
      xpEarned: outcome.xpEarned,
      attempts: outcome.attempts,
      bestScore: outcome.bestScore,
      user: this.summarize(outcome.user),
      newAchievements: outcome.newAchievements,
    };
  }

  /** Remove todos os dados do usuário (direito de exclusão, LGPD). Retorna false se não existia. */
  deleteUser(userName: string): boolean {
    const id = ProgressService.userIdFor(userName);
    return this.store.update((state) => {
      if (!state.users[id]) return false;
      delete state.users[id];
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // Consultas
  // -------------------------------------------------------------------------

  hasUser(userName: string): boolean {
    return Boolean(this.store.read().users[ProgressService.userIdFor(userName)]);
  }

  /** IDs dos desafios já aprovados pela pessoa (vazio se o usuário ainda não existe). */
  passedChallengeIds(userName: string): string[] {
    const user = this.store.read().users[ProgressService.userIdFor(userName)];
    if (!user) return [];
    return Object.entries(user.challenges)
      .filter(([, record]) => record.passed)
      .map(([id]) => id);
  }

  /** Painel do usuário; com `tech`, inclui a elegibilidade para cada tipo de certificado. */
  getProgress(userName: string, tech?: string) {
    const user = this.findUser(userName);
    const techs = tech ? [this.trails.resolveTech(tech)] : this.techsWithActivity(user);

    const result = {
      user: this.summarize(user),
      trails: techs.map((t) => this.trailProgress(user, t)),
      certificateEligibility: undefined as
        | Array<Pick<CompletionStatus, 'level' | 'eligible' | 'missingModules' | 'missingChallengeLevels'>>
        | undefined,
    };

    if (tech) {
      const key = techs[0];
      const levels: CertificateLevel[] = [...this.trails.getTrail(key).levels, 'completo'];
      result.certificateEligibility = levels.map((level) => {
        const s = this.getCompletionStatus(userName, key, level);
        return {
          level,
          eligible: s.eligible,
          missingModules: s.missingModules,
          missingChallengeLevels: s.missingChallengeLevels,
        };
      });
    }
    return result;
  }

  getCompletionStatus(userName: string, tech: string, level: CertificateLevel): CompletionStatus {
    const key = this.trails.resolveTech(tech);
    const trail = this.trails.getTrail(key);
    const levels: Level[] = level === 'completo' ? trail.levels : [level];
    if (level !== 'completo' && !trail.levels.includes(level)) {
      throw new ValidationError(`A trilha "${key}" não possui o nível ${level}`);
    }

    const required = this.trails.getModules(key).filter((m) => levels.includes(m.level));
    const id = ProgressService.userIdFor(userName);
    const user = this.store.read().users[id];

    const missingModules = required
      .filter((m) => !user?.modules[m.id])
      .map((m) => ({ id: m.id, name: m.name }));

    const withChallenges = this.challenges.getAvailableLevels(key);
    const passedLevels = new Set<Level>();
    if (user) {
      for (const c of this.challenges.listChallenges({ tech: key })) {
        if (user.challenges[c.id]?.passed) passedLevels.add(c.level);
      }
    }
    const missingChallengeLevels = levels.filter((l) => withChallenges.includes(l) && !passedLevels.has(l));

    return {
      userKnown: Boolean(user),
      tech: key,
      level,
      eligible: Boolean(user) && missingModules.length === 0 && missingChallengeLevels.length === 0,
      modulesCompleted: required.length - missingModules.length,
      modulesRequired: required.length,
      missingModules,
      missingChallengeLevels,
    };
  }

  /** Sugere os próximos módulos (com pré-requisitos atendidos) e um desafio do nível atual. */
  recommendNext(userName?: string, tech?: string): { recommendations: Recommendation[] } {
    const user =
      userName && this.hasUser(userName) ? this.findUser(userName) : undefined;
    const techs = tech
      ? [this.trails.resolveTech(tech)]
      : user
        ? this.techsWithActivity(user)
        : [];
    if (techs.length === 0) {
      throw new ValidationError('Informe uma tecnologia (tech) ou use enroll para iniciar uma trilha');
    }

    const recommendations = techs.map((key): Recommendation => {
      const nextModules = this.availableModules(user, key).slice(0, 3);
      if (nextModules.length === 0) {
        return {
          tech: key,
          status: 'completed',
          nextModules: [],
          tip: 'Trilha concluída! Emita seu certificado com issue_certificate.',
        };
      }

      const currentLevel = nextModules[0].level;
      const done = user
        ? this.challenges.listChallenges({ tech: key }).filter((c) => user.challenges[c.id]?.passed)
        : [];
      let suggestedChallenge: Recommendation['suggestedChallenge'];
      try {
        const pick = this.challenges.pickChallenge(key, currentLevel, { excludeIds: done.map((c) => c.id) });
        if (!pick.repeated) {
          const { id, title, level, estimatedTime } = pick.challenge;
          suggestedChallenge = { id, title, level, estimatedTime };
        }
      } catch {
        /* nível sem desafios: apenas não sugere */
      }
      return {
        tech: key,
        status: 'in_progress',
        nextModules,
        suggestedChallenge,
        tip: `Próximo passo: "${nextModules[0].name}" (~${nextModules[0].hours}h).`,
      };
    });
    return { recommendations };
  }

  // -------------------------------------------------------------------------
  // Auxiliares
  // -------------------------------------------------------------------------

  private techsWithActivity(user: UserRecord): string[] {
    const techs = new Set(Object.keys(user.enrollments));
    for (const id of Object.keys(user.modules)) techs.add(this.trails.getModule(id).tech);
    return this.trails.listTechnologies().filter((t) => techs.has(t));
  }

  /** Módulos ainda não concluídos cujos pré-requisitos já foram cumpridos, na ordem de estudo. */
  private availableModules(user: UserRecord | undefined, tech: string): ModuleBrief[] {
    return this.trails
      .getLearningPath(tech)
      .steps.map((s) => s.module)
      .filter((m) => !user?.modules[m.id] && m.prerequisites.every((p) => user?.modules[p]))
      .map(brief);
  }

  private trailProgress(user: UserRecord, tech: string): TrailProgress {
    const trail = this.trails.getTrail(tech);
    const modules = this.trails.getModules(tech);
    const done = modules.filter((m) => user.modules[m.id]);
    const byLevel: TrailProgress['byLevel'] = {};
    for (const level of LEVELS) {
      const inLevel = modules.filter((m) => m.level === level);
      if (inLevel.length > 0) {
        byLevel[level] = { completed: inLevel.filter((m) => user.modules[m.id]).length, total: inLevel.length };
      }
    }
    return {
      tech,
      title: trail.title,
      targetLevel: user.enrollments[tech]?.level ?? null,
      modulesCompleted: done.length,
      modulesTotal: modules.length,
      percent: Math.round((done.length / modules.length) * 100),
      hoursCompleted: done.reduce((t, m) => t + m.hours, 0),
      hoursTotal: trail.totalHours,
      challengesPassed: this.challenges
        .listChallenges({ tech })
        .filter((c) => user.challenges[c.id]?.passed).length,
      byLevel,
      nextModules: this.availableModules(user, tech).slice(0, 3),
    };
  }

  private summarize(user: UserRecord): UserSummary {
    const today = this.clock().toISOString().slice(0, 10);
    const unlocked = Object.entries(user.achievements);
    return {
      id: user.id,
      name: user.name,
      xp: user.xp,
      rank: rankFor(user.xp),
      streak: computeStreak(user.activityDays, today),
      modulesCompleted: Object.keys(user.modules).length,
      challengesPassed: Object.values(user.challenges).filter((c) => c.passed).length,
      enrolledIn: Object.keys(user.enrollments),
      achievements: unlocked.map(([id, { unlockedAt }]) => {
        const def = ACHIEVEMENT_INDEX.get(id);
        return {
          id,
          title: def?.title ?? id,
          description: def?.description ?? '',
          unlockedAt,
        };
      }),
    };
  }
}

export default new ProgressService();
