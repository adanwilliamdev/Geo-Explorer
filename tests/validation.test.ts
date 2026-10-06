import { loadConfig } from '../src/config';
import {
  asArgs, didYouMean, levenshtein, normalizeKey, optionalInt, optionalString,
  parseCertificateLevel, parseLevel, requireBoolArray, requireString, slugify,
} from '../src/validation';

describe('validation', () => {
  test('normalizeKey e slugify', () => {
    expect(normalizeKey('  Intermediário  ')).toBe('intermediario');
    expect(slugify('João da Silva!')).toBe('joao-da-silva');
    expect(slugify('***')).toBe('');
  });

  test('levenshtein e didYouMean', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(didYouMean('pyton', ['python', 'java'])).toBe('python');
    expect(didYouMean('zzzzzz', ['python', 'java'])).toBe(undefined);
  });

  test('parseLevel aceita acentos e inglês; parseCertificateLevel aceita completo', () => {
    expect(parseLevel('Avançado')).toBe('avancado');
    expect(parseLevel('beginner')).toBe('iniciante');
    expect(() => parseLevel('mestre')).toThrow('Nível inválido');
    expect(parseCertificateLevel('Completo')).toBe('completo');
  });

  test('leitura de argumentos', () => {
    expect(asArgs(undefined)).toEqual({});
    expect(() => asArgs([1])).toThrow('objeto JSON');
    expect(requireString({ a: '  x ' }, 'a')).toBe('x');
    expect(() => requireString({}, 'a')).toThrow('obrigatório');
    expect(() => requireString({ a: 5 }, 'a')).toThrow('deve ser texto');
    expect(() => requireString({ a: 'a\nb' }, 'a')).toThrow('controle');
    expect(() => requireString({ a: 'x'.repeat(300) }, 'a')).toThrow('no máximo');
    expect(optionalString({ a: '   ' }, 'a')).toBe(undefined);
    expect(optionalInt({ n: 3 }, 'n', { min: 1, max: 5 })).toBe(3);
    expect(() => optionalInt({ n: 1.5 }, 'n')).toThrow('inteiro');
    expect(() => optionalInt({ n: 9 }, 'n', { max: 5 })).toThrow('entre');
    expect(requireBoolArray({ b: [true, false] }, 'b')).toEqual([true, false]);
    expect(() => requireBoolArray({ b: [1] }, 'b')).toThrow('lista de true/false');
  });
});

describe('loadConfig', () => {
  test('padrões', () => {
    const c = loadConfig({});
    expect(c.passScore).toBe(70);
    expect(c.strictCertificates).toBe(false);
    expect(c.logLevel).toBe('info');
    expect(c.dataDir).toContain('.geo-explorer');
  });

  test('valores customizados e modo memória', () => {
    const c = loadConfig({
      GEO_DATA_DIR: ':memory:', GEO_STRICT_CERTIFICATES: 'TRUE', GEO_PASS_SCORE: '80',
      GEO_LOG_LEVEL: 'debug', GEO_CERT_SECRET: 'x'.repeat(20),
    });
    expect(c.dataDir).toBe(null);
    expect(c.strictCertificates).toBe(true);
    expect(c.passScore).toBe(80);
    expect(c.logLevel).toBe('debug');
  });

  test('rejeita valores inválidos', () => {
    expect(() => loadConfig({ GEO_PASS_SCORE: '0' })).toThrow('GEO_PASS_SCORE');
    expect(() => loadConfig({ GEO_STRICT_CERTIFICATES: 'talvez' })).toThrow('GEO_STRICT_CERTIFICATES');
    expect(() => loadConfig({ GEO_LOG_LEVEL: 'tudo' })).toThrow('GEO_LOG_LEVEL');
    expect(() => loadConfig({ GEO_CERT_SECRET: 'curto' })).toThrow('16 caracteres');
    expect(() => loadConfig({ GEO_TIMEZONE: 'Marte/Olimpo' })).toThrow('GEO_TIMEZONE');
  });
});
