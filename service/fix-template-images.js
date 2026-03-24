import fs from 'fs';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'your-store.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

async function shopifyFetch(p, options = {}) {
  const res = await fetch(`https://${STORE_URL}/admin/api/2024-10/${p}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shopify API error (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const state = JSON.parse(fs.readFileSync('.landing-state.json', 'utf8'));

  // The CDN URLs from the uploads - extract filenames for shopify://shop_images/ format
  const imageMap = {
    'image_with-text_zum12o': 'shopify://shop_images/lifestyle-1774233223374_cc2997b0-fcee-412f-b92f-7c4188e8c9c2.jpg',
    'image_with-benefits_v7x5yh': 'shopify://shop_images/product-photo-1774233206192_288ae3fb-1da6-4c25-a842-3959da9db5ea.png',
    'image_with-percentage_8c1rn2': 'shopify://shop_images/social-proof-1774233242832_563586a7-bbed-4d14-9265-8264d7aef9fa.jpg',
    'image_with-text_bdhz4y': 'shopify://shop_images/how-to-process-1774233259523_19978040-7870-42ce-b978-7042371117c4.jpg',
  };

  // Update template sections
  for (const [sectionId, imageRef] of Object.entries(imageMap)) {
    if (state.template.sections[sectionId]?.settings) {
      state.template.sections[sectionId].settings.image = imageRef;
      console.log(`Set ${sectionId} -> ${imageRef}`);
    }
  }

  // Re-upload template
  console.log('\nRe-uploading template to theme...');
  const themes = await shopifyFetch('themes.json');
  const activeTheme = themes.themes.find(t => t.role === 'main');
  if (!activeTheme) throw new Error('No active theme');

  const assetKey = `templates/product.${state.templateName}.json`;
  const result = await shopifyFetch(`themes/${activeTheme.id}/assets.json`, {
    method: 'PUT',
    body: JSON.stringify({
      asset: {
        key: assetKey,
        value: JSON.stringify(state.template, null, 2),
      },
    }),
  });

  console.log(`✅ Template updated: ${assetKey}`);

  // Save state
  fs.writeFileSync('.landing-state.json', JSON.stringify(state, null, 2), 'utf8');
  console.log('State saved.');
}

main().catch(console.error);
