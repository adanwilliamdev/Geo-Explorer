#!/usr/bin/env node
/**
 * Teste de fumaça do servidor MCP via stdio (sem dependências).
 * Uso: npm run build && npm run smoke
 * Verifica o handshake, tools/resources/prompts e, principalmente, que o stdout só contém JSON-RPC.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (!process.env.SMOKE_CMD && !fs.existsSync(path.join(__dirname, '..', 'dist', 'index.js'))) {
  console.error('✘ dist/index.js não encontrado. Rode "npm ci" e "npm run build" antes do smoke.');
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-smoke-'));
const options = {
  env: { ...process.env, GEO_DATA_DIR: dataDir, GEO_LOG_LEVEL: 'warn' },
  stdio: ['pipe', 'pipe', 'inherit'],
};
// Por padrão usa o próprio Node (process.execPath), seguro com espaços no caminho (ex.: "C:\\Program Files").
// SMOKE_CMD permite apontar outro comando, executado via shell (ex.: "npx tsx src/index.ts").
const child = process.env.SMOKE_CMD
  ? spawn(process.env.SMOKE_CMD, { ...options, shell: true })
  : spawn(process.execPath, ['dist/index.js'], options);
child.on('exit', (code) => {
  if (code !== null && code !== 0 && pending.size > 0) {
    console.error(`✘ o servidor encerrou inesperadamente (código ${code}); veja o erro acima`);
    process.exit(1);
  }
});
child.on('error', (e) => {
  console.error(`✘ não foi possível iniciar o servidor: ${e.message}`);
  process.exit(1);
});

const pending = new Map();
const nonJson = [];
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      nonJson.push(line);
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) pending.get(msg.id)(msg);
  }
});

let nextId = 1;
const send = (obj) => child.stdin.write(`${JSON.stringify(obj)}\n`);
const request = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => reject(new Error(`timeout em ${method}`)), 10000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
    });
    send({ jsonrpc: '2.0', id, method, params });
  });

const checks = [];
const check = (name, ok) => {
  checks.push(ok);
  console.log(`${ok ? '✔' : '✘'} ${name}`);
};

(async () => {
  const init = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '1.0.0' },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  check(`initialize (${init.serverInfo.name} v${init.serverInfo.version})`, init.serverInfo.name === 'geo-explorer');

  const tools = (await request('tools/list')).tools;
  check(`tools/list (${tools.length} ferramentas)`, tools.length === 15);

  const call = async (name, args) => {
    const r = await request('tools/call', { name, arguments: args });
    const body = r.content[0].text;
    return { isError: r.isError === true, data: r.isError ? null : JSON.parse(body) };
  };
  const techs = await call('list_technologies', {});
  check('list_technologies', techs.data.technologies.includes('java'));

  await call('enroll', { userName: 'Smoke Test', tech: 'java' });
  const mod = await call('complete_module', { userName: 'Smoke Test', moduleId: 'java-sintaxe-basica' });
  check('complete_module concede XP', mod.data.xpEarned === 60);

  const cert = await call('issue_certificate', { userName: 'Smoke Test', tech: 'java' });
  const ver = await call('verify_certificate', { certificateId: cert.data.certificate.id });
  check('issue + verify_certificate', ver.data.valid === true);

  const bad = await request('tools/call', { name: 'get_trail', arguments: { tech: 'cobol' } });
  check('erro de domínio retorna isError', bad.isError === true);

  check('resources/list', (await request('resources/list')).resources.length === 7);
  const md = await request('resources/read', { uri: 'geo://trails/java' });
  check('resources/read', md.contents[0].text.includes('Trilha Java'));
  check('prompts/list', (await request('prompts/list')).prompts.length === 3);
  const prompt = await request('prompts/get', { name: 'explain_module', arguments: { moduleId: 'java-poo' } });
  check('prompts/get', prompt.messages[0].content.text.includes('POO'));

  check('stdout contém apenas JSON-RPC', nonJson.length === 0);
  if (nonJson.length) console.error('Linhas inválidas no stdout:', nonJson);
})()
  .catch((e) => {
    console.error(`✘ ${e.message}`);
    checks.push(false);
  })
  .finally(() => {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
    process.exit(checks.length > 0 && checks.every(Boolean) ? 0 : 1);
  });
