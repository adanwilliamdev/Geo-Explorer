import trailsData from '../data/trails.json';

export interface Module {
  name: string;
  duration?: string;
  prerequisites?: string[];
}

export interface Trail {
  title: string;
  levels: string[];
  modules: string[] | Module[];
  description?: string;
}

export interface TrailResponse {
  tech: string;
  title: string;
  levels: string[];
  modules: string[];
  suggestedLevel: string;
  description?: string;
}

export class TrailService {
  private trails: Record<string, Trail> = trailsData;

  /**
   * Obtém informações de uma trilha específica
   * @param tech - Tecnologia da trilha (ex: 'java', 'node')
   * @returns Dados da trilha com nível sugerido
   */
  getTrail(tech: string): TrailResponse {
    const normalizedTech = tech.toLowerCase().trim();
    
    if (!this.trails[normalizedTech]) {
      throw new Error(`Trilha não encontrada para tecnologia: ${tech}`);
    }

    const trail = this.trails[normalizedTech];
    const suggestedLevel = this.getSuggestedLevel(trail.levels);
    
    return {
      tech: normalizedTech,
      title: trail.title,
      levels: trail.levels,
      modules: this.extractModuleNames(trail.modules),
      suggestedLevel: suggestedLevel,
      description: trail.description
    };
  }

  /**
   * Lista todas as tecnologias disponíveis
   */
  listTechnologies(): string[] {
    return Object.keys(this.trails);
  }

  /**
   * Obtém detalhes completos de todos os módulos
   */
  getAllModules(tech: string): string[] {
    const normalizedTech = tech.toLowerCase().trim();
    
    if (!this.trails[normalizedTech]) {
      throw new Error(`Trilha não encontrada para tecnologia: ${tech}`);
    }

    return this.extractModuleNames(this.trails[normalizedTech].modules);
  }

  /**
   * Sugere um nível baseado na disponibilidade
   */
  private getSuggestedLevel(levels: string[]): string {
    if (levels.length === 0) return 'iniciante';
    // Sugere o nível mais básico disponível
    const levelPriority = ['iniciante', 'intermediario', 'avancado'];
    for (const level of levelPriority) {
      if (levels.includes(level)) {
        return level;
      }
    }
    return levels[0];
  }

  /**
   * Extrai nomes dos módulos (suporta string ou objeto)
   */
  private extractModuleNames(modules: string[] | Module[]): string[] {
    if (modules.length === 0) return [];
    
    if (typeof modules[0] === 'string') {
      return modules as string[];
    }
    
    return (modules as Module[]).map(mod => mod.name);
  }
}

export default new TrailService();
