import * as fs from 'node:fs';
import * as path from 'node:path';
import { StorageError } from '../errors';
import { Logger, silentLogger } from '../logger';

/**
 * Armazenamento transacional mínimo.
 * `update` aplica a mutação a uma cópia: se o callback lançar, nada é gravado.
 */
export interface Store<T> {
  read(): T;
  update<R>(mutator: (draft: T) => R): R;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class MemoryStore<T> implements Store<T> {
  private state: T;

  constructor(initial: T) {
    this.state = clone(initial);
  }

  read(): T {
    return this.state;
  }

  update<R>(mutator: (draft: T) => R): R {
    const draft = clone(this.state);
    const result = mutator(draft);
    this.state = draft;
    return result;
  }
}

export interface JsonFileStoreOptions {
  /** Tempo máximo esperando o lock de escrita (ms). Padrão: 5000. */
  lockTimeoutMs?: number;
  /** Idade (ms) a partir da qual um lock é considerado abandonado e removido. Padrão: 10000. */
  lockStaleMs?: number;
}

const sleep = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * Persistência em arquivo JSON com gravação atômica (arquivo temporário + rename).
 * Cada `update` é uma seção crítica protegida por um lock em arquivo (`<arquivo>.lock`, criado com `wx`):
 * ler → mutar → gravar acontece sem que outro processo no mesmo diretório intercale uma escrita,
 * então nenhuma atualização é perdida. Um lock mais velho que `lockStaleMs` (processo que morreu) é removido.
 * A leitura não usa lock: o rename atômico garante que ela nunca veja um arquivo pela metade.
 */
export class JsonFileStore<T> implements Store<T> {
  private cache: T;
  private signature = '';

  private readonly lockFile: string;
  private readonly lockTimeoutMs: number;
  private readonly lockStaleMs: number;

  constructor(
    private readonly file: string,
    initial: () => T,
    private readonly logger: Logger = silentLogger,
    options: JsonFileStoreOptions = {}
  ) {
    this.lockFile = `${file}.lock`;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5000;
    this.lockStaleMs = options.lockStaleMs ?? 10_000;
    this.cache = initial();
    this.refresh();
  }

  read(): T {
    this.refresh();
    return this.cache;
  }

  update<R>(mutator: (draft: T) => R): R {
    this.acquireLock();
    try {
      this.refresh();
      const draft = clone(this.cache);
      const result = mutator(draft);
      this.persist(draft);
      this.cache = draft;
      return result;
    } finally {
      this.releaseLock();
    }
  }

  private acquireLock(): void {
    const deadline = Date.now() + this.lockTimeoutMs;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    for (;;) {
      try {
        fs.closeSync(fs.openSync(this.lockFile, 'wx', 0o600));
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw new StorageError(`Falha ao obter o lock de ${this.file}`, {
            cause: error instanceof Error ? error.message : String(error),
          });
        }
      }
      try {
        if (Date.now() - fs.statSync(this.lockFile).mtimeMs > this.lockStaleMs) {
          this.logger.warn('removendo lock abandonado', { lock: this.lockFile });
          fs.rmSync(this.lockFile, { force: true });
          continue;
        }
      } catch {
        continue; // o lock sumiu entre o open e o stat: tenta de novo
      }
      if (Date.now() >= deadline) {
        throw new StorageError(`Tempo esgotado aguardando o lock de ${this.file}. Outro processo está gravando?`);
      }
      sleep(10);
    }
  }

  private releaseLock(): void {
    try {
      fs.rmSync(this.lockFile, { force: true });
    } catch {
      /* melhor esforço: um lock órfão expira sozinho */
    }
  }

  private statSignature(): string | null {
    try {
      const st = fs.statSync(this.file);
      return `${st.mtimeMs}:${st.size}`;
    } catch {
      return null;
    }
  }

  private refresh(): void {
    const sig = this.statSignature();
    if (sig === null) {
      this.signature = '';
      return;
    }
    if (sig === this.signature) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (error) {
      throw new StorageError(
        `Arquivo de dados corrompido ou ilegível: ${this.file}. Corrija ou remova o arquivo.`,
        { cause: error instanceof Error ? error.message : String(error) }
      );
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new StorageError(`Formato inesperado no arquivo de dados: ${this.file}`);
    }
    this.cache = parsed as T;
    this.signature = sig;
    this.logger.debug('dados carregados', { file: this.file });
  }

  private persist(next: T): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch (error) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* melhor esforço */
      }
      throw new StorageError(`Falha ao gravar dados em ${this.file}`, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    this.signature = this.statSignature() ?? '';
  }
}
