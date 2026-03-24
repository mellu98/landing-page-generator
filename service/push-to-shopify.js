import fs from 'fs';
import * as shopify from './shopify-client.js';

async function push() {
  try {
    const state = JSON.parse(fs.readFileSync('.landing-state.json', 'utf8'));
    const storeUrl = process.env.SHOPIFY_STORE_URL || 'your-store.myshopify.com';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';
    
    console.log(`Pushing to Shopify...`);
    const result = await shopify.fullImport(
      storeUrl,
      accessToken,
      state.productData,
      state.copyData,
      state.templateName,
      state.template
    );
    console.log("Success!");
    console.log(JSON.stringify(result, null, 2));
  } catch(e) {
    console.error("Error pushing to Shopify:", e);
  }
}

push();
