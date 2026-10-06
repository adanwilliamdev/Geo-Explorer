export type ErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'PRECONDITION' | 'STORAGE' | 'INTERNAL';

/** Erro de domínio: mensagens são seguras para exibir ao usuário final / ao assistente de IA. */
export class GeoError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends GeoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, details);
  }
}

export class NotFoundError extends GeoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('NOT_FOUND', message, details);
  }
}

/** A operação é válida, mas o estado atual não permite (ex.: pré-requisitos pendentes). */
export class PreconditionError extends GeoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PRECONDITION', message, details);
  }
}

export class StorageError extends GeoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('STORAGE', message, details);
  }
}
