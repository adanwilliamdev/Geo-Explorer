import { loadConfig } from '../src/config';
import { Services } from '../src/container';
import { silentLogger } from '../src/logger';
import { CertificateService } from '../src/services/certificateService';
import { ChallengeService } from '../src/services/challengeService';
import { ProgressService } from '../src/services/progressService';
import { SearchService } from '../src/services/searchService';
import { TrailService } from '../src/services/trailService';
import { Level, LEVELS } from '../src/types';

export const SECRET = 'test-secret-0123456789';

export interface TestServices extends Services {
  clockState: { now: Date };
}

/** Serviços 100% em memória, com relógio controlável e sorteio determinístico. */
export function makeServices(options: { strict?: boolean } = {}): TestServices {
  const clockState = { now: new Date('2026-01-10T12:00:00Z') };
  const clock = () => new Date(clockState.now);
  const trails = new TrailService();
  const challenges = new ChallengeService({ trails, rng: () => 0, passScore: 70 });
  const progress = new ProgressService({ trails, challenges, clock });
  const certificates = new CertificateService({
    trails,
    progress,
    secret: SECRET,
    strict: options.strict ?? false,
    clock,
  });
  const search = new SearchService(trails, challenges);
  const config = loadConfig({ GEO_DATA_DIR: ':memory:', GEO_LOG_LEVEL: 'silent' });
  return { config, logger: silentLogger, trails, challenges, progress, certificates, search, clockState };
}

/** Conclui módulos na ordem de estudo até o nível informado (inclusive). */
export function completeUpTo(s: Services, user: string, tech: string, upTo: Level = 'avancado'): void {
  const max = LEVELS.indexOf(upTo);
  for (const step of s.trails.getLearningPath(tech).steps) {
    if (LEVELS.indexOf(step.module.level) <= max) s.progress.completeModule(user, step.module.id);
  }
}

/** Aprova um desafio de cada nível pedido (todos os requisitos atendidos). */
export function passChallenges(s: Services, user: string, tech: string, levels: Level[]): void {
  for (const level of levels) {
    const { challenge } = s.challenges.pickChallenge(tech, level);
    const evaluation = s.challenges.evaluate(challenge.id, challenge.requirements.map(() => true));
    s.progress.recordChallengeResult(user, evaluation);
  }
}
