import fs from 'fs';
import sharp from 'sharp';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const storeUrl = process.env.SHOPIFY_STORE_URL || 'test-mcp-3.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || '';
const themeId = "179965198447";
const refImageUrl = "https://cdn.shopify.com/s/files/1/0707/4670/1935/files/ChatGPT_Image_28_feb_2026_22_40_42.webp?v=1772763552";

const CATEGORY_PROMPTS = {
  1: `Generate a professional e-commerce product photo. Rules: packshot studio style, neutral background. No text. EXTREMELY IMPORTANT: The product must be the EXACT same product from the reference.`,
  2: `Generate a lifestyle e-commerce image showing the product in a realistic usage environment (wardrobe/closet). Rules: realistic setting, product sharp and faithful. ALL TEXT MUST BE IN GERMAN. Limit to <3 words if any. EXTREMELY IMPORTANT: Exact same product.`,
  4: `Generate an infographic-style e-commerce image for the product. Rules: 4 callout boxes highlighting key features (space saving, easy folding). ALL TEXT MUST BE STRICTLY IN GERMAN ONLY. Headline max 4 words. Benefits max 3 words each. Very clean design.`,
  5: `Generate a how-to/process image showing 3 steps for using the product (fold, stack, organize). Rules: panel layout, step numbering. ALL TEXT MUST BE STRICTLY IN GERMAN ONLY. Step descriptions max 4 words each.`,
  6: `Generate a social proof image with a customer review layout. Rules: review card design, 5 stars, trustworthy. ALL TEXT MUST BE STRICTLY IN GERMAN ONLY. Realistic German author name. Short German review text max 10 words.`
};

async function downloadBase64(url) {
  const r = await fetch(url);
  const buf = await r.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

async function generateImage(catId, refBase64) {
  const prompt = `You are an Ecommerce Visual Art Director. Generate a high-conversion 1:1 square e-commerce image.
Product context: Premium Hemden-Organizer (Kleiderschrank Organizer).
Category requirements: ${CATEGORY_PROMPTS[catId]}
CRITICAL: ALL TEXT IN THE IMAGE MUST BE IN GERMAN. NOT ENGLISH. NOT ITALIAN. GERMAN ONLY. NO JIBBERISH.
Use the attached product image as the EXACT reference. Generate the image now.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      modalities: ["text", "image"],
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/webp;base64,${refBase64}` } }
        ]
      }]
    })
  });
  
  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if(message && message.images && message.images.length > 0) {
    const url = message.images[0].image_url?.url || "";
    if (url.startsWith("data:image")) return url.split(",")[1];
  }
  return null;
}

async function uploadToTheme(assetKey, base64) {
  const res = await fetch(`https://${storeUrl}/admin/api/2024-10/themes/${themeId}/assets.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ asset: { key: assetKey, attachment: base64 } })
  });
  return await res.json();
}

async function createShopifyFile(cdnUrl, filename) {
  const query = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id fileErrors { message } }
        userErrors { field message }
      }
    }
  `;
  const res = await fetch(`https://${storeUrl}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables: { files: [{ originalSource: cdnUrl, contentType: "IMAGE", filename }] } })
  });
  return await res.json();
}

async function main() {
  console.log("Downloading reference image...");
  const refBase64 = await downloadBase64(refImageUrl);
  const mappedImages = {};
  
  for (const catId of [1, 2, 4, 5, 6]) {
    console.log(`Generating image category ${catId} (DE)...`);
    const b64 = await generateImage(catId, refBase64);
    if (!b64) { console.error(`Failed to generate ${catId}`); continue; }
    
    console.log(` Converting to WEBP...`);
    const webpBuffer = await sharp(Buffer.from(b64, "base64")).webp({ quality: 85 }).toBuffer();
    const webpBase64 = webpBuffer.toString('base64');
    
    const filename = `img-org-de-${catId}-${Date.now()}.webp`;
    const assetKey = `assets/${filename}`;
    
    console.log(` Uploading to theme assets ${assetKey}...`);
    const themeRes = await uploadToTheme(assetKey, webpBase64);
    
    console.log(` Registering file in GraphQL...`);
    await createShopifyFile(themeRes.asset.public_url, filename);
    mappedImages[catId] = `shopify://shop_images/${filename}`;
  }
  
  console.log("Fetching landing-DE.json from Shopify...");
  const tmplRes = await fetch(`https://${storeUrl}/admin/api/2024-10/themes/${themeId}/assets.json?asset[key]=templates/product.landing-DE.json`, {
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }
  });
  const data = await tmplRes.json();
  const template = JSON.parse(data.asset.value);
  
  const sections = template.sections;
  let imgTxtIndex = 0;
  for (const key of Object.keys(sections)) {
    const s = sections[key];
    if (s.type === 'pp-image-with-benefits-v1-0-0' && mappedImages[1]) {
      s.settings.image = mappedImages[1];
    } else if (s.type === 'pp-image-with-text-v1-0-0') {
      if (imgTxtIndex === 0 && mappedImages[2]) s.settings.image = mappedImages[2];
      if (imgTxtIndex === 1 && mappedImages[5]) s.settings.image = mappedImages[5];
      imgTxtIndex++;
    } else if (s.type === 'pp-image-with-percentage-v1-0-0' && mappedImages[6]) {
      s.settings.image = mappedImages[6];
    }
  }
  
  console.log("Uploading updated template with WEBP images...");
  await fetch(`https://${storeUrl}/admin/api/2024-10/themes/${themeId}/assets.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ asset: { key: "templates/product.landing-DE.json", value: JSON.stringify(template, null, 2) } })
  });
  
  console.log("Done!");
}
main().catch(console.error);
