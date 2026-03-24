import express from 'express';
import cookieParser from 'cookie-parser';
import fetch from 'node-fetch'; // Polyfill for Node 16/17 if needed, otherwise native fetch in Node 18+

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Render provides PORT securely
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: Arial; padding: 40px; max-width: 500px; margin: auto; line-height: 1.6;">
        <h2 style="color: #4CAF50;">Shopify MCP Access Token Generator</h2>
        <p>Inserisci i dettagli della tua <strong>Custom App</strong> per ottenere l'Access Token (<code>shpat_...</code>). Questo servizio ti serve solo la prima volta.</p>
        
        <form method="POST" action="/auth">
          <div><label style="font-weight: bold;">Store URL (es. test-mcp.myshopify.com):</label><br/><input type="text" name="shop" placeholder="test-mcp.myshopify.com" required style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border-radius: 5px; border: 1px solid #ccc;"/></div>
          <div><label style="font-weight: bold;">Client ID:</label><br/><input type="text" name="clientId" required style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border-radius: 5px; border: 1px solid #ccc;"/></div>
          <div><label style="font-weight: bold;">Client Secret:</label><br/><input type="password" name="clientSecret" required style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border-radius: 5px; border: 1px solid #ccc;"/></div>
          <button type="submit" style="width: 100%; padding:12px 20px; background:#000; color:#fff; border:none; cursor:pointer; font-size: 16px; font-weight: bold; border-radius: 5px;">🔥 Autorizza su Shopify</button>
        </form>
        
        <div style="background: #fdfdfd; padding: 15px; border: 1px dashed #ccc; margin-top: 30px; font-size: 13px;">
          <p>⚠️ <strong>IMPORTANTE:</strong><br/>
          Assicurati di aver impostato questi <strong>Allowed redirection URL(s)</strong> nella pagina della tua App su Shopify (Configuration > URLs):</p>
          <code style="word-break: break-all; background: #eef; padding: 5px; border-radius: 3px; display: block; margin-top: 10px;" id="redirectUrlPlace"></code>
          <script>
            document.getElementById('redirectUrlPlace').innerText = window.location.origin + "/auth/callback";
          </script>
        </div>
      </body>
    </html>
  `);
});

app.post('/auth', (req, res) => {
  let { shop, clientId, clientSecret } = req.body;
  
  if (!shop || !clientId || !clientSecret) return res.status(400).send("Dati mancanti");
  shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, ''); // sanitize shop url

  res.cookie('shopify_credentials', { clientId, clientSecret }, { maxAge: 600000 }); // 10 minutes

  // Build the callback fully qualified url
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const redirectUri = `${protocol}://${host}/auth/callback`;

  // Request all necessary scopes for the PagePilot MCP tool
  const scopes = "write_products,read_products,write_themes,read_themes,write_files,read_files,write_content,read_content,unauthenticated_read_content";
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
  
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code, shop } = req.query;
  const cookieData = req.cookies.shopify_credentials;

  if (!code || !shop || !cookieData) {
    return res.status(400).send("Parametri o cookie session mancanti. Assicurati di non avere estensioni che bloccano i cookie. Riprova tornando alla homepage.");
  }

  const { clientId, clientSecret } = cookieData;

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    
    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        return res.status(400).send(`Shopify API error (${tokenResponse.status}): ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.access_token) {
      res.send(`
        <html><body style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: auto;">
          <h2 style="color: #4CAF50;">✅ Autenticazione Completata!</h2>
          <p>Ecco il tuo <strong>Admin API Access Token</strong> definitivo per il negozio <b>${shop}</b>:</p>
          <div style="background: #f4f4f4; padding: 20px; font-family: monospace; font-size: 20px; border: 1px solid #ddd; margin: 20px 0; border-radius: 8px;">
            ${tokenData.access_token}
          </div>
          <p style="font-size: 14px; line-height: 1.5;"> Copia questo token ed incollalo nel tuo file <code>.mcp.json</code> (del Server o Claude Desktop) per iniziare! Puoi chiudere questa finestra. </p>
          <a href="/" style="display:inline-block; margin-top:20px; padding: 10px 20px; background: #eee; color: #333; text-decoration: none; border-radius: 5px;">Torna alla Home</a>
        </body></html>
      `);
    } else {
      res.status(400).send(`Errore Shopify: ${JSON.stringify(tokenData)}`);
    }
  } catch (err) {
    res.status(500).send("Errore server interno: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Auth Server running! Accessible on port ${PORT}`);
});
