import { CertificateLevel } from '../types';

export interface RenderableCertificate {
  id: string;
  userName: string;
  techTitle: string;
  level: CertificateLevel;
  issuedAt: string;
  basis: 'verified' | 'self-declared';
  fingerprint: string;
  timezone: string;
}

const LEVEL_LABEL: Record<CertificateLevel, string> = {
  iniciante: 'Nível Iniciante',
  intermediario: 'Nível Intermediário',
  avancado: 'Nível Avançado',
  completo: 'Trilha Completa',
};

export function levelLabel(level: CertificateLevel): string {
  return LEVEL_LABEL[level];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const basisText = (basis: RenderableCertificate['basis']): string =>
  basis === 'verified'
    ? 'Conclusão verificada pelo progresso registrado na plataforma.'
    : 'Certificado autodeclarado: não há progresso registrado que comprove a conclusão.';

/** Documento HTML autônomo (sem recursos externos) e pronto para impressão em paisagem. Todo texto dinâmico é escapado. */
export function renderHtml(c: RenderableCertificate): string {
  const e = escapeHtml;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Certificado ${e(c.id)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; background: #f3f1ea; font-family: Georgia, 'Times New Roman', serif; color: #1f2937; }
  .frame { box-sizing: border-box; max-width: 1000px; margin: 32px auto; padding: 56px 64px; background: #fffdf8;
           border: 10px double #b08d3c; text-align: center; }
  h1 { margin: 0 0 8px; font-size: 40px; letter-spacing: 4px; text-transform: uppercase; color: #7a5c14; }
  .muted { color: #6b7280; margin: 6px 0; }
  .name { margin: 20px 0; font-size: 44px; border-bottom: 1px solid #b08d3c; display: inline-block; padding: 0 24px 6px; }
  .trail { margin: 8px 0 4px; font-size: 28px; }
  .level { font-size: 18px; letter-spacing: 2px; text-transform: uppercase; color: #7a5c14; }
  .meta { margin-top: 36px; font-size: 13px; color: #4b5563; line-height: 1.7; }
  code { font-family: 'Courier New', monospace; background: #f3f1ea; padding: 2px 6px; border-radius: 4px; }
  @media print { body { background: #fff; } .frame { margin: 0; border-width: 12px; } }
</style>
</head>
<body>
  <main class="frame">
    <h1>Certificado de Conclusão</h1>
    <p class="muted">Certificamos que</p>
    <div class="name">${e(c.userName)}</div>
    <p class="muted">concluiu a trilha</p>
    <p class="trail">${e(c.techTitle)}</p>
    <p class="level">${e(levelLabel(c.level))}</p>
    <div class="meta">
      Emitido em ${e(formatDate(c.issuedAt, c.timezone))}<br>
      Código de verificação: <code>${e(c.id)}</code> &middot; Assinatura: <code>${e(c.fingerprint)}</code><br>
      ${e(basisText(c.basis))}
    </div>
  </main>
</body>
</html>`;
}

const WIDTH = 61;

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const chunks = word.length > width ? word.match(new RegExp(`.{1,${width}}`, 'g')) ?? [word] : [word];
    for (const chunk of chunks) {
      if (line && line.length + 1 + chunk.length > width) {
        lines.push(line);
        line = chunk;
      } else {
        line = line ? `${line} ${chunk}` : chunk;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Versão em texto puro, com quebra de linha para nomes longos. */
export function renderAscii(c: RenderableCertificate): string {
  const inner = WIDTH - 4;
  const center = (t: string): string => {
    const pad = Math.max(0, inner - t.length);
    const left = Math.floor(pad / 2);
    return `| ${' '.repeat(left)}${t}${' '.repeat(pad - left)} |`;
  };
  const rule = `+${'-'.repeat(WIDTH - 2)}+`;
  const body = (t: string): string[] => wrap(t, inner).map(center);

  return [
    '',
    rule,
    center('CERTIFICADO DE CONCLUSÃO'),
    rule,
    center(''),
    center('Certificamos que'),
    ...body(c.userName),
    center(''),
    center('concluiu a trilha'),
    ...body(c.techTitle),
    center(levelLabel(c.level)),
    center(''),
    center(`Emitido em ${formatDate(c.issuedAt, c.timezone)}`),
    center(`ID: ${c.id}`),
    center(`Assinatura: ${c.fingerprint}`),
    center(c.basis === 'verified' ? 'Conclusão verificada' : 'Autodeclarado'),
    rule,
    '',
  ].join('\n');
}
