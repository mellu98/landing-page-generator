# Shopify Landing Page Generator (MCP Server)

Questo progetto permette di automatizzare completamente la creazione di Landing Page ad alta conversione su Shopify, partendo da un semplice link di AliExpress. Utilizza Claude (tramite il protocollo MCP - Model Context Protocol) per generare copy persuasivo (stile "Signora Market Copy") e Gemini/OpenRouter per creare immagini 1:1 ottimizzate per e-commerce (Lifestyle, Infografiche, Recensioni, ecc.).

L'infrastruttura è divisa in due parti:
1. **Server di Autenticazione (Render)**: Una semplice web app Express che permette a *chiunque* di connettere il proprio store Shopify e ottenere generare il Token di Accesso in 2 click.
2. **Server MCP (Locale)**: Il tool vero e proprio che Claude o Cursor utilizzano per leggere le istruzioni, generare le immagini e pushare la pagina su Shopify.

---

## 🚀 PARTE 1: Deploy del Server di Autenticazione (Render.com)

Se vuoi permettere ad altri utenti di usare l'MCP (o se non vuoi tenere il tuo PC acceso per ottenere i token), devi ospitare il file `server.js` su Render.

1. Vai su [Render.com](https://render.com) e crea un nuovo **Web Service**.
2. Collega questa repository GitHub (`https://github.com/mellu98/landing-page-generator.git`).
3. Imposta i seguenti parametri:
   - **Root Directory**: `service`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start-auth`oppure `node server.js`
4. Clicca su **Create Web Service**. Appena sarà online, chiunque potrà visitare l'URL di Render (es. `https://my-auth-server.onrender.com`) e seguire le istruzioni a schermo per ottenere il proprio Token Shopify!

> ⚠️ **IMPORTANTE PER SHOPIFY**: Quando crei la **Custom App** su Shopify (per ottenere Client ID e Client Secret), devi copiare l'URL del tuo server Render e aggiungerlo in Configuration > Allowed redirection URL(s) seguito da `/auth/callback` (es. `https://my-auth-server.onrender.com/auth/callback`).

---

## 🛠️ PARTE 2: Installazione del Server MCP (Locale)

Una volta ottenuto il token (`shpat_...`) dal server di autenticazione:

1. Clona questa repository sul computer dove userai Claude/Cursor:
   ```bash
   git clone https://github.com/mellu98/landing-page-generator.git
   cd landing-page-generator/service
   npm install
   ```

2. Crea o duplica il file `.mcp.json.example` in `.mcp.json` e inserisci le tue API Key:
   ```json
   {
     "mcpServers": {
       "landing-page-generator": {
         "command": "node",
         "args": ["/PERCORSO/ASSOLUTO/service/mcp-server.js"],
         "env": {
           "OPENAI_API_KEY": "sk-proj-...",
           "OPENROUTER_API_KEY": "sk-or-v1-..."
         }
       }
     }
   }
   ```
   *Nota: Il token Shopify e il dominio dello store non vanno nel JSON, ma vengono passati dinamicamente allo strumento come argomenti durante la chat!*

3. Collega `.mcp.json` a Claude Desktop o Cursor e inizia a chattare.

## 📝 Come usare l'Assistente

Per generare un nuovo prodotto, scrivi semplicemente a Claude:
> "Crea una nuova landing page per questo prodotto: [LINK ALIEXPRESS]. Il mio store è tuostore.myshopify.com e il mio token è shpat_..."

L'assistente farà **tutto** da solo:
- Visita e raschia AliExpress.
- Genera testi e traduzioni in JSON.
- Crea l'apposito Template "PagePilot".
- Genera 4-5 Immagini perfette (tramite `.landing-state.json` temporaneo e script automatizzati).
- Carica tutto su Shopify come **Bozza** pronta alla revisione.
