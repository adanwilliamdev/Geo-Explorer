export const LEVELS = ['iniciante', 'intermediario', 'avancado'] as const;
export type Level = (typeof LEVELS)[number];

/** Nível aceito na emissão de certificados: um nível específico ou a trilha inteira. */
export type CertificateLevel = Level | 'completo';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_BY_LEVEL: Record<Level, Difficulty> = {
  iniciante: 'easy',
  intermediario: 'medium',
  avancado: 'hard',
};

/** Fonte de tempo injetável para tornar o código determinístico em testes. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
