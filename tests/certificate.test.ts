import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CertificateService, CertificateState, emptyCertificateState } from '../src/services/certificateService';
import { MemoryStore } from '../src/storage/store';
import { completeUpTo, makeServices, passChallenges, SECRET } from './helpers';

describe('CertificateService', () => {
  test('deve emitir certificado válido', () => {
    const { certificates } = makeServices();
    const result = certificates.issueCertificate('João Silva', 'java', 'completo');
    expect(result.certificate.userName).toBe('João Silva');
    expect(result.certificate.tech).toBe('java');
    expect(result.certificate.level).toBe('completo');
    expect(result.certificate.valid).toBe(true);
    expect(result.certificate.id).toMatch(/^GEO-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(result.message).toContain('emitido com sucesso');
    expect(result.alreadyIssued).toBe(false);
  });

  test('deve lançar erro para nome muito curto', () => {
    const { certificates } = makeServices();
    expect(() => certificates.issueCertificate('Jo', 'node')).toThrow('Nome do usuário deve ter pelo menos 3 caracteres');
  });

  test('não emite certificado para trilha ou nível inexistente', () => {
    const { certificates } = makeServices();
    expect(() => certificates.issueCertificate('Maria Santos', 'cobol')).toThrow('Trilha não encontrada');
    expect(() => certificates.issueCertificate('Maria Santos', 'java', 'mestre')).toThrow('Nível inválido');
  });

  test('é idempotente: mesmo usuário/trilha/nível não gera duplicata', () => {
    const { certificates } = makeServices();
    const a = certificates.issueCertificate('Maria Santos', 'react');
    const b = certificates.issueCertificate('maria santos', 'React');
    expect(b.alreadyIssued).toBe(true);
    expect(b.certificate.id).toBe(a.certificate.id);
    expect(certificates.listCertificates().length).toBe(1);
  });

  test('deve verificar certificado válido', () => {
    const { certificates } = makeServices();
    const issued = certificates.issueCertificate('Maria Santos', 'react');
    const cert = certificates.verifyCertificate(issued.certificate.id);
    expect(cert.valid).toBe(true);
    expect(certificates.verify(issued.certificate.id.toLowerCase()).status).toBe('valid');
  });

  test('verify informa não encontrado sem lançar; verifyCertificate lança', () => {
    const { certificates } = makeServices();
    expect(certificates.verify('INVALIDO-123').status).toBe('not_found');
    expect(() => certificates.verifyCertificate('INVALIDO-123')).toThrow('Certificado não encontrado');
  });

  test('certificado revogado deixa de ser válido (bug antigo: sempre retornava valid=true)', () => {
    const { certificates } = makeServices();
    const issued = certificates.issueCertificate('Pedro Lima', 'python');
    expect(certificates.revokeCertificate(issued.certificate.id, 'fraude').success).toBe(true);

    const result = certificates.verify(issued.certificate.id);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('revoked');
    expect(result.message).toContain('fraude');
    expect(certificates.verifyCertificate(issued.certificate.id).valid).toBe(false);
    expect(certificates.revokeCertificate(issued.certificate.id).message).toContain('já estava revogado');
  });

  test('após revogação é possível emitir um novo certificado', () => {
    const { certificates } = makeServices();
    const first = certificates.issueCertificate('Pedro Lima', 'python');
    certificates.revokeCertificate(first.certificate.id);
    const second = certificates.issueCertificate('Pedro Lima', 'python');
    expect(second.alreadyIssued).toBe(false);
    expect(second.certificate.id === first.certificate.id).toBe(false);
  });

  test('detecta adulteração do registro (assinatura HMAC)', () => {
    const store = new MemoryStore<CertificateState>(emptyCertificateState());
    const svc = new CertificateService({ store, secret: SECRET });
    const id = svc.issueCertificate('Ana Costa', 'node').certificate.id;

    store.update((state) => {
      state.certificates[id].level = 'avancado';
    });
    const result = svc.verify(id);
    expect(result.status).toBe('tampered');
    expect(result.valid).toBe(false);
  });

  test('assinatura não confere com outro segredo', () => {
    const store = new MemoryStore<CertificateState>(emptyCertificateState());
    const id = new CertificateService({ store, secret: SECRET }).issueCertificate('Ana Costa', 'node').certificate.id;
    expect(new CertificateService({ store, secret: 'outro-segredo-1234567' }).verify(id).status).toBe('tampered');
  });

  test('deve listar com filtros', () => {
    const { certificates } = makeServices();
    certificates.issueCertificate('Ana Costa', 'node');
    const b = certificates.issueCertificate('Bruno Alves', 'java');
    certificates.revokeCertificate(b.certificate.id);
    expect(certificates.listCertificates().length).toBe(2);
    expect(certificates.listCertificates({ userName: 'ana costa' }).length).toBe(1);
    expect(certificates.listCertificates({ tech: 'java', includeRevoked: false }).length).toBe(0);
  });

  test('HTML e ASCII são gerados e o HTML escapa o nome (anti-XSS)', () => {
    const { certificates } = makeServices();
    const result = certificates.issueCertificate('<script>alert(1)</script> Eve', 'node');
    expect(result.htmlContent).toContain('<html');
    expect(result.htmlContent).toContain('&lt;script&gt;');
    expect(result.htmlContent.includes('<script>')).toBe(false);
    expect(result.asciiArt).toContain('CERTIFICADO');
  });

  test('ASCII quebra nomes longos sem estourar a moldura', () => {
    const { certificates } = makeServices();
    const long = 'Maria da Conceição Aparecida de Albuquerque e Vasconcelos Figueiredo Neto';
    const lines = certificates.issueCertificate(long, 'node').asciiArt.split('\n').filter((l) => l.startsWith('|'));
    expect(lines.every((l) => l.length === 61)).toBe(true);
  });

  test('grava o HTML em disco quando há diretório de saída', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-cert-'));
    try {
      const svc = new CertificateService({ secret: SECRET, outputDir: dir });
      const result = svc.issueCertificate('Ana Costa', 'node');
      expect(result.filePath).toBe(path.join(dir, `${result.certificate.id}.html`));
      expect(fs.readFileSync(result.filePath as string, 'utf8')).toContain(result.certificate.id);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('sem progresso comprovado o certificado é autodeclarado', () => {
    const { certificates } = makeServices();
    expect(certificates.issueCertificate('Ana Costa', 'node').certificate.basis).toBe('self-declared');
  });

  test('com conclusão comprovada pelo progresso o certificado é verified', () => {
    const s = makeServices();
    completeUpTo(s, 'Ana Costa', 'typescript');
    passChallenges(s, 'Ana Costa', 'typescript', ['iniciante', 'intermediario', 'avancado']);
    const issued = s.certificates.issueCertificate('Ana Costa', 'typescript');
    expect(issued.certificate.basis).toBe('verified');
    expect(s.certificates.verify(issued.certificate.id).message).toContain('comprovada');
  });

  test('certificado por nível exige apenas os módulos e o desafio daquele nível', () => {
    const s = makeServices();
    completeUpTo(s, 'Ana Costa', 'java', 'iniciante');
    expect(s.certificates.issueCertificate('Ana Costa', 'java', 'iniciante').certificate.basis).toBe('self-declared');
    passChallenges(s, 'Ana Costa', 'java', ['iniciante']);
    expect(s.certificates.issueCertificate('Ana Costa', 'java', 'Iniciante').alreadyIssued).toBe(true);
    s.certificates.revokeCertificate(s.certificates.listCertificates()[0].id);
    expect(s.certificates.issueCertificate('Ana Costa', 'java', 'iniciante').certificate.basis).toBe('verified');
  });

  test('modo estrito recusa certificado sem conclusão e lista o que falta', () => {
    const s = makeServices({ strict: true });
    expect(() => s.certificates.issueCertificate('Ana Costa', 'devops')).toThrow('nenhum progresso registrado');
    s.progress.enroll('Ana Costa', 'devops');
    expect(() => s.certificates.issueCertificate('Ana Costa', 'devops')).toThrow('módulos pendentes');
  });

  test('modo estrito emite quando a conclusão é comprovada', () => {
    const s = makeServices({ strict: true });
    completeUpTo(s, 'Ana Costa', 'devops');
    passChallenges(s, 'Ana Costa', 'devops', ['iniciante', 'intermediario', 'avancado']);
    expect(s.certificates.issueCertificate('Ana Costa', 'devops').certificate.basis).toBe('verified');
  });

  test('deleteByUser remove apenas os certificados da pessoa', () => {
    const { certificates } = makeServices();
    certificates.issueCertificate('Ana Costa', 'node');
    certificates.issueCertificate('Ana Costa', 'java');
    certificates.issueCertificate('Bruno Alves', 'java');
    expect(certificates.deleteByUser('ana costa')).toBe(2);
    expect(certificates.listCertificates().length).toBe(1);
  });
});
