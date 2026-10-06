# 🗺️ Geo-Explorer

### Servidor MCP para Trilhas de Aprendizagem com IA

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-licença)
[![Tests](https://img.shields.io/badge/tests-jest-C21325?logo=jest&logoColor=white)](#-testes)

Plataforma de aprendizagem exposta como um **servidor MCP (Model Context Protocol)** em **Node.js + TypeScript**: trilhas com roteiro de estudo, desafios práticos avaliados por critérios, progresso com XP e conquistas, e certificados **assinados e verificáveis**.

Projeto desenvolvido durante o **Bootcamp IBM Bob: IA de Nível Empresarial para Desenvolvedores e Tech Leaders**.

---

## 📑 Índice

* [O que o Geo-Explorer faz](#-o-que-o-geo-explorer-faz)
* [Trilhas disponíveis](#-trilhas-disponíveis)
* [Ferramentas MCP](#-ferramentas-mcp)
* [Resources e Prompts](#-resources-e-prompts)
* [Como o progresso e os certificados funcionam](#-como-o-progresso-e-os-certificados-funcionam)
* [Arquitetura](#-arquitetura)
* [Como executar](#-como-executar)
* [Configuração](#️-configuração)
* [Conectando a um cliente MCP](#-conectando-a-um-cliente-mcp)
* [Docker](#-docker)
* [Testes e qualidade](#-testes-e-qualidade)
* [Limitações conhecidas](#️-limitações-conhecidas)
* [Roadmap](#-roadmap)
* [Licença](#-licença)

---

## ✨ O que o Geo-Explorer faz

* 📚 **Trilhas** com módulos por nível, carga horária, tópicos e pré-requisitos, e um **roteiro de estudo** em ordem topológica;
* 🔎 **Busca** por assunto em trilhas, módulos e desafios (sem diferenciar acentos/maiúsculas);
* 💻 **Desafios práticos** (21, em todos os níveis de todas as trilhas) e **avaliação por requisitos** com nota, aprovação e XP;
* 👤 **Usuários e progresso**: matrícula, conclusão de módulos (respeitando pré-requisitos), painel, recomendações do próximo passo;
* 🏅 **Gamificação**: XP, ranks, sequência de dias (streak) e 8 conquistas;
* 📜 **Certificados** persistentes, assinados com HMAC-SHA256, com verificação real (autêntico / revogado / adulterado / inexistente), revogação e HTML pronto para impressão;
* 🔒 **Privacidade**: exclusão completa dos dados de uma pessoa (LGPD).

## 🧭 Trilhas disponíveis

| Trilha | Módulos | Horas | Níveis |
| ------ | ------: | ----: | ------ |
| ☕ Java (`java`) | 8 | 77 | iniciante · intermediário · avançado |
| 🟢 Node.js (`node`) | 11 | 68 | iniciante · intermediário · avançado |
| ⚛️ React (`react`) | 9 | 59 | iniciante · intermediário · avançado |
| 🐍 Python (`python`) | 9 | 73 | iniciante · intermediário · avançado |
| 🔷 TypeScript (`typescript`) | 8 | 49 | iniciante · intermediário · avançado |
| 🚢 DevOps (`devops`) | 8 | 70 | iniciante · intermediário · avançado |

Nomes alternativos são aceitos (`Node.js`, `ts`, `k8s`…) e erros de digitação geram sugestão (`Você quis dizer "python"?`). O catálogo (`src/data/trails.json`) é **validado na inicialização**: ids únicos, pré-requisitos existentes, sem ciclos e sem dependência de nível superior.

---

## 🔧 Ferramentas MCP

| Ferramenta | Descrição | Parâmetros |
| ---------- | --------- | ---------- |
| `list_technologies` | Trilhas disponíveis, com resumo | — |
| `get_trail` | Detalhes de uma trilha | `tech` |
| `get_learning_path` | Ordem de estudo com horas acumuladas | `tech`, `level?` |
| `search_content` | Busca em trilhas, módulos e desafios | `query`, `tech?`, `limit?` |
| `generate_challenge` | Desafio prático (evita os já concluídos se `userName` for informado) | `tech`, `level`, `userName?` |
| `submit_challenge` | Registra a avaliação de um desafio | `userName`, `challengeId`, `requirementsMet[]`, `hintsUsed?` |
| `enroll` | Matricula em uma trilha | `userName`, `tech`, `level?` |
| `complete_module` | Conclui um módulo (valida pré-requisitos, dá XP) | `userName`, `moduleId`, `tech?` |
| `get_progress` | Painel: XP, rank, streak, conquistas, andamento e elegibilidade a certificados | `userName`, `tech?` |
| `recommend_next` | Próximos módulos e um desafio do nível atual | `userName?`, `tech?` |
| `issue_certificate` | Emite certificado assinado (idempotente) | `userName`, `tech`, `level?` |
| `verify_certificate` | Verifica autenticidade e situação | `certificateId` |
| `revoke_certificate` | Revoga um certificado | `certificateId`, `reason?` |
| `list_certificates` | Lista certificados com filtros | `userName?`, `tech?`, `includeRevoked?` |
| `delete_user_data` | Apaga progresso e certificados da pessoa | `userName`, `confirm` |

Todas possuem *annotations* MCP (`readOnlyHint`, `destructiveHint`, `idempotentHint`) para que os clientes saibam quais pedem confirmação. Erros de domínio retornam `isError: true` com mensagem legível; erros inesperados são registrados em stderr e **não vazam detalhes internos** ao cliente.

## 📎 Resources e Prompts

**Resources**: `geo://trails` (catálogo, JSON) e `geo://trails/<tech>` (roteiro em Markdown, um por trilha).

**Prompts**: `study_plan` (plano semanal), `review_challenge` (revisa o código e chama `submit_challenge`) e `explain_module` (explicação com exemplos e exercícios).

---

## 🏆 Como o progresso e os certificados funcionam

```text
enroll → complete_module (…) → generate_challenge → submit_challenge → issue_certificate → verify_certificate
```

**Identidade.** O usuário é identificado pelo nome normalizado (`"João Silva"` = `"joao silva"`). Não há senha: o Geo-Explorer foi pensado para uso local/pessoal (veja [limitações](#️-limitações-conhecidas)).

**XP.** Módulo: 10 XP por hora de carga. Desafio (apenas na 1ª aprovação): 50 / 100 / 200 XP (iniciante / intermediário / avançado) × nota, com −10% por dica usada (mínimo 50%). `rank = ⌊√(XP/50)⌋ + 1`.

**Avaliação de desafios.** Quem revisou o código (normalmente o assistente de IA) informa, em `requirementsMet`, quais requisitos foram atendidos. Nota = % atendido; aprova a partir de `GEO_PASS_SCORE` (padrão 70).

**Certificados.** A *base* de cada certificado é:

* `verified`: o progresso registrado comprova a conclusão (todos os módulos do nível — ou da trilha, para `completo` — **e** ao menos um desafio aprovado em cada nível exigido);
* `self-declared`: não há progresso que comprove. Com `GEO_STRICT_CERTIFICATES=true` o certificado é **recusado**, listando o que falta.

Cada certificado tem código `GEO-XXXX-XXXX-XXXX` e uma assinatura HMAC dos seus campos imutáveis. `verify_certificate` devolve `valid`, `revoked`, `tampered` (registro alterado no disco) ou `not_found`. Verificação pela linha de comando:

```bash
node dist/index.js verify GEO-ABCD-1234-WXYZ   # JSON; código de saída 0 se válido, 1 se não
```

Ao emitir, o HTML do certificado também é gravado em `<GEO_DATA_DIR>/certificates/<código>.html` (todo texto dinâmico é escapado).

### Conquistas

Primeiros Passos · Desafiante · Perfeccionista · Em Chamas (3 dias seguidos) · Nível Concluído · Mestre da Trilha · Poliglota (3 tecnologias) · Meio Milhar (500 XP)

---

## 🧠 Arquitetura

```text
Cliente MCP / Assistente de IA
            │  stdio (JSON-RPC)
            ▼
   mcp/server.ts ──► tools.ts · resources.ts · prompts.ts      (camada de protocolo)
            │
            ▼
   container.ts  (injeção de dependências)
            │
   ┌────────┼───────────┬──────────────┬───────────────┐
   ▼        ▼           ▼              ▼               ▼
 Trail   Challenge   Progress     Certificate        Search
 Service  Service    Service       Service           Service
   │        │           │              │
   │        │           └──────┬───────┘
   ▼        ▼                  ▼
 data/*.json            storage/store.ts (JsonFileStore | MemoryStore)
```

Os serviços não conhecem o MCP nem o sistema de arquivos: recebem `Store`, relógio e RNG por injeção, o que torna os testes determinísticos. A camada MCP é fina e `tools.ts` é independente do SDK.

```text
src/
├── index.ts               CLI (servidor, verify, --help, --version)
├── config.ts · logger.ts · errors.ts · validation.ts · types.ts · version.ts
├── container.ts           monta os serviços (persistente ou em memória)
├── mcp/                   server · tools · resources · prompts
├── services/              trail · challenge · progress · certificate · search · achievements
├── storage/store.ts       gravação atômica em JSON
└── data/                  trails.json · challenges.json
tests/                     10 arquivos de teste · scripts/smoke.js (teste do protocolo stdio)
```

---

## 🚀 Como executar

Pré-requisitos: **Node.js 18.17+** e **npm**.

```bash
npm install
npm run dev          # desenvolvimento (tsx)
npm run build && npm start
```

> ℹ️ O servidor fala JSON-RPC **pelo stdout**. Por isso todos os logs vão para **stderr**, e a regra de lint `no-console` está ativa.

## ⚙️ Configuração

Variáveis de ambiente (veja `.env.example`):

| Variável | Padrão | Descrição |
| -------- | ------ | --------- |
| `GEO_DATA_DIR` | `~/.geo-explorer` | Pasta de dados (`progress.json`, `certificates.json`, `secret.key`). `:memory:` desativa a persistência |
| `GEO_CERT_SECRET` | gerado em `secret.key` (0600) | Segredo HMAC (≥ 16 caracteres) |
| `GEO_STRICT_CERTIFICATES` | `false` | Só emite certificados com conclusão comprovada |
| `GEO_PASS_SCORE` | `70` | Nota mínima (1–100) para aprovar um desafio |
| `GEO_LOG_LEVEL` | `info` | `debug` · `info` · `warn` · `error` · `silent` |
| `GEO_TIMEZONE` | `America/Sao_Paulo` | Fuso das datas nos certificados |

⚠️ **Faça backup de `secret.key`**: sem o mesmo segredo, certificados já emitidos passam a ser reportados como `tampered`.

## 🔗 Conectando a um cliente MCP

Exemplo para o **Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "geo-explorer": {
      "command": "node",
      "args": ["/caminho/absoluto/para/geo-explorer/dist/index.js"],
      "env": { "GEO_STRICT_CERTIFICATES": "true" }
    }
  }
}
```

## 🐳 Docker

```bash
docker build -t geo-explorer .
docker run -i --rm -v geo-data:/data geo-explorer          # servidor MCP (stdio)
docker run --rm -v geo-data:/data geo-explorer verify GEO-ABCD-1234-WXYZ
docker compose run --rm geo-explorer
```

A imagem é multi-stage, roda como usuário não-root e guarda os dados no volume `/data`.

---

## 🧪 Testes e qualidade

```bash
npm test                 # Jest (ts-jest)
npm run test:coverage
npm run lint && npm run typecheck
npm run build && npm run smoke   # sobe o servidor real e testa o protocolo via stdio
npm run verify           # lint + typecheck + testes + build
```

A suíte cobre: validação do catálogo, learning path, desafios e avaliação, progresso/XP/conquistas/streak, certificados (assinatura, adulteração, revogação, modo estrito, XSS), persistência atômica e arquivo corrompido, ferramentas/resources/prompts e a CLI. O `smoke` falha se qualquer linha do stdout não for JSON-RPC. O workflow `.github/workflows/ci.yml` roda tudo em Node 18, 20 e 22 e valida a imagem Docker.

## ⚠️ Limitações conhecidas

* **Sem autenticação**: quem controla o servidor controla os dados. Não exponha-o a usuários não confiáveis; o nome do usuário não é uma credencial.
* **A avaliação dos desafios é declarada pelo cliente** (`requirementsMet`); o servidor calcula nota e XP, mas não executa nem lê o código.
* **Persistência em JSON**: adequada para uso pessoal/local. Vários processos no mesmo diretório funcionam em "melhor esforço" (sem lock: o último a gravar vence).
* Um certificado só é verificável por quem tem acesso ao servidor/segredo; não há página pública de verificação.

## 🔮 Roadmap

Já entregue neste ciclo: persistência, usuários, progresso, conquistas, certificados com verificação assinada, novas trilhas e expansão do protocolo (resources/prompts/annotations).

Próximos passos naturais:

* 🗄️ Banco de dados (SQLite/PostgreSQL) atrás da interface `Store`;
* 🌐 Transporte HTTP (Streamable HTTP) com autenticação e página pública de verificação de certificados;
* 🧪 Quizzes com correção automática no servidor;
* 🤖 Desafios gerados por LLM;
* 📈 Mais trilhas (Go, SQL, Segurança, Mobile) e conteúdos/recursos de estudo por módulo;
* ⬆️ Migrar o SDK MCP para a série 1.x (`McpServer` + `zod`).

## 🎓 Contexto Acadêmico

Projeto desenvolvido como parte do **Bootcamp IBM Bob: IA de Nível Empresarial para Desenvolvedores e Tech Leaders**, aplicando conceitos de IA, agentes, ferramentas e Model Context Protocol ao desenvolvimento de software moderno.

## 📜 Licença

Este projeto está licenciado sob a licença **MIT**.

---

<div align="center">

### 🚀 Geo-Explorer

**Explorando conhecimento através de IA, ferramentas e desenvolvimento de software.**

</div>
<!-- pull-shark: 20260922-094330 -->
