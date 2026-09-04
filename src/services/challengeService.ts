export interface Challenge {
  id: string;
  tech: string;
  level: string;
  title: string;
  description: string;
  requirements: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  hints?: string[];
}

export class ChallengeService {
  private challengeTemplates: Record<string, Record<string, Challenge[]>> = {};

  constructor() {
    this.initializeChallenges();
  }

  /**
   * Inicializa os templates de desafios para cada tecnologia e nível
   */
  private initializeChallenges(): void {
    // Desafios Java
    this.challengeTemplates['java'] = {
      'iniciante': [
        {
          id: 'java-basics-1',
          tech: 'java',
          level: 'iniciante',
          title: 'Calculadora Simples',
          description: 'Crie uma calculadora que realiza operações básicas (soma, subtração, multiplicação, divisão) utilizando métodos e tratamento de exceções.',
          requirements: [
            'Criar uma classe Calculator com métodos para cada operação',
            'Implementar tratamento para divisão por zero',
            'Utilizar Scanner para entrada de dados',
            'Exibir resultados formatados'
          ],
          difficulty: 'easy',
          estimatedTime: '45 minutos',
          hints: ['Use try-catch para exceções', 'Crie um menu com switch']
        }
      ],
      'intermediario': [
        {
          id: 'java-oop-1',
          tech: 'java',
          level: 'intermediario',
          title: 'Sistema de Gerenciamento de Biblioteca',
          description: 'Desenvolva um sistema de biblioteca com classes para Livro, Usuário e Empréstimo utilizando conceitos de POO.',
          requirements: [
            'Criar classes com encapsulamento adequado',
            'Implementar herança para diferentes tipos de usuários',
            'Utilizar collections para gerenciar dados',
            'Implementar validações de negócio'
          ],
          difficulty: 'medium',
          estimatedTime: '1h30min',
          hints: ['Pense na relação entre as entidades', 'Use List para armazenamento']
        }
      ],
      'avancado': [
        {
          id: 'java-spring-1',
          tech: 'java',
          level: 'avancado',
          title: 'API REST com Spring Boot',
          description: 'Crie uma API REST completa com Spring Boot para gerenciamento de produtos, incluindo autenticação e banco de dados.',
          requirements: [
            'Configurar Spring Boot com Spring Security',
            'Implementar CRUD completo para produtos',
            'Utilizar JPA/Hibernate com banco de dados',
            'Documentar a API com Swagger'
          ],
          difficulty: 'hard',
          estimatedTime: '3 horas',
          hints: ['Use Spring Initializr para começar', 'Siga padrões RESTful']
        }
      ]
    };

    // Desafios Node.js
    this.challengeTemplates['node'] = {
      'iniciante': [
        {
          id: 'node-basics-1',
          tech: 'node',
          level: 'iniciante',
          title: 'Servidor HTTP Simples',
          description: 'Crie um servidor HTTP que serve arquivos estáticos e processa requisições GET e POST.',
          requirements: [
            'Usar módulo http nativo ou Express',
            'Servir arquivos HTML/CSS/JS',
            'Processar dados de formulário',
            'Retornar respostas JSON'
          ],
          difficulty: 'easy',
          estimatedTime: '1 hora',
          hints: ['Use fs para ler arquivos', 'Configure rotas básicas']
        }
      ],
      'intermediario': [
        {
          id: 'node-express-1',
          tech: 'node',
          level: 'intermediario',
          title: 'API RESTful com Autenticação JWT',
          description: 'Construa uma API RESTful com Express, autenticação JWT e integração com banco de dados PostgreSQL.',
          requirements: [
            'Configurar Express com estrutura MVC',
            'Implementar autenticação JWT',
            'Integrar com Prisma/TypeORM',
            'Criar middlewares para validação'
          ],
          difficulty: 'medium',
          estimatedTime: '2h30min',
          hints: ['Use bcrypt para hash de senha', 'Implemente refresh token']
        }
      ]
    };

    // Desafios React
    this.challengeTemplates['react'] = {
      'iniciante': [
        {
          id: 'react-basics-1',
          tech: 'react',
          level: 'iniciante',
          title: 'Lista de Tarefas',
          description: 'Crie uma aplicação de lista de tarefas com React utilizando hooks e gerenciamento de estado.',
          requirements: [
            'Usar useState para gerenciar tarefas',
            'Permitir adicionar, remover e marcar como concluído',
            'Salvar dados no localStorage',
            'Ter um design responsivo'
          ],
          difficulty: 'easy',
          estimatedTime: '1h30min',
          hints: ['Use a lib "uuid" para identificar itens', 'Crie componentes reutilizáveis']
        }
      ],
      'intermediario': [
        {
          id: 'react-context-1',
          tech: 'react',
          level: 'intermediario',
          title: 'E-commerce Carousel',
          description: 'Desenvolva um carousel de produtos com filtros e carrinho de compras usando Context API e React Router.',
          requirements: [
            'Usar Context API para estado global',
            'Implementar rotas para categorias',
            'Criar carrinho de compras',
            'Utilizar Tailwind CSS para estilização'
          ],
          difficulty: 'medium',
          estimatedTime: '3 horas',
          hints: ['Pense na estrutura do contexto', 'Use useReducer para estado complexo']
        }
      ],
      'avancado': [
        {
          id: 'react-next-1',
          tech: 'react',
          level: 'avancado',
          title: 'Blog com Next.js e GraphQL',
          description: 'Crie um blog completo com Next.js, GraphQL (Apollo) e SSG/SSR.',
          requirements: [
            'Configurar Next.js com TypeScript',
            'Implementar Apollo Client para GraphQL',
            'Usar SSG e SSR conforme necessário',
            'Otimizar performance e SEO'
          ],
          difficulty: 'hard',
          estimatedTime: '4 horas',
          hints: ['Use getStaticProps para posts', 'Implemente paginação']
        }
      ]
    };

    // Desafios Python
    this.challengeTemplates['python'] = {
      'iniciante': [
        {
          id: 'python-basics-1',
          tech: 'python',
          level: 'iniciante',
          title: 'Análise de Dados com Pandas',
          description: 'Realize análise exploratória de dados utilizando Pandas e crie visualizações com Matplotlib.',
          requirements: [
            'Carregar dados de um CSV',
            'Realizar limpeza e pré-processamento',
            'Criar visualizações relevantes',
            'Gerar estatísticas descritivas'
          ],
          difficulty: 'easy',
          estimatedTime: '1h30min',
          hints: ['Use describe() para estatísticas', 'Crie gráficos de distribuição']
        }
      ],
      'intermediario': [
        {
          id: 'python-ml-1',
          tech: 'python',
          level: 'intermediario',
          title: 'Predição com Machine Learning',
          description: 'Construa um modelo de machine learning para prever preços utilizando Scikit-learn.',
          requirements: [
            'Realizar análise exploratória',
            'Preparar dados (encoding, scaling)',
            'Treinar e avaliar múltiplos modelos',
            'Otimizar hiperparâmetros'
          ],
          difficulty: 'medium',
          estimatedTime: '3 horas',
          hints: ['Use GridSearchCV para otimização', 'Avalie com métricas apropriadas']
        }
      ]
    };
  }

  /**
   * Gera um desafio baseado na tecnologia e nível
   */
  generateChallenge(tech: string, level: string): Challenge {
    const normalizedTech = tech.toLowerCase().trim();
    const normalizedLevel = level.toLowerCase().trim();

    if (!this.challengeTemplates[normalizedTech]) {
      throw new Error(`Tecnologia não suportada: ${tech}`);
    }

    if (!this.challengeTemplates[normalizedTech][normalizedLevel]) {
      throw new Error(`Nível não encontrado para ${tech}: ${level}`);
    }

    const challenges = this.challengeTemplates[normalizedTech][normalizedLevel];
    const randomIndex = Math.floor(Math.random() * challenges.length);
    
    return {
      ...challenges[randomIndex],
      id: `${challenges[randomIndex].id}-${Date.now()}`
    };
  }

  /**
   * Gera múltiplos desafios
   */
  generateMultipleChallenges(tech: string, level: string, count: number = 3): Challenge[] {
    const challenges: Challenge[] = [];
    const available = this.challengeTemplates[tech]?.[level] || [];
    
    if (available.length === 0) {
      throw new Error(`Nenhum desafio disponível para ${tech} no nível ${level}`);
    }

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const limit = Math.min(count, shuffled.length);
    
    for (let i = 0; i < limit; i++) {
      challenges.push({
        ...shuffled[i],
        id: `${shuffled[i].id}-${Date.now()}-${i}`
      });
    }

    return challenges;
  }

  /**
   * Lista todos os níveis disponíveis para uma tecnologia
   */
  getAvailableLevels(tech: string): string[] {
    const normalizedTech = tech.toLowerCase().trim();
    if (!this.challengeTemplates[normalizedTech]) {
      return [];
    }
    return Object.keys(this.challengeTemplates[normalizedTech]);
  }
}

export default new ChallengeService();
