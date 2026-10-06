import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NotFoundError, PreconditionError, ValidationError } from '../errors';
import { Logger, silentLogger } from '../logger';
import { MemoryStore, Store } from '../storage/store';
import { CertificateLevel, Clock, systemClock } from '../types';
import { parseCertificateLevel } from '../validation';
import { renderAscii, renderHtml, RenderableCertificate } from './certificateRender';
import { ProgressService } from './progressService';
import trailServiceDefault, { TrailService } from './trailService';

export type CertificateBasis = 'verified' | 'self-declared';
export type VerificationStatus = 'valid' | 'revoked' | 'tampered' | 'not_found';

export interface Certificate {
  id: string;
  userName: string;
  userId: string;
  tech: string;
  level: CertificateLevel;
  issuedAt: string;
  /** false após revogação ou se a assinatura não confere. */
  valid: boolean;
  /** "verified": o progresso registrado comprova a conclusão. "self-declared": não há comprovação. */
  basis: CertificateBasis;
  /** HMAC-SHA256 dos campos imutáveis; impede adulteração do arquivo de dados. */
  signature: string;
  revokedAt?: string;
  revokedReason?: string;
}

export interface CertificateState {
  version: 1;
  certificates: Record<string, Certificate>;
}

export const emptyCertificateState = (): CertificateState => ({ version: 1, certificates: {} });

export interface IssueCertificateResult {
  certificate: Certificate;
  message: string;
  alreadyIssued: boolean;
  htmlContent: string;
  asciiArt: string;
  /** Caminho do HTML gravado em disco (quando há diretório de dados). */
  filePath?: string;
}

export interface VerificationResult {
  valid: boolean;
  status: VerificationStatus;
  message: string;
  certificate?: Certificate;
}

export interface RevokeCertificateResult {
  success: boolean;
  message: string;
}

export interface CertificateServiceDeps {
  store?: Store<CertificateState>;
  trails?: TrailService;
  /** Quando informado, habilita a verificação de conclusão pelo progresso do usuário. */
  progress?: ProgressService | null;
  secret?: string;
  /** Se true, recusa certificados sem conclusão comprovada. */
  strict?: boolean;
  clock?: Clock;
  timezone?: string;
  /** Pasta onde gravar o HTML de cada certificado emitido. */
  outputDir?: string | null;
  logger?: Logger;
}

const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: sem I, L, O, U

export class CertificateService {
  private readonly store: Store<CertificateState>;
  private readonly trails: TrailService;
  private readonly progress: ProgressService | null;
  private readonly secret: string;
  private readonly strict: boolean;
  private readonly clock: Clock;
  private readonly timezone: string;
  private readonly outputDir: string | null;
  private readonly logger: Logger;

  constructor(deps: CertificateServiceDeps = {}) {
    this.store = deps.store ?? new MemoryStore<CertificateState>(emptyCertificateState());
    this.trails = deps.trails ?? trailServiceDefault;
    this.progress = deps.progress ?? null;
    this.secret = deps.secret ?? randomBytes(32).toString('hex');
    this.strict = deps.strict ?? false;
    this.clock = deps.clock ?? systemClock;
    this.timezone = deps.timezone ?? 'America/Sao_Paulo';
    this.outputDir = deps.outputDir ?? null;
    this.logger = deps.logger ?? silentLogger;
  }

  /**
   * Emite um certificado de conclusão (idempotente: o mesmo usuário/trilha/nível não gera duplicatas).
   * @param level - nível concluído (padrão: 'completo', a trilha inteira)
   */
  issueCertificate(userName: string, tech: string, level: string = 'completo'): IssueCertificateResult {
    const name = userName.trim();
    if (name.length < 3) throw new ValidationError('Nome do usuário deve ter pelo menos 3 caracteres');

    const techKey = this.trails.resolveTech(tech);
    const trail = this.trails.getTrail(techKey);
    const parsedLevel = parseCertificateLevel(level);
    if (parsedLevel !== 'completo' && !trail.levels.includes(parsedLevel)) {
      throw new ValidationError(
        `A trilha "${techKey}" não possui o nível ${parsedLevel}. Níveis: ${trail.levels.join(', ')}`
      );
    }

    const userId = ProgressService.userIdFor(name);

    const existing = Object.values(this.store.read().certificates).find(
      (c) => c.valid && c.userId === userId && c.tech === techKey && c.level === parsedLevel
    );
    if (existing) {
      return this.buildResult(existing, trail.title, true);
    }

    const basis = this.resolveBasis(name, techKey, parsedLevel);

    const issued = this.store.update((state) => {
      const id = this.generateId(state);
      const base = { id, userId, tech: techKey, level: parsedLevel, issuedAt: this.clock().toISOString(), basis };
      const certificate: Certificate = {
        ...base,
        userName: name,
        valid: true,
        signature: this.sign(base),
      };
      state.certificates[id] = certificate;
      return certificate;
    });

    return this.buildResult(issued, trail.title, false);
  }

  /** Verificação completa: informa também revogação e adulteração, sem lançar para "não encontrado". */
  verify(certificateId: string): VerificationResult {
    const id = certificateId.trim().toUpperCase();
    const certificate = this.store.read().certificates[id];
    if (!certificate) {
      return { valid: false, status: 'not_found', message: 'Certificado não encontrado' };
    }
    if (!this.signatureMatches(certificate)) {
      return {
        valid: false,
        status: 'tampered',
        message: 'A assinatura não confere: o registro foi alterado após a emissão',
        certificate: { ...certificate, valid: false },
      };
    }
    if (!certificate.valid) {
      return {
        valid: false,
        status: 'revoked',
        message: `Certificado revogado${certificate.revokedReason ? `: ${certificate.revokedReason}` : ''}`,
        certificate: { ...certificate },
      };
    }
    return {
      valid: true,
      status: 'valid',
      message:
        certificate.basis === 'verified'
          ? 'Certificado autêntico, com conclusão comprovada pelo progresso'
          : 'Certificado autêntico, porém autodeclarado (sem progresso que comprove a conclusão)',
      certificate: { ...certificate },
    };
  }

  /** Retorna o certificado (com `valid` refletindo revogação/adulteração) ou lança se não existir. */
  verifyCertificate(certificateId: string): Certificate {
    const result = this.verify(certificateId);
    if (!result.certificate) throw new NotFoundError('Certificado não encontrado');
    return result.certificate;
  }

  revokeCertificate(certificateId: string, reason?: string): RevokeCertificateResult {
    const id = certificateId.trim().toUpperCase();
    return this.store.update((state) => {
      const certificate = state.certificates[id];
      if (!certificate) throw new NotFoundError('Certificado não encontrado');
      if (!certificate.valid) {
        return { success: true, message: `Certificado ${id} já estava revogado` };
      }
      certificate.valid = false;
      certificate.revokedAt = this.clock().toISOString();
      if (reason) certificate.revokedReason = reason;
      return { success: true, message: `Certificado ${id} revogado com sucesso` };
    });
  }

  listCertificates(filter: { userName?: string; tech?: string; includeRevoked?: boolean } = {}): Certificate[] {
    const userId = filter.userName ? ProgressService.userIdFor(filter.userName) : undefined;
    const tech = filter.tech ? this.trails.resolveTech(filter.tech) : undefined;
    return Object.values(this.store.read().certificates)
      .filter(
        (c) =>
          (!userId || c.userId === userId) &&
          (!tech || c.tech === tech) &&
          (filter.includeRevoked !== false || c.valid)
      )
      .map((c) => ({ ...c }));
  }

  /** Apaga todos os certificados do usuário (direito de exclusão). Retorna quantos foram removidos. */
  deleteByUser(userName: string): number {
    const userId = ProgressService.userIdFor(userName);
    return this.store.update((state) => {
      const ids = Object.keys(state.certificates).filter((id) => state.certificates[id].userId === userId);
      for (const id of ids) delete state.certificates[id];
      return ids.length;
    });
  }

  // -------------------------------------------------------------------------

  private resolveBasis(userName: string, tech: string, level: CertificateLevel): CertificateBasis {
    if (this.progress) {
      const status = this.progress.getCompletionStatus(userName, tech, level);
      if (status.eligible) return 'verified';
      if (this.strict) {
        const parts: string[] = [];
        if (!status.userKnown) parts.push('nenhum progresso registrado para este usuário');
        if (status.missingModules.length > 0) {
          parts.push(`módulos pendentes: ${status.missingModules.map((m) => m.name).join(', ')}`);
        }
        if (status.missingChallengeLevels.length > 0) {
          parts.push(`desafio pendente nos níveis: ${status.missingChallengeLevels.join(', ')}`);
        }
        throw new PreconditionError(`Requisitos do certificado não cumpridos (${parts.join('; ')})`, {
          missingModules: status.missingModules,
          missingChallengeLevels: status.missingChallengeLevels,
        });
      }
    } else if (this.strict) {
      throw new PreconditionError('Modo estrito exige o serviço de progresso configurado');
    }
    return 'self-declared';
  }

  private generateId(state: CertificateState): string {
    for (;;) {
      const bytes = randomBytes(12);
      const chars = Array.from(bytes as ArrayLike<number>, (b: number) => ID_ALPHABET[b % 32]);
      const id = `GEO-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
      if (!state.certificates[id]) return id;
    }
  }

  private canonical(c: Pick<Certificate, 'id' | 'userId' | 'tech' | 'level' | 'issuedAt' | 'basis'>): string {
    return [c.id, c.userId, c.tech, c.level, c.issuedAt, c.basis].join('|');
  }

  private sign(c: Pick<Certificate, 'id' | 'userId' | 'tech' | 'level' | 'issuedAt' | 'basis'>): string {
    return createHmac('sha256', this.secret).update(this.canonical(c)).digest('hex');
  }

  private signatureMatches(c: Certificate): boolean {
    const expected = Buffer.from(this.sign(c), 'hex');
    const actual = Buffer.from(String(c.signature), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private buildResult(certificate: Certificate, techTitle: string, alreadyIssued: boolean): IssueCertificateResult {
    const renderable: RenderableCertificate = {
      id: certificate.id,
      userName: certificate.userName,
      techTitle,
      level: certificate.level,
      issuedAt: certificate.issuedAt,
      basis: certificate.basis,
      fingerprint: certificate.signature.slice(0, 16),
      timezone: this.timezone,
    };
    const htmlContent = renderHtml(renderable);
    return {
      certificate: { ...certificate },
      message: alreadyIssued
        ? `Certificado já emitido anteriormente para ${certificate.userName}`
        : `Certificado emitido com sucesso para ${certificate.userName}!`,
      alreadyIssued,
      htmlContent,
      asciiArt: renderAscii(renderable),
      filePath: this.writeHtml(certificate.id, htmlContent),
    };
  }

  private writeHtml(id: string, html: string): string | undefined {
    if (!this.outputDir) return undefined;
    try {
      fs.mkdirSync(this.outputDir, { recursive: true });
      const file = path.join(this.outputDir, `${id}.html`);
      fs.writeFileSync(file, html, 'utf8');
      return file;
    } catch (error) {
      this.logger.warn('não foi possível gravar o HTML do certificado', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }
}

export default new CertificateService();
