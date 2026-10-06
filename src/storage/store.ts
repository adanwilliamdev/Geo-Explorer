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

/**
 * Persistência em arquivo JSON com gravação atômica (arquivo temporário + rename).
 * Relê o arquivo quando ele muda em disco, o que cobre vários processos em modo "melhor esforço"
 * (último a gravar vence; não há lock entre processos).
 */
export class JsonFileStore<T> implements Store<T> {
  private cache: T;
  private signature = '';

  constructor(
    private readonly file: string,
    initial: () => T,
    private readonly logger: Logger = silentLogger
  ) {
    this.cache = initial();
    this.refresh();
  }

  read(): T {
    this.refresh();
    return this.cache;
  }

  update<R>(mutator: (draft: T) => R): R {
    this.refresh();
    const draft = clone(this.cache);
    const result = mutator(draft);
    this.persist(draft);
    this.cache = draft;
    return result;
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
