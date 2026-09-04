#!/usr/bin/env node

console.log('🗺️ Geo-Explorer - Learning Platform');
console.log('=================================');
console.log('');

// Função para executar o servidor MCP
function startMCPServer() {
  console.log('🖥️ Iniciando servidor MCP...');
  console.log('📡 Aguardando conexões...');
  console.log('');

  // Importar e executar o servidor MCP
  import('./mcp/server.js')
    .then(() => {
      console.log('✅ Servidor MCP iniciado com sucesso!');
    })
    .catch((error) => {
      console.error('❌ Erro ao iniciar servidor MCP:', error);
    });
}

// Executar se for chamado diretamente (compatível com CommonJS)
if (require.main === module) {
  startMCPServer();
}

export { startMCPServer };
