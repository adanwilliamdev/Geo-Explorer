import trailService from './trailService';

export interface Certificate {
  id: string;
  userName: string;
  tech: string;
  level: string;
  issuedAt: string;
  valid: boolean;
}

export interface IssueCertificateResult {
  certificate: Certificate;
  message: string;
  htmlContent: string;
  asciiArt: string;
}

export interface RevokeCertificateResult {
  success: boolean;
  message: string;
}

export class CertificateService {
  private certificates: Map<string, Certificate> = new Map();

  /**
   * Emite um novo certificado de conclusão
   * @param userName - Nome do usuário que receberá o certificado
   * @param tech - Tecnologia concluída
   * @param level - Nível concluído (padrão: 'completo')
   */
  issueCertificate(
    userName: string,
    tech: string,
    level: string = 'completo'
  ): IssueCertificateResult {
    const normalizedName = userName.trim();

    if (normalizedName.length < 3) {
      throw new Error('Nome do usuário deve ter pelo menos 3 caracteres');
    }

    const normalizedTech = tech.toLowerCase().trim();
    let techTitle = normalizedTech;

    try {
      techTitle = trailService.getTrail(normalizedTech).title;
    } catch {
      // Se a trilha não for encontrada, mantém o nome da tecnologia
      techTitle = normalizedTech;
    }

    const id = this.generateCertificateId();
    const issuedAt = new Date().toISOString();

    const certificate: Certificate = {
      id,
      userName: normalizedName,
      tech: normalizedTech,
      level,
      issuedAt,
      valid: true,
    };

    this.certificates.set(id, certificate);

    return {
      certificate,
      message: `Certificado emitido com sucesso para ${normalizedName}!`,
      htmlContent: this.generateHtmlCertificate(certificate, techTitle),
      asciiArt: this.generateAsciiCertificate(certificate, techTitle),
    };
  }

  /**
   * Verifica a autenticidade de um certificado pelo ID
   */
  verifyCertificate(certificateId: string): Certificate {
    const certificate = this.certificates.get(certificateId);

    if (!certificate) {
      throw new Error('Certificado não encontrado');
    }

    return certificate;
  }

  /**
   * Revoga um certificado emitido
   */
  revokeCertificate(certificateId: string): RevokeCertificateResult {
    const certificate = this.certificates.get(certificateId);

    if (!certificate) {
      throw new Error('Certificado não encontrado');
    }

    certificate.valid = false;
    this.certificates.set(certificateId, certificate);

    return {
      success: true,
      message: `Certificado ${certificateId} revogado com sucesso`,
    };
  }

  /**
   * Lista todos os certificados emitidos
   */
  listCertificates(): Certificate[] {
    return Array.from(this.certificates.values());
  }

  /**
   * Gera um ID único para o certificado no formato GEO-XXXXXXXX
   */
  private generateCertificateId(): string {
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    return `GEO-${timestamp}-${random}`;
  }

  /**
   * Gera uma representação HTML do certificado
   */
  private generateHtmlCertificate(certificate: Certificate, techTitle: string): string {
    return `<html>
  <head><title>Certificado - ${certificate.id}</title></head>
  <body style="text-align:center; font-family: Arial, sans-serif; padding: 40px;">
    <h1>Certificado de Conclusão</h1>
    <p>Certificamos que</p>
    <h2>${certificate.userName}</h2>
    <p>concluiu a trilha</p>
    <h3>${techTitle}</h3>
    <p>Nível: ${certificate.level}</p>
    <p>Emitido em: ${new Date(certificate.issuedAt).toLocaleDateString('pt-BR')}</p>
    <p>ID do certificado: ${certificate.id}</p>
  </body>
</html>`;
  }

  /**
   * Gera uma representação em arte ASCII do certificado
   */
  private generateAsciiCertificate(certificate: Certificate, techTitle: string): string {
    return `
=============================================
              CERTIFICADO
=============================================
  Certificamos que

  ${certificate.userName}

  concluiu a trilha de ${techTitle}
  Nível: ${certificate.level}

  ID: ${certificate.id}
  Data: ${new Date(certificate.issuedAt).toLocaleDateString('pt-BR')}
=============================================
`;
  }
}

export default new CertificateService();
