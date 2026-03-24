const storeUrl = process.env.SHOPIFY_STORE_URL || 'test-mcp-3.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || '';
const themeId = "146481414234";

async function run() {
  const assetsRes = await fetch(`https://${storeUrl}/admin/api/2024-10/themes/${themeId}/assets.json`, {
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }
  });
  const data = await assetsRes.json();
  const locales = data.assets.filter(a => a.key.startsWith("locales/"));
  console.log("Locales found:", locales.map(l => l.key));

  if (locales.length > 0) {
    // let's fetch the default or italian one
    const itLocale = locales.find(l => l.key.includes("it.json")) || locales[0];
    const res = await fetch(`https://${storeUrl}/admin/api/2024-10/themes/${themeId}/assets.json?asset[key]=${itLocale.key}`, {
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }
    });
    const itData = await res.json();
    const str = itData.asset.value;
    if (str.includes("Prendine") || str.includes("risparmia")) {
      console.log(`Found string in ${itLocale.key}!`);
    } else {
      console.log(`Not found in ${itLocale.key}. Searching all settings_data.json...`);
      const setRes = await fetch(`https://${storeUrl}/admin/api/2024-10/themes/${themeId}/assets.json?asset[key]=config/settings_data.json`, {
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }
      });
      const setData = await setRes.json();
      if (setData.asset && setData.asset.value.includes("Prendine")) {
        console.log("Found in config/settings_data.json!");
      } else {
        console.log("Not found in settings_data.json either.");
      }
    }
  }
}
run();
