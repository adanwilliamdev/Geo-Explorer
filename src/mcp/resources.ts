import { Services } from '../container';
import { NotFoundError } from '../errors';
import { LEVELS } from '../types';

export interface ResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

const INDEX_URI = 'geo://trails';
const trailUri = (tech: string): string => `geo://trails/${tech}`;

export function listResources(s: Services): ResourceInfo[] {
  return [
    {
      uri: INDEX_URI,
      name: 'Catálogo de trilhas',
      description: 'Resumo de todas as trilhas (JSON)',
      mimeType: 'application/json',
    },
    ...s.trails.listTrails().map((t) => ({
      uri: trailUri(t.tech),
      name: t.title,
      description: `Roteiro de estudo em Markdown: ${t.description}`,
      mimeType: 'text/markdown',
    })),
  ];
}

export function renderTrailMarkdown(s: Services, tech: string): string {
  const path = s.trails.getLearningPath(tech);
  const trail = s.trails.getTrail(tech);
  const lines = [`# ${trail.title}`, '', trail.description, '', `**Carga total:** ${trail.totalHours}h · **Módulos:** ${path.steps.length}`];

  for (const level of LEVELS) {
    const steps = path.steps.filter((st) => st.module.level === level);
    if (steps.length === 0) continue;
    lines.push('', `## ${level[0].toUpperCase()}${level.slice(1)}`, '');
    for (const { module: m } of steps) {
      const requires = m.prerequisites.length ? ` _(requer: ${m.prerequisites.join(', ')})_` : '';
      lines.push(`- **${m.name}** (\`${m.id}\`, ${m.hours}h)${requires}`);
      lines.push(`  - Tópicos: ${m.topics.join('; ')}`);
    }
  }
  return lines.join('\n');
}

export function readResource(s: Services, uri: string): ResourceContent {
  if (uri === INDEX_URI) {
    return { uri, mimeType: 'application/json', text: JSON.stringify(s.trails.listTrails(), null, 2) };
  }
  const match = /^geo:\/\/trails\/([a-z0-9-]+)$/.exec(uri);
  if (match && s.trails.tryResolveTech(match[1])) {
    return { uri, mimeType: 'text/markdown', text: renderTrailMarkdown(s, match[1]) };
  }
  throw new NotFoundError(`Recurso não encontrado: ${uri}`);
}
