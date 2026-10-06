import { makeServices } from './helpers';

describe('SearchService', () => {
  const { search } = makeServices();

  test('encontra módulos por tópico, ignorando acentos e maiúsculas', () => {
    const hits = search.search('Autenticação');
    expect(hits[0].id).toBe('node-autenticacao-jwt');
    expect(search.search('STREAMS').some((h) => h.id === 'java-collections')).toBe(true);
  });

  test('encontra desafios por tag e filtra por tecnologia', () => {
    const hits = search.search('docker', { tech: 'node' });
    expect(hits.every((h) => h.tech === 'node')).toBe(true);
    expect(hits.some((h) => h.type === 'challenge')).toBe(true);
    expect(hits.some((h) => h.type === 'module')).toBe(true);
  });

  test('respeita o limite e retorna vazio para termos curtos ou inexistentes', () => {
    expect(search.search('api', { limit: 3 }).length).toBe(3);
    expect(search.search('a')).toEqual([]);
    expect(search.search('xyzzyplugh')).toEqual([]);
  });

  test('resultados vêm ordenados por relevância', () => {
    const hits = search.search('kubernetes');
    expect(hits[0].score >= hits[hits.length - 1].score).toBe(true);
    expect(hits[0].id).toBe('devops-kubernetes');
  });
});
