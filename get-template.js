import fs from 'fs';

const storeUrl = process.env.SHOPIFY_STORE_URL || 'test-mcp-3.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || '';
const themeId = "146481414234";

async function run() {
  const tmplRes = await fetch(`https://${storeUrl}/admin/api/2024-10/themes/${themeId}/assets.json?asset[key]=templates/product.landing-DE.json`, {
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }
  });
  const data = await tmplRes.json();
  fs.writeFileSync('landing-DE-current.json', data.asset.value);
  console.log("Downloaded to landing-DE-current.json");
}
run();
