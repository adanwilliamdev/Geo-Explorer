# 🗺️ Geo-Explorer

Ferramenta interativa de exploração de trilhas de aprendizagem, construída como um **servidor MCP (Model Context Protocol)** em Node.js + TypeScript.

Projeto desenvolvido no **VBootcamp IBM Bob: IA de Nível Empresarial para Desenvolvedores e Tech Leaders**.

## ✨ O que o projeto faz

O Geo-Explorer expõe, via protocolo MCP, um conjunto de ferramentas que permitem a um assistente de IA (ou qualquer cliente MCP) ajudar alguém a estudar uma tecnologia do zero:

- consultar uma **trilha de aprendizagem** (módulos, níveis, descrição);
- gerar **desafios práticos** de código por tecnologia e nível;
- **emitir certificados** de conclusão; e
- **verificar/revogar** certificados emitidos.

Tecnologias de trilha disponíveis atualmente: `java`, `node`, `react` e `python`.

## 🧱 Stack

- Node.js + TypeScript
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) (servidor MCP via stdio)
- Jest + ts-jest (testes)
- ESLint + Prettier (qualidade de código)

## 📂 Estrutura do projeto

```
src/
├── index.ts                    # Ponto de entrada; inicializa o servidor MCP
├── mcp/
│   └── server.ts                # Definição do servidor MCP e registro das ferramentas
├── services/
│   ├── trailService.ts          # Regras de negócio das trilhas de aprendizagem
│   ├── challengeService.ts      # Geração de desafios práticos
│   └── certificateService.ts    # Emissão, verificação e revogação de certificados
└── data/
    └── trails.json               # Dados das trilhas (módulos, níveis, descrições)
tests/
├── trail.test.ts
├── challenge.test.ts
└── certificate.test.ts
```

## 🔧 Ferramentas MCP disponíveis

| Ferramenta | Descrição | Parâmetros |
|---|---|---|
| `get_trail` | Retorna os detalhes de uma trilha | `tech` |
| `generate_challenge` | Gera um desafio prático | `tech`, `level` |
| `issue_certificate` | Emite um certificado de conclusão | `userName`, `tech`, `level?` |
| `verify_certificate` | Verifica a autenticidade de um certificado | `certificateId` |
| `list_technologies` | Lista todas as tecnologias com trilha disponível | — |

## 🚀 Como rodar

### Pré-requisitos

- Node.js 18+
- npm

### Instalação

```bash
npm install
```

### Modo desenvolvimento (com hot-reload via tsx)

```bash
npm run dev
```

### Build de produção

```bash
npm run build
npm start
```

O servidor MCP roda sobre **stdio**, então ele é pensado para ser conectado a partir de um cliente MCP (ex.: Claude Desktop, um agente próprio, etc.) e não gera saída interativa no terminal além dos logs de inicialização.

### Testes

```bash
npm test          # roda a suíte de testes uma vez
npm run test:watch # roda em modo watch
```

### Lint e formatação

```bash
npm run lint
npm run format
```

## 🩹 Correções aplicadas nesta revisão

O código enviado continha alguns problemas que impediam a compilação e a execução dos testes. Veja o que foi corrigido:

1. **`src/services/certificateService.ts` estava vazio.** O arquivo era importado por `mcp/server.ts` e pelos testes (`tests/certificate.test.ts`), mas não existia nenhuma implementação. Foi criada a classe `CertificateService`, com `issueCertificate`, `verifyCertificate`, `revokeCertificate` e `listCertificates`, incluindo geração de HTML e arte ASCII do certificado — tudo compatível com o que os testes já esperavam.
2. **Template strings quebradas (crases perdidas).** Em `src/index.ts`, `src/mcp/server.ts`, `src/services/trailService.ts` e `src/services/challengeService.ts`, diversas mensagens de erro e IDs dinâmicos haviam perdido as crases (`` ` ``) e os `${...}`, virando código JavaScript inválido (ex.: `throw new Error(Trilha não encontrada para tecnologia: );`). Todas foram reescritas como template literals válidos.
3. **String malformada em `challengeService.ts`.** A dica `'Use a chave 'uuid' para identificar itens'` usava aspas simples aninhadas dentro de uma string de aspas simples, fechando a string prematuramente e quebrando a sintaxe. Corrigida para usar aspas duplas internas.
4. **`import.meta.url` incompatível com o `tsconfig.json`.** O `tsconfig.json` usa `"module": "commonjs"`, mas `src/index.ts` usava `import.meta.url` (uma API exclusiva de ES Modules), o que quebra a compilação nesse modo. A checagem de "executado diretamente" foi reescrita para o equivalente em CommonJS: `require.main === module`.
5. **Codificação e finais de linha inconsistentes.** Vários arquivos (`.ts` e `.json`) tinham um BOM (`\uFEFF`) no início e finais de linha `CRLF`. Isso foi normalizado para UTF-8 sem BOM e `LF`, evitando problemas de parsing em algumas ferramentas.
6. **Configurações de projeto ausentes.** Não havia `.eslintrc` (necessário para o script `npm run lint`) nem `.gitignore` (o que faria `node_modules/` e `dist/` irem para o controle de versão). Ambos foram adicionados.

Após as correções, `npx tsc --noEmit`, `npm run build`, `npm run lint` e `npm test` executam sem erros (18/18 testes passando).

## 📜 Licença

MIT
