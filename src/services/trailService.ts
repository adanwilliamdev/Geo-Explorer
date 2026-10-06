import trailsData from '../data/trails.json';
import { GeoError, NotFoundError } from '../errors';
import { Level, LEVELS } from '../types';
import { normalizeKey, parseLevel, suggestionSuffix } from '../validation';

export interface Module {
  id: string;
  name: string;
  level: Level;
  /** Carga horária estimada, em horas. */
  hours: number;
  topics: string[];
  /** IDs de módulos da mesma trilha que devem ser concluídos antes. */
  prerequisites: string[];
}

export interface ModuleWithTech extends Module {
  tech: string;
}

export interface Trail {
  title: string;
  description: string;
  aliases?: string[];
  modules: Module[];
}

export type Catalog = Record<string, Trail>;

export interface LevelSummary {
  modules: number;
  hours: number;
}

export interface TrailResponse {
  tech: string;
  title: string;
  description: string;
  levels: Level[];
  /** Nomes dos módulos (formato original, mantido por compatibilidade). */
  modules: string[];
  moduleDetails: Module[];
  totalHours: number;
  levelSummary: Partial<Record<Level, LevelSummary>>;
  suggestedLevel: Level;
}

export interface TrailSummary {
  tech: string;
  title: string;
  description: string;
  levels: Level[];
  moduleCount: number;
  totalHours: number;
}

export interface LearningStep {
  order: number;
  module: Module;
  cumulativeHours: number;
}

export interface LearningPath {
  tech: string;
  title: string;
  level?: Level;
  totalHours: number;
  steps: LearningStep[];
}

const levelIndex = (level: Level): number => LEVELS.indexOf(level);

/** Garante a consistência do catálogo na inicialização (falha cedo, com mensagem clara). */
export function validateCatalog(catalog: Catalog): void {
  const fail = (message: string): never => {
    throw new GeoError('INTERNAL', `Catálogo de trilhas inválido: ${message}`);
  };
  const seenIds = new Map<string, string>();
  const seenNames = new Map<string, string>();

  for (const [tech, trail] of Object.entries(catalog)) {
    if (!/^[a-z0-9-]+$/.test(tech)) fail(`chave de trilha inválida "${tech}"`);
    if (trail.modules.length === 0) fail(`trilha "${tech}" não possui módulos`);

    for (const name of [tech, ...(trail.aliases ?? [])].map(normalizeKey)) {
      const owner = seenNames.get(name);
      if (owner && owner !== tech) fail(`alias "${name}" repetido em "${owner}" e "${tech}"`);
      seenNames.set(name, tech);
    }

    const ids = new Set(trail.modules.map((m) => m.id));
    for (const mod of trail.modules) {
      if (!mod.id.startsWith(`${tech}-`)) fail(`id "${mod.id}" deve começar com "${tech}-"`);
      if (seenIds.has(mod.id)) fail(`id de módulo duplicado "${mod.id}"`);
      seenIds.set(mod.id, tech);
      if (!LEVELS.includes(mod.level)) fail(`nível inválido em "${mod.id}"`);
      if (!(mod.hours > 0)) fail(`horas inválidas em "${mod.id}"`);
      for (const pre of mod.prerequisites) {
        if (pre === mod.id) fail(`"${mod.id}" depende de si mesmo`);
        if (!ids.has(pre)) fail(`pré-requisito "${pre}" de "${mod.id}" não existe em "${tech}"`);
        const preModule = trail.modules.find((m) => m.id === pre) as Module;
        if (levelIndex(preModule.level) > levelIndex(mod.level)) {
          fail(`"${mod.id}" depende de "${pre}", que é de nível mais alto`);
        }
      }
    }
    // Detecta ciclos: se a ordenação não consegue colocar todos os módulos, há um ciclo.
    try {
      orderModules(trail.modules);
    } catch {
      fail(`ciclo de pré-requisitos na trilha "${tech}"`);
    }
  }
}

/** Ordenação topológica estável: nível primeiro, depois a ordem do catálogo. */
export function orderModules(modules: Module[]): Module[] {
  const placed = new Set<string>();
  const result: Module[] = [];
  const pending = modules.map((module, index) => ({ module, index }));

  while (pending.length > 0) {
    const ready = pending
      .filter(({ module }) => module.prerequisites.every((p) => placed.has(p)))
      .sort(
        (a, b) => levelIndex(a.module.level) - levelIndex(b.module.level) || a.index - b.index
      );
    if (ready.length === 0) throw new Error('ciclo de pré-requisitos');
    const next = ready[0];
    pending.splice(pending.indexOf(next), 1);
    placed.add(next.module.id);
    result.push(next.module);
  }
  return result;
}

export class TrailService {
  private readonly catalog: Catalog;
  private readonly aliasToTech = new Map<string, string>();
  private readonly moduleIndex = new Map<string, ModuleWithTech>();

  constructor(catalog: Catalog = trailsData as unknown as Catalog) {
    validateCatalog(catalog);
    this.catalog = catalog;
    for (const [tech, trail] of Object.entries(catalog)) {
      for (const name of [tech, ...(trail.aliases ?? [])]) {
        this.aliasToTech.set(normalizeKey(name), tech);
      }
      for (const mod of trail.modules) this.moduleIndex.set(mod.id, { ...mod, tech });
    }
  }

  /** Resolve nome ou alias ("Node.js", "ts", "k8s") para a chave da trilha. */
  tryResolveTech(input: string): string | undefined {
    return this.aliasToTech.get(normalizeKey(input));
  }

  resolveTech(input: string): string {
    const tech = this.tryResolveTech(input);
    if (!tech) {
      const options = this.listTechnologies();
      throw new NotFoundError(
        `Trilha não encontrada para tecnologia: ${input}. Disponíveis: ${options.join(', ')}.` +
          suggestionSuffix(input, [...this.aliasToTech.keys()])
      );
    }
    return tech;
  }

  /** Obtém informações de uma trilha. */
  getTrail(tech: string): TrailResponse {
    const key = this.resolveTech(tech);
    const trail = this.catalog[key];
    const levels = this.levelsOf(trail);
    const levelSummary: Partial<Record<Level, LevelSummary>> = {};
    for (const mod of trail.modules) {
      const entry = (levelSummary[mod.level] ??= { modules: 0, hours: 0 });
      entry.modules += 1;
      entry.hours += mod.hours;
    }
    return {
      tech: key,
      title: trail.title,
      description: trail.description,
      levels,
      modules: trail.modules.map((m) => m.name),
      moduleDetails: trail.modules.map((m) => ({ ...m })),
      totalHours: this.sumHours(trail.modules),
      levelSummary,
      suggestedLevel: levels[0],
    };
  }

  listTechnologies(): string[] {
    return Object.keys(this.catalog);
  }

  listTrails(): TrailSummary[] {
    return this.listTechnologies().map((tech) => {
      const trail = this.catalog[tech];
      return {
        tech,
        title: trail.title,
        description: trail.description,
        levels: this.levelsOf(trail),
        moduleCount: trail.modules.length,
        totalHours: this.sumHours(trail.modules),
      };
    });
  }

  /** Nomes de todos os módulos da trilha (compatibilidade). */
  getAllModules(tech: string): string[] {
    return this.getModules(tech).map((m) => m.name);
  }

  getModules(tech: string, level?: Level): Module[] {
    const trail = this.catalog[this.resolveTech(tech)];
    const modules = trail.modules.map((m) => ({ ...m }));
    return level ? modules.filter((m) => m.level === level) : modules;
  }

  getModule(id: string): ModuleWithTech {
    const mod = this.moduleIndex.get(id);
    if (!mod) {
      throw new NotFoundError(
        `Módulo não encontrado: ${id}.` + suggestionSuffix(id, [...this.moduleIndex.keys()])
      );
    }
    return { ...mod };
  }

  /** Resolve um módulo por id ou, com `tech`, também pelo nome (sem acentos/maiúsculas). */
  resolveModule(ref: string, tech?: string): ModuleWithTech {
    const byId = this.moduleIndex.get(ref.trim());
    if (byId) return { ...byId };

    const wanted = normalizeKey(ref);
    const scope = tech ? [this.resolveTech(tech)] : this.listTechnologies();
    const matches: ModuleWithTech[] = [];
    for (const key of scope) {
      for (const mod of this.catalog[key].modules) {
        if (normalizeKey(mod.name) === wanted) matches.push({ ...mod, tech: key });
      }
    }
    if (matches.length === 1) return matches[0];
    return this.getModule(ref);
  }

  /** Ordem recomendada de estudo, respeitando pré-requisitos. */
  getLearningPath(tech: string, level?: string): LearningPath {
    const key = this.resolveTech(tech);
    const trail = this.catalog[key];
    const parsedLevel = level ? parseLevel(level) : undefined;

    let ordered = orderModules(trail.modules);
    if (parsedLevel) ordered = ordered.filter((m) => m.level === parsedLevel);

    let cumulative = 0;
    const steps = ordered.map((module, i) => {
      cumulative += module.hours;
      return { order: i + 1, module: { ...module }, cumulativeHours: cumulative };
    });
    return { tech: key, title: trail.title, level: parsedLevel, totalHours: cumulative, steps };
  }

  private levelsOf(trail: Trail): Level[] {
    const present = new Set(trail.modules.map((m) => m.level));
    return LEVELS.filter((l) => present.has(l));
  }

  private sumHours(modules: Module[]): number {
    return modules.reduce((total, m) => total + m.hours, 0);
  }
}

export default new TrailService();
