import { CliIo, runCli } from '../src/index';
import { VERSION } from '../src/version';
import { makeServices } from './helpers';

function makeIo() {
  const services = makeServices();
  const out: string[] = [];
  const err: string[] = [];
  let started = 0;
  const io: CliIo = {
    stdout: (t) => { out.push(t); },
    stderr: (t) => { err.push(t); },
    createServices: () => services,
    startServer: async () => { started += 1; },
  };
  return { io, out, err, services, started: () => started };
}

describe('CLI', () => {
  test('--version e --help', async () => {
    const a = makeIo();
    expect(await runCli(['--version'], a.io)).toBe(0);
    expect(a.out.join('')).toBe(`${VERSION}\n`);
    const b = makeIo();
    expect(await runCli(['--help'], b.io)).toBe(0);
    expect(b.out.join('')).toContain('GEO_DATA_DIR');
  });

  test('sem argumentos inicia o servidor e não escreve nada no stdout', async () => {
    const a = makeIo();
    expect(await runCli([], a.io)).toBe(null);
    expect(a.started()).toBe(1);
    expect(a.out.length).toBe(0);
  });

  test('verify retorna 0 para certificado válido e 1 para inexistente', async () => {
    const a = makeIo();
    const id = a.services.certificates.issueCertificate('Ana Costa', 'java').certificate.id;
    expect(await runCli(['verify', id], a.io)).toBe(0);
    expect(JSON.parse(a.out.join('')).status).toBe('valid');

    const b = makeIo();
    expect(await runCli(['verify', 'GEO-NADA'], b.io)).toBe(1);
  });

  test('argumentos inválidos retornam código 2', async () => {
    const a = makeIo();
    expect(await runCli(['verify'], a.io)).toBe(2);
    expect(await runCli(['xpto'], a.io)).toBe(2);
    expect(a.err.join('')).toContain('Comando desconhecido');
  });
});
