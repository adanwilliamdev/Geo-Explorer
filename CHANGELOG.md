# Changelog

## 2.0.0

### Correções
- **Protocolo**: o ponto de entrada usava `console.log` (stdout), o que corrompia o JSON-RPC do transporte stdio. Logs agora vão somente para stderr e a regra `no-console` impede regressões.
- **`verify_certificate`** sempre retornava `valid: true`, inclusive para certificados revogados. Agora distingue `valid`, `revoked`, `tampered` e `not_found`.
- **XSS** no HTML do certificado: todo texto dinâmico passa por escape.
- IDs de certificado deixaram de usar `Math.random()` (agora `crypto`, base32 sem caracteres ambíguos) e os certificados são assinados com HMAC-SHA256.
- `issue_certificate` não aceita mais trilha/nível inexistentes nem nomes com caracteres de controle.
- `generateMultipleChallenges` não normalizava a tecnologia; IDs de desafio deixaram de conter timestamp (agora são estáveis).
- O SDK MCP 0.5.x é somente ESM e o projeto compila para CommonJS: o servidor falhava com `ERR_REQUIRE_ESM` no Node 18/20. O SDK agora é carregado por `import()` nativo (caminho absoluto resolvido com `require.resolve`), e o `smoke` do CI cobre esse caso.
- `server.ts` não inicia mais ao ser importado; `lint`/`format` com glob que não expandia subpastas.

### Novidades
- Persistência em JSON com gravação atômica, e segredo de assinatura persistente (`secret.key`, 0600).
- Usuários, progresso, XP, ranks, streak e 8 conquistas.
- `submit_challenge` (avaliação por requisitos), `enroll`, `complete_module`, `get_progress`, `recommend_next`, `get_learning_path`, `search_content`, `revoke_certificate`, `list_certificates`, `delete_user_data`.
- Certificados com base `verified`/`self-declared` e modo estrito (`GEO_STRICT_CERTIFICATES`).
- Trilhas TypeScript e DevOps; níveis avançados para Node.js e Python; 21 desafios (antes 10), agora em `challenges.json`.
- Catálogo com módulos estruturados (id, nível, horas, tópicos, pré-requisitos) e validação na inicialização; aliases e sugestões de correção.
- MCP resources (`geo://trails…`), prompts e *annotations* nas ferramentas.
- CLI: `verify <código>`, `--help`, `--version`.
- Docker com volume de dados, CI (Node 18/20/22) e Dependabot; `npm run smoke`.

### Mudanças que podem afetar integrações
- O campo `modules` de `get_trail` continua sendo a lista de nomes; os detalhes estão em `moduleDetails`.
- Node.js e Python passam a ter o nível `avancado`; `list_technologies` retorna também `trails`.
- `verify_certificate` para um código inexistente deixa de ser erro e retorna `status: "not_found"`.
- `issue_certificate` é idempotente (retorna o certificado existente com `alreadyIssued: true`).
- Removida a dependência `dotenv` (não era usada); configuração apenas por variáveis de ambiente.
