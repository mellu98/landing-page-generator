#!/bin/bash
# Landing Page Generator — Setup automatico

echo "=================================="
echo " Landing Page Generator — Setup"
echo "=================================="
echo ""

# 1. Installa dipendenze
echo "[1/3] Installazione dipendenze..."
cd service && npm install
cd ..

# 2. Crea .mcp.json se non esiste
if [ ! -f ".mcp.json" ]; then
  echo ""
  echo "[2/3] Configurazione API keys..."
  echo ""

  read -p "Inserisci la tua OPENAI_API_KEY (sk-proj-...): " OPENAI_KEY
  read -p "Inserisci la tua OPENROUTER_API_KEY (sk-or-v1-...): " OPENROUTER_KEY

  cat > .mcp.json << EOF
{
  "mcpServers": {
    "landing-page": {
      "command": "node",
      "args": ["service/mcp-server.js"],
      "env": {
        "OPENAI_API_KEY": "$OPENAI_KEY",
        "OPENROUTER_API_KEY": "$OPENROUTER_KEY"
      }
    }
  }
}
EOF
  echo "File .mcp.json creato!"
else
  echo "[2/3] .mcp.json già presente, skip."
fi

# 3. Verifica
echo ""
echo "[3/3] Verifica installazione..."
cd service
node -e "console.log('Node.js:', process.version)"
node -e "try { require('openai'); console.log('OpenAI SDK: OK') } catch(e) { console.log('OpenAI SDK: MANCANTE') }"
node -e "try { require('sharp'); console.log('Sharp: OK') } catch(e) { console.log('Sharp: MANCANTE') }"
node -e "try { require('@modelcontextprotocol/sdk/server/mcp.js'); console.log('MCP SDK: OK') } catch(e) { console.log('MCP SDK: MANCANTE') }"
cd ..

echo ""
echo "=================================="
echo " Setup completato!"
echo "=================================="
echo ""
echo "Prossimi passi:"
echo "1. Apri la cartella in VS Code o Antigravity"
echo "2. Se usi Claude Code, i tool MCP sono già pronti"
echo "3. Se usi Antigravity, carica i file dalla cartella skills/"
echo ""
echo "Comandi disponibili:"
echo "  /analyze-product    → Analizza prodotto AliExpress"
echo "  /create-landing     → Genera copy + template"
echo "  /generate-images    → Genera immagini AI"
echo "  /shopify-expert     → Gestione Shopify"
echo ""
