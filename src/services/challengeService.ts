import challengesData from '../data/challenges.json';
import { GeoError, NotFoundError, ValidationError } from '../errors';
import { Difficulty, DIFFICULTY_BY_LEVEL, Level, LEVELS } from '../types';
import { suggestionSuffix, tryParseLevel } from '../validation';
import trailService, { TrailService } from './trailService';

export interface RawChallenge {
  id: string;
  tech: string;
  level: Level;
  title: string;
  description: string;
  requirements: string[];
  estimatedTime: string;
  hints: string[];
  tags: string[];
  moduleIds: string[];
}

export interface Challenge extends RawChallenge {
  difficulty: Difficulty;
  /** XP base concedido por uma aprovação com nota 100 e sem dicas. */
  xp: number;
}

export interface ChallengeEvaluation {
  challengeId: string;
  /** 0-100: percentual dos requisitos atendidos. */
  score: number;
  passed: boolean;
  passScore: number;
  requirementsMet: number;
  requirementsTotal: number;
  unmet: string[];
  hintsUsed: number;
  /** XP que esta avaliação vale (antes de regras de repetição do ProgressService). */
  xp: number;
}

export interface PickOptions {
  /** IDs já concluídos, evitados enquanto houver alternativa. */
  excludeIds?: string[];
}

export interface PickResult {
  challenge: Challenge;
  /** true quando todas as opções já tinham sido concluídas e uma foi repetida. */
  repeated: boolean;
}

export interface ChallengeServiceOptions {
  challenges?: RawChallenge[];
  trails?: TrailService;
  rng?: () => number;
  passScore?: number;
}

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 50, medium: 100, hard: 200 };

export class ChallengeService {
  private readonly challenges: Challenge[];
  private readonly trails: TrailService;
  private readonly rng: () => number;
  private readonly passScore: number;

  constructor(options: ChallengeServiceOptions = {}) {
    this.trails = options.trails ?? trailService;
    this.rng = options.rng ?? Math.random;
    this.passScore = options.passScore ?? 70;
    const raw = options.challenges ?? (challengesData as unknown as RawChallenge[]);
    this.validate(raw);
    this.challenges = raw.map((c) => {
      const difficulty = DIFFICULTY_BY_LEVEL[c.level];
      return { ...c, difficulty, xp: XP_BY_DIFFICULTY[difficulty] };
    });
  }

  private validate(raw: RawChallenge[]): void {
    const seen = new Set<string>();
    for (const c of raw) {
      const fail = (m: string): never => {
        throw new GeoError('INTERNAL', `Desafio inválido "${c.id}": ${m}`);
      };
      if (seen.has(c.id)) fail('id duplicado');
      seen.add(c.id);
      if (!this.trails.tryResolveTech(c.tech)) fail(`tecnologia desconhecida "${c.tech}"`);
      if (!LEVELS.includes(c.level)) fail('nível inválido');
      if (c.requirements.length === 0) fail('sem requisitos');
      for (const id of c.moduleIds) {
        const mod = this.trails.getModule(id);
        if (mod.tech !== c.tech) fail(`módulo "${id}" pertence a outra trilha`);
      }
    }
  }

  /** Sorteia um desafio da tecnologia/nível, evitando os já concluídos quando possível. */
  pickChallenge(tech: string, level: string, options: PickOptions = {}): PickResult {
    const key = this.trails.tryResolveTech(tech);
    if (!key) throw new NotFoundError(`Tecnologia não suportada: ${tech}`);

    const parsed = tryParseLevel(level);
    const pool = parsed ? this.challenges.filter((c) => c.tech === key && c.level === parsed) : [];
    if (pool.length === 0) {
      throw new NotFoundError(`Nível não encontrado para ${tech}: ${level}`, {
        availableLevels: this.getAvailableLevels(key),
      });
    }

    const exclude = new Set(options.excludeIds ?? []);
    const fresh = pool.filter((c) => !exclude.has(c.id));
    const candidates = fresh.length > 0 ? fresh : pool;
    const challenge = candidates[Math.floor(this.rng() * candidates.length)];
    return { challenge: { ...challenge }, repeated: fresh.length === 0 };
  }

  generateChallenge(tech: string, level: string, options: PickOptions = {}): Challenge {
    return this.pickChallenge(tech, level, options).challenge;
  }

  /** Até `count` desafios distintos, em ordem aleatória. */
  generateMultipleChallenges(tech: string, level: string, count: number = 3): Challenge[] {
    const key = this.trails.tryResolveTech(tech);
    const parsed = tryParseLevel(level);
    const pool = this.challenges.filter((c) => c.tech === key && c.level === parsed);
    if (pool.length === 0) {
      throw new NotFoundError(`Nenhum desafio disponível para ${tech} no nível ${level}`);
    }
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.max(0, count)).map((c) => ({ ...c }));
  }

  getChallenge(id: string): Challenge {
    const found = this.challenges.find((c) => c.id === id.trim());
    if (!found) {
      throw new NotFoundError(
        `Desafio não encontrado: ${id}.` + suggestionSuffix(id, this.challenges.map((c) => c.id))
      );
    }
    return { ...found };
  }

  listChallenges(filter: { tech?: string; level?: string } = {}): Challenge[] {
    const tech = filter.tech ? this.trails.resolveTech(filter.tech) : undefined;
    const level = filter.level ? tryParseLevel(filter.level) : undefined;
    return this.challenges
      .filter((c) => (!tech || c.tech === tech) && (!level || c.level === level))
      .map((c) => ({ ...c }));
  }

  /** Níveis que possuem ao menos um desafio (lista vazia para tecnologia desconhecida). */
  getAvailableLevels(tech: string): Level[] {
    const key = this.trails.tryResolveTech(tech);
    if (!key) return [];
    const present = new Set(this.challenges.filter((c) => c.tech === key).map((c) => c.level));
    return LEVELS.filter((l) => present.has(l));
  }

  /**
   * Avalia uma entrega a partir de quais requisitos foram atendidos.
   * Quem avalia o código (o assistente de IA ou um revisor) informa `met` na mesma ordem de `requirements`.
   */
  evaluate(challengeId: string, met: boolean[], hintsUsed: number = 0): ChallengeEvaluation {
    const challenge = this.getChallenge(challengeId);
    if (met.length !== challenge.requirements.length) {
      throw new ValidationError(
        `"requirementsMet" deve ter ${challenge.requirements.length} itens (um por requisito), mas recebeu ${met.length}`,
        { requirements: challenge.requirements }
      );
    }
    if (!Number.isInteger(hintsUsed) || hintsUsed < 0) {
      throw new ValidationError('"hintsUsed" deve ser um inteiro maior ou igual a zero');
    }

    const requirementsMet = met.filter(Boolean).length;
    const score = Math.round((requirementsMet / met.length) * 100);
    const passed = score >= this.passScore;
    const hintFactor = Math.max(0.5, 1 - 0.1 * hintsUsed);

    return {
      challengeId: challenge.id,
      score,
      passed,
      passScore: this.passScore,
      requirementsMet,
      requirementsTotal: met.length,
      unmet: challenge.requirements.filter((_, i) => !met[i]),
      hintsUsed,
      xp: passed ? Math.round(challenge.xp * (score / 100) * hintFactor) : 0,
    };
  }
}

export default new ChallengeService();
