@echo off
echo ==================================
echo  Landing Page Generator - Setup
echo ==================================
echo.

:: 1. Installa dipendenze
echo [1/3] Installazione dipendenze...
cd service
call npm install
cd ..

:: 2. Crea .mcp.json se non esiste
if not exist ".mcp.json" (
    echo.
    echo [2/3] Configurazione API keys...
    echo.
    set /p OPENAI_KEY="Inserisci la tua OPENAI_API_KEY (sk-proj-...): "
    set /p OPENROUTER_KEY="Inserisci la tua OPENROUTER_API_KEY (sk-or-v1-...): "

    (
        echo {
        echo   "mcpServers": {
        echo     "landing-page": {
        echo       "command": "node",
        echo       "args": ["service/mcp-server.js"],
        echo       "env": {
        echo         "OPENAI_API_KEY": "%OPENAI_KEY%",
        echo         "OPENROUTER_API_KEY": "%OPENROUTER_KEY%"
        echo       }
        echo     }
        echo   }
        echo }
    ) > .mcp.json
    echo File .mcp.json creato!
) else (
    echo [2/3] .mcp.json gia presente, skip.
)

:: 3. Verifica
echo.
echo [3/3] Verifica installazione...
cd service
node -e "console.log('Node.js:', process.version)"
node -e "try { require('openai'); console.log('OpenAI SDK: OK') } catch(e) { console.log('OpenAI SDK: MANCANTE') }"
node -e "try { require('sharp'); console.log('Sharp: OK') } catch(e) { console.log('Sharp: MANCANTE') }"
cd ..

echo.
echo ==================================
echo  Setup completato!
echo ==================================
echo.
echo Prossimi passi:
echo 1. Apri la cartella in VS Code o Antigravity
echo 2. Se usi Claude Code, i tool MCP sono gia pronti
echo 3. Se usi Antigravity, carica i file dalla cartella skills/
echo.
pause
