import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppConfig } from './config';
import { Logger } from './logger';
import { JsonFileStore, MemoryStore, Store } from './storage/store';
import { ChallengeService } from './services/challengeService';
import { CertificateService, CertificateState, emptyCertificateState } from './services/certificateService';
import { ProgressService } from './services/progressService';
import { emptyProgressState, ProgressState } from './services/progressTypes';
import { SearchService } from './services/searchService';
import { TrailService } from './services/trailService';

export interface Services {
  config: AppConfig;
  logger: Logger;
  trails: TrailService;
  challenges: ChallengeService;
  progress: ProgressService;
  certificates: CertificateService;
  search: SearchService;
}

/** Lê (ou cria, com permissão 0600) o segredo usado para assinar certificados. */
function loadOrCreateSecret(dataDir: string): string {
  const file = path.join(dataDir, 'secret.key');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 16) return existing;
  } catch {
    /* ainda não existe */
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const secret = randomBytes(32).toString('hex');
  fs.writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  return secret;
}

/** Monta o grafo de dependências a partir da configuração (persistente ou em memória). */
export function createServices(config: AppConfig, logger: Logger): Services {
  const { dataDir } = config;

  const progressStore: Store<ProgressState> = dataDir
    ? new JsonFileStore(path.join(dataDir, 'progress.json'), emptyProgressState, logger)
    : new MemoryStore(emptyProgressState());
  const certificateStore: Store<CertificateState> = dataDir
    ? new JsonFileStore(path.join(dataDir, 'certificates.json'), emptyCertificateState, logger)
    : new MemoryStore(emptyCertificateState());

  const trails = new TrailService();
  const challenges = new ChallengeService({ trails, passScore: config.passScore });
  const progress = new ProgressService({ store: progressStore, trails, challenges });
  const certificates = new CertificateService({
    store: certificateStore,
    trails,
    progress,
    secret: config.certSecret ?? (dataDir ? loadOrCreateSecret(dataDir) : undefined),
    strict: config.strictCertificates,
    timezone: config.timezone,
    outputDir: dataDir ? path.join(dataDir, 'certificates') : null,
    logger,
  });
  const search = new SearchService(trails, challenges);

  logger.info('serviços inicializados', {
    persistence: dataDir ?? 'memória',
    strictCertificates: config.strictCertificates,
  });
  return { config, logger, trails, challenges, progress, certificates, search };
}
