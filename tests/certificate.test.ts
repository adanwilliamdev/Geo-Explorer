import certificateService from '../src/services/certificateService';

describe('CertificateService', () => {
  test('deve emitir certificado válido', () => {
    const result = certificateService.issueCertificate('João Silva', 'java', 'completo');
    expect(result.certificate).toBeDefined();
    expect(result.certificate.userName).toBe('João Silva');
    expect(result.certificate.tech).toBe('java');
    expect(result.certificate.level).toBe('completo');
    expect(result.certificate.valid).toBe(true);
    expect(result.certificate.id).toContain('GEO-');
    expect(result.message).toContain('emitido com sucesso');
  });

  test('deve lançar erro para nome muito curto', () => {
    expect(() => {
      certificateService.issueCertificate('Jo', 'node');
    }).toThrow('Nome do usuário deve ter pelo menos 3 caracteres');
  });

  test('deve verificar certificado válido', () => {
    const result = certificateService.issueCertificate('Maria Santos', 'react');
    const cert = certificateService.verifyCertificate(result.certificate.id);
    expect(cert.valid).toBe(true);
    expect(cert.id).toBe(result.certificate.id);
  });

  test('deve lançar erro ao verificar certificado inexistente', () => {
    expect(() => {
      certificateService.verifyCertificate('INVALIDO-123');
    }).toThrow('Certificado não encontrado');
  });

  test('deve revogar certificado', () => {
    const result = certificateService.issueCertificate('Pedro Lima', 'python');
    const revokeResult = certificateService.revokeCertificate(result.certificate.id);
    expect(revokeResult.success).toBe(true);
    
    const cert = certificateService.verifyCertificate(result.certificate.id);
    expect(cert.valid).toBe(false);
  });

  test('deve listar certificados emitidos', () => {
    const certs = certificateService.listCertificates();
    expect(Array.isArray(certs)).toBe(true);
    expect(certs.length).toBeGreaterThan(0);
  });

  test('deve gerar HTML e ASCII do certificado', () => {
    const result = certificateService.issueCertificate('Ana Costa', 'node');
    expect(result.htmlContent).toBeDefined();
    expect(result.htmlContent).toContain('<html>');
    expect(result.asciiArt).toBeDefined();
    expect(result.asciiArt).toContain('CERTIFICADO');
  });
});
