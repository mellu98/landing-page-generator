# Landing Page Generator

## Cos'è
Sistema MCP per generare landing page e-commerce ad alta conversione partendo da link AliExpress. Genera copy persuasivo italiano (stile "Signora Market Copy"), immagini AI, e pubblica tutto su Shopify con tema PagePilot.

## Setup rapido
1. `cd service && npm install`
2. Copia `.mcp.json.example` in `.mcp.json` e inserisci le tue API keys
3. Riavvia VS Code — i tool MCP saranno disponibili

## Flusso di lavoro
1. `analyze_product` → analizza prodotto da URL AliExpress
2. `generate_landing` → genera copy + template Shopify
3. `push_to_shopify` → pubblica su Shopify (serve store_url e access_token)
4. Genera immagini AI con OpenRouter e caricale nelle sezioni

## Comandi disponibili
- `/analyze-product` — Analizza prodotto AliExpress
- `/create-landing` — Genera copy + template
- `/generate-images` — Genera immagini AI
- `/shopify-expert` — Gestione Shopify

## Regole importanti
- Copy sempre in stile "Signora Market Copy": colloquiale, benefici concreti, mai generico
- Schema colori: nero (#000000) per pulsanti e accenti, mai rosa
- Immagini nelle sezioni: Product Photo → Benefits, Lifestyle → Image+Text 1, Social Proof → Percentage, How To → Image+Text 2, Infographic → prima immagine prodotto
- Template con `shopify://shop_images/` per immagini nelle sezioni, MAI URL CDN diretti
- Credenziali Shopify passate per richiesta, mai hardcoded
