# 🗺️ Geo-Explorer

### Servidor MCP para Trilhas de Aprendizagem com IA

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-licença)
[![Tests](https://img.shields.io/badge/tests-jest-C21325?logo=jest&logoColor=white)](#-testes)

Ferramenta interativa de exploração de trilhas de aprendizagem, desenvolvida como um **servidor MCP (Model Context Protocol)** utilizando **Node.js + TypeScript**.

O projeto foi desenvolvido durante o **Bootcamp IBM Bob: IA de Nível Empresarial para Desenvolvedores e Tech Leaders**, explorando a integração entre servidores MCP, ferramentas inteligentes e assistentes de IA.

---

## 📑 Índice

* [Sobre o projeto](#-sobre-o-projeto)
* [Arquitetura](#-arquitetura)
* [Stack Tecnológica](#-stack-tecnológica)
* [Estrutura do Projeto](#-estrutura-do-projeto)
* [Ferramentas MCP](#-ferramentas-mcp)
* [Como executar](#-como-executar)
* [Conectando a um cliente MCP](#-conectando-a-um-cliente-mcp)
* [Testes](#-testes)
* [Qualidade de Código](#-qualidade-de-código)
* [Licença](#-licença)

---

## ✨ Sobre o projeto

O **Geo-Explorer** disponibiliza, através do protocolo MCP, um conjunto de ferramentas que permite a um assistente de IA ou cliente MCP auxiliar usuários durante sua jornada de aprendizado em diferentes tecnologias.

A plataforma permite:

* 📚 Consultar trilhas de aprendizagem;
* 🧩 Explorar módulos, níveis e descrições;
* 💻 Gerar desafios práticos de programação;
* 🏆 Emitir certificados de conclusão;
* 🔎 Verificar a autenticidade de certificados;
* 🚫 Revogar certificados;
* 🛠️ Listar todas as tecnologias disponíveis.

### Tecnologias disponíveis

Atualmente, o Geo-Explorer possui trilhas para:

* ☕ Java
* 🟢 Node.js
* ⚛️ React
* 🐍 Python

---

## 🧠 Arquitetura

O projeto utiliza uma arquitetura organizada por responsabilidades, separando a camada de comunicação MCP das regras de negócio.

```text
Cliente MCP / Assistente de IA
            │
            ▼
     ┌───────────────┐
     │  MCP Server   │
     └───────┬───────┘
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
  Services          Tools
     │
     ├── Trail Service
     ├── Challenge Service
     └── Certificate Service
             │
             ▼
          Data
       trails.json
```

O servidor utiliza **stdio** como mecanismo de comunicação, permitindo integração com clientes MCP compatíveis.

---

## 🧱 Stack Tecnológica

| Tecnologia     | Utilização                              |
| -------------- | --------------------------------------- |
| **Node.js**    | Runtime da aplicação                    |
| **TypeScript** | Linguagem principal                     |
| **MCP SDK**    | Implementação do Model Context Protocol |
| **Jest**       | Testes automatizados                    |
| **ts-jest**    | Integração Jest + TypeScript            |
| **ESLint**     | Análise e qualidade do código           |
| **Prettier**   | Formatação do código                    |
| **JSON**       | Armazenamento das trilhas               |

---

## 📂 Estrutura do Projeto

```text
src/
├── index.ts
│
├── mcp/
│   └── server.ts
│
├── services/
│   ├── trailService.ts
│   ├── challengeService.ts
│   └── certificateService.ts
│
└── data/
    └── trails.json

tests/
├── trail.test.ts
├── challenge.test.ts
└── certificate.test.ts
```

### Principais componentes

**`index.ts`**
Ponto de entrada da aplicação e inicialização do servidor MCP.

**`mcp/server.ts`**
Configuração do servidor MCP e registro das ferramentas disponíveis.

**`trailService.ts`**
Responsável pelas regras relacionadas às trilhas de aprendizagem.

**`challengeService.ts`**
Responsável pela geração dos desafios práticos.

**`certificateService.ts`**
Gerencia emissão, consulta, verificação e revogação de certificados.

**`trails.json`**
Contém os dados estruturados das trilhas de aprendizagem.

---

# 🔧 Ferramentas MCP

O Geo-Explorer disponibiliza as seguintes ferramentas através do protocolo MCP:

| Ferramenta           | Descrição                                  | Parâmetros                   |
| -------------------- | ------------------------------------------ | ---------------------------- |
| `get_trail`          | Retorna os detalhes de uma trilha          | `tech`                       |
| `generate_challenge` | Gera um desafio prático                    | `tech`, `level`              |
| `issue_certificate`  | Emite um certificado de conclusão          | `userName`, `tech`, `level?` |
| `verify_certificate` | Verifica a autenticidade de um certificado | `certificateId`              |
| `list_technologies`  | Lista as tecnologias disponíveis           | —                            |

---

## 🔄 Fluxo de utilização

Um exemplo de fluxo utilizando o Geo-Explorer:

```text
1. Usuário escolhe uma tecnologia
              │
              ▼
2. IA consulta a trilha
              │
              ▼
3. Usuário escolhe seu nível
              │
              ▼
4. IA gera um desafio prático
              │
              ▼
5. Usuário conclui os estudos
              │
              ▼
6. Certificado é emitido
              │
              ▼
7. Certificado pode ser verificado
```

---

# 🚀 Como executar

## 📋 Pré-requisitos

Antes de iniciar, certifique-se de possuir:

* **Node.js 18+**
* **npm**

---

## 📥 Instalação

Clone o repositório e instale as dependências:

```bash
npm install
```

---

## 🛠️ Desenvolvimento

Para executar o projeto em modo de desenvolvimento:

```bash
npm run dev
```

O projeto utiliza `tsx` para execução do código TypeScript durante o desenvolvimento.

---

## 📦 Build de produção

Compile o projeto:

```bash
npm run build
```

Depois execute a aplicação:

```bash
npm start
```

O servidor MCP utiliza **stdio** para comunicação e foi projetado para ser integrado a clientes MCP compatíveis, como assistentes de IA, agentes personalizados e outras aplicações que suportem o protocolo.

---

# 🔗 Conectando a um cliente MCP

Por usar **stdio**, o Geo-Explorer pode ser registrado em qualquer cliente compatível com MCP. Exemplo de configuração para o **Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "geo-explorer": {
      "command": "node",
      "args": ["/caminho/absoluto/para/geo-explorer/dist/index.js"]
    }
  }
}
```

Após buildar o projeto (`npm run build`) e reiniciar o cliente, as ferramentas `get_trail`, `generate_challenge`, `issue_certificate`, `verify_certificate` e `list_technologies` ficam disponíveis para o assistente de IA.

---

# 🧪 Testes

Execute a suíte de testes:

```bash
npm test
```

Para executar os testes em modo de observação:

```bash
npm run test:watch
```

O projeto possui testes automatizados para:

* Trilhas de aprendizagem;
* Geração de desafios;
* Emissão e gerenciamento de certificados.

---

# 🧹 Qualidade de Código

Para executar a análise estática:

```bash
npm run lint
```

Para formatar o código:

```bash
npm run format
```

---

# 🔌 Integração com MCP

O **Model Context Protocol (MCP)** permite que aplicações de IA interajam de forma padronizada com ferramentas e fontes de dados externas.

Neste projeto, o servidor MCP funciona como uma camada de ferramentas que permite ao assistente de IA consultar trilhas, gerar desafios e gerenciar certificados.

```text
┌─────────────────────────────┐
│      Assistente de IA       │
└──────────────┬──────────────┘
               │
               │ MCP / stdio
               ▼
┌─────────────────────────────┐
│       Geo-Explorer          │
│         MCP Server          │
├─────────────────────────────┤
│ • get_trail                 │
│ • generate_challenge        │
│ • issue_certificate         │
│ • verify_certificate        │
│ • list_technologies         │
└─────────────────────────────┘
```

Essa abordagem permite separar a inteligência do cliente da implementação das ferramentas, facilitando futuras extensões e integrações.

---

# 🎯 Objetivos do Projeto

O Geo-Explorer foi desenvolvido com foco em:

* Explorar o **Model Context Protocol**;
* Desenvolver servidores MCP utilizando TypeScript;
* Criar ferramentas consumíveis por agentes de IA;
* Aplicar separação de responsabilidades;
* Implementar testes automatizados;
* Trabalhar com arquitetura modular;
* Integrar conceitos de IA e desenvolvimento de software.

---

# 🔮 Possíveis Evoluções

Entre as possibilidades de evolução do projeto estão:

* 🌐 Persistência dos dados em banco de dados;
* 👤 Sistema de usuários;
* 📊 Dashboard de progresso;
* 🏅 Sistema de níveis e conquistas;
* 🤖 Geração de desafios utilizando LLMs;
* 📝 Avaliação automática de respostas;
* 🔐 Autenticação e autorização;
* 📜 Certificados com validação pública;
* ☁️ Deploy em ambiente cloud;
* 🔌 Integração com outros clientes MCP;
* 📚 Expansão das trilhas para novas tecnologias.

---

# 🎓 Contexto Acadêmico

Projeto desenvolvido como parte do:

**Bootcamp IBM Bob: IA de Nível Empresarial para Desenvolvedores e Tech Leaders**

O projeto teve como objetivo aplicar conceitos relacionados a **Inteligência Artificial, agentes, ferramentas e Model Context Protocol**, conectando esses conceitos ao desenvolvimento de software moderno.

---

# 📜 Licença

Este projeto está licenciado sob a licença **MIT**.

---

<div align="center">

### 🚀 Geo-Explorer

**Explorando conhecimento através de IA, ferramentas e desenvolvimento de software.**

</div>
