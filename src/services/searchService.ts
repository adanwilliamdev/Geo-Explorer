import { Level } from '../types';
import { normalizeKey } from '../validation';
import challengeServiceDefault, { ChallengeService } from './challengeService';
import trailServiceDefault, { TrailService } from './trailService';

export interface SearchHit {
  type: 'trail' | 'module' | 'challenge';
  id: string;
  tech: string;
  title: string;
  level?: Level;
  score: number;
  /** Onde o termo foi encontrado (ex.: "tópico: streams e lambdas"). */
  match: string;
}

export interface SearchOptions {
  tech?: string;
  limit?: number;
}

/** Busca textual simples (sem acentos/maiúsculas) em trilhas, módulos e desafios. */
export class SearchService {
  constructor(
    private readonly trails: TrailService = trailServiceDefault,
    private readonly challenges: ChallengeService = challengeServiceDefault
  ) {}

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const tokens = normalizeKey(query).split(' ').filter((t) => t.length >= 2);
    if (tokens.length === 0) return [];
    const scope = options.tech ? this.trails.resolveTech(options.tech) : undefined;
    const hits: SearchHit[] = [];

    for (const trail of this.trails.listTrails()) {
      if (scope && trail.tech !== scope) continue;
      const trailScore = this.score(tokens, [
        { text: trail.title, weight: 10, label: 'título' },
        { text: trail.tech, weight: 10, label: 'tecnologia' },
        { text: trail.description, weight: 1, label: 'descrição' },
      ]);
      if (trailScore.score > 0) {
        hits.push({ type: 'trail', id: trail.tech, tech: trail.tech, title: trail.title, ...trailScore });
      }

      for (const mod of this.trails.getModules(trail.tech)) {
        const s = this.score(tokens, [
          { text: mod.name, weight: 12, label: 'nome' },
          ...mod.topics.map((t) => ({ text: t, weight: 6, label: `tópico: ${t}` })),
        ]);
        if (s.score > 0) {
          hits.push({ type: 'module', id: mod.id, tech: trail.tech, title: mod.name, level: mod.level, ...s });
        }
      }
    }

    for (const c of this.challenges.listChallenges({ tech: scope })) {
      const s = this.score(tokens, [
        { text: c.title, weight: 10, label: 'título' },
        ...c.tags.map((t) => ({ text: t, weight: 6, label: `tag: ${t}` })),
        { text: c.description, weight: 1, label: 'descrição' },
      ]);
      if (s.score > 0) {
        hits.push({ type: 'challenge', id: c.id, tech: c.tech, title: c.title, level: c.level, ...s });
      }
    }

    return hits
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, options.limit ?? 10);
  }

  private score(
    tokens: string[],
    fields: Array<{ text: string; weight: number; label: string }>
  ): { score: number; match: string } {
    let total = 0;
    let best = { weight: 0, label: '' };
    for (const field of fields) {
      const haystack = normalizeKey(field.text);
      // Nome/título idêntico à busca vale muito mais que uma ocorrência parcial (tags e tópicos não contam).
      if (field.weight >= 10 && haystack === tokens.join(' ')) total += 20;
      for (const token of tokens) {
        if (haystack.includes(token)) {
          total += field.weight;
          if (field.weight > best.weight) best = { weight: field.weight, label: field.label };
        }
      }
    }
    return { score: total, match: best.label };
  }
}

export default new SearchService();
