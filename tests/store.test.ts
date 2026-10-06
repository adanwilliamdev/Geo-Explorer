import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createServices } from '../src/container';
import { loadConfig } from '../src/config';
import { silentLogger } from '../src/logger';
import { JsonFileStore, MemoryStore } from '../src/storage/store';

interface Doc { items: string[] }

describe('stores', () => {
  let dir = '';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-store-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('MemoryStore é transacional: erro no mutator descarta as mudanças', () => {
    const store = new MemoryStore<Doc>({ items: [] });
    store.update((d) => d.items.push('a'));
    expect(() => store.update((d) => { d.items.push('b'); throw new Error('boom'); })).toThrow('boom');
    expect(store.read().items).toEqual(['a']);
  });

  test('JsonFileStore persiste, recarrega e não deixa arquivo temporário', () => {
    const file = path.join(dir, 'sub', 'data.json');
    const a = new JsonFileStore<Doc>(file, () => ({ items: [] }));
    a.update((d) => d.items.push('x'));
    expect(fs.readdirSync(path.dirname(file))).toEqual(['data.json']);

    const b = new JsonFileStore<Doc>(file, () => ({ items: [] }));
    expect(b.read().items).toEqual(['x']);
  });

  test('JsonFileStore enxerga alterações feitas por outro processo/instância', () => {
    const file = path.join(dir, 'data.json');
    const a = new JsonFileStore<Doc>(file, () => ({ items: [] }));
    const b = new JsonFileStore<Doc>(file, () => ({ items: [] }));
    a.update((d) => d.items.push('from-a'));
    b.update((d) => d.items.push('from-b'));
    expect(a.read().items).toEqual(['from-a', 'from-b']);
  });

  test('JsonFileStore não grava quando o mutator falha', () => {
    const file = path.join(dir, 'data.json');
    const s = new JsonFileStore<Doc>(file, () => ({ items: [] }));
    expect(() => s.update(() => { throw new Error('x'); })).toThrow('x');
    expect(fs.existsSync(file)).toBe(false);
  });

  test('arquivo corrompido gera erro claro em vez de apagar os dados', () => {
    const file = path.join(dir, 'data.json');
    fs.writeFileSync(file, '{ quebrado');
    expect(() => new JsonFileStore<Doc>(file, () => ({ items: [] }))).toThrow('corrompido');
    expect(fs.readFileSync(file, 'utf8')).toBe('{ quebrado');
  });

  test('createServices persiste progresso e certificados entre execuções, com o mesmo segredo', () => {
    const config = loadConfig({ GEO_DATA_DIR: dir, GEO_LOG_LEVEL: 'silent' });
    const first = createServices(config, silentLogger);
    first.progress.completeModule('Ana Costa', 'java-sintaxe-basica');
    const id = first.certificates.issueCertificate('Ana Costa', 'java').certificate.id;

    const second = createServices(config, silentLogger);
    expect(second.progress.getProgress('Ana Costa').user.xp).toBe(60);
    expect(second.certificates.verify(id).status).toBe('valid');
    expect(fs.existsSync(path.join(dir, 'secret.key'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'certificates', `${id}.html`))).toBe(true);
  });
});
