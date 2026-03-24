import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function convertLandingImages(storeUrl, storeToken, templateName) {
  // Helpers
  async function apiFetch(p, options = {}) {
    const res = await fetch(`https://${storeUrl}/admin/api/2024-10/${p}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': storeToken,
        ...options.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Shopify API error (${res.status}): ${JSON.stringify(data)}`);
    return data;
  }

  async function gql(query, variables = {}) {
    const res = await fetch(`https://${storeUrl}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': storeToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    return data;
  }

  // Find active theme and get template asset
  console.log('Fetching active theme...');
  const themes = await apiFetch('themes.json');
  const activeTheme = themes.themes.find(t => t.role === 'main');
  if (!activeTheme) throw new Error('Nessun tema attivo trovato.');

  let targetTemplateName = templateName;
  if (!targetTemplateName) {
    const statePath = path.join(__dirname, '.landing-state.json');
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state.templateName) targetTemplateName = state.templateName;
    }
  }

  if (!targetTemplateName) {
    throw new Error("Impossibile determinare il nome del template da convertire. Specificalo nei parametri.");
  }

  const assetKey = `templates/product.${targetTemplateName}.json`;
  console.log(`Fetching template asset: ${assetKey}...`);
  let assetData;
  try {
    const assetRes = await apiFetch(`themes/${activeTheme.id}/assets.json?asset[key]=${assetKey}`);
    assetData = assetRes.asset;
  } catch (err) {
    throw new Error(`Template non trovato: ${assetKey}`);
  }

  const template = JSON.parse(assetData.value);
  console.log('[DEBUG] Sections keys:', Object.keys(template.sections || {}));
  const imagesToConvert = [];

  function findImagesRecursive(node) {
    if (!node || typeof node !== 'object') return;
    
    if (node.settings) {
      for (const [key, val] of Object.entries(node.settings)) {
        if (typeof val === 'string' && val.trim() !== '') {
          // Debug everything that is a string
          if (val.includes('http') || val.includes('shopify://') || val.includes('.png') || val.includes('.jpg')) {
            console.log(`[DEBUG] Checking key=${key}, val=${val}`);
          }
          
          // Ampliamo il controllo della chiave: image, icon, picture, background, url
          const keyLower = key.toLowerCase();
          const isImageKey = keyLower.includes('image') || keyLower.includes('icon') || keyLower.includes('picture') || keyLower.includes('background') || keyLower.includes('url') || keyLower.includes('logo');
          
          if (isImageKey || val.startsWith('shopify://')) {
            const isWebp = val.toLowerCase().endsWith('.webp') || val.toLowerCase().includes('.webp?');
            const isUrlOrShopify = val.startsWith('http') || val.startsWith('shopify://') || val.startsWith('//');
            
            // If it's a URL/ShopifyRef OR it has an image extension
            const isImageExt = /\.(png|jpe?g|gif)(\?.*)?$/i.test(val);
            
            if ((isUrlOrShopify || isImageExt) && !isWebp) {
              console.log(`[DEBUG] -> ADDED TO CONVERT: ${val}`);
              imagesToConvert.push({ settingsObj: node.settings, key: key, url: val });
            }
          }
        }
      }
    }
    
    for (const val of Object.values(node)) {
      if (typeof val === 'object') {
        findImagesRecursive(val);
      }
    }
  }

  findImagesRecursive(template.sections);

  if (imagesToConvert.length === 0) {
    return { success: true, message: "Non ci sono immagini da convertire o sono già in formato adatto." };
  }

  console.log(`Trovate ${imagesToConvert.length} immagini da convertire:`, imagesToConvert.map(i => i.url));

  const convertedUrls = [];
  const tmpDir = path.join(__dirname, 'tmp_images');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  for (const imgRef of imagesToConvert) {
    let downloadUrl = imgRef.url;
    let filename = '';

    if (downloadUrl.startsWith('shopify://shop_images/')) {
      filename = downloadUrl.split('/').pop().split('?')[0];
      // Ottieni l'url del file tramite GraphQL
      const query = `query { files(first: 1, query: "filename:${filename}") { edges { node { ... on MediaImage { image { url } } ... on GenericFile { url } } } } }`;
      const result = await gql(query);
      const edge = result.data?.files?.edges?.[0];
      if (edge && edge.node) {
        downloadUrl = edge.node.image?.url || edge.node.url;
      } else {
        console.warn(`File ${filename} non trovato su Shopify. Skip.`);
        continue;
      }
    } else {
      filename = downloadUrl.split('/').pop().split('?')[0];
    }

    if (filename.toLowerCase().endsWith('.webp')) continue;

    console.log(`Downloading ${filename} from ${downloadUrl}...`);
    const docRes = await fetch(downloadUrl);
    if (!docRes.ok) throw new Error(`Failed to download ${downloadUrl}`);
    const buffer = await docRes.arrayBuffer();

    const originalPath = path.join(tmpDir, filename);
    fs.writeFileSync(originalPath, Buffer.from(buffer));

    // Convert to webp
    const basename = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const webpFilename = `${basename}.webp`;
    const webpPath = path.join(tmpDir, webpFilename);

    console.log(`Converting to ${webpFilename}...`);
    await sharp(originalPath)
        .webp({ quality: 80, lossless: false })
        .toFile(webpPath);

    // Upload to Shopify Files
    console.log(`Uploading ${webpFilename} to Shopify...`);
    const fileSize = fs.statSync(webpPath).size;
    const stageQuery = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `;
    const stageResult = await gql(stageQuery, {
      input: [{ resource: 'FILE', filename: webpFilename, mimeType: 'image/webp', fileSize: fileSize.toString(), httpMethod: 'POST' }],
    });
    const target = stageResult.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) throw new Error('Staged upload init failed');

    const formData = new FormData();
    for (const param of target.parameters) formData.append(param.name, param.value);
    const fileBufferWebp = fs.readFileSync(webpPath);
    formData.append('file', new Blob([fileBufferWebp], { type: 'image/webp' }), webpFilename);

    const uploadRes = await fetch(target.url, { method: 'POST', body: formData });
    if (!uploadRes.ok) throw new Error(`Upload to storage failed`);

    const createFileQuery = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) { files { id alt createdAt } userErrors { field message } }
      }
    `;
    const fileResult = await gql(createFileQuery, {
      files: [{ alt: webpFilename.replace('.webp', '').replace(/-/g, ' '), contentType: 'IMAGE', originalSource: target.resourceUrl }],
    });
    const createdFile = fileResult.data?.fileCreate?.files?.[0];

    // Aggiorna la reference dell'oggetto originale per riflettere nel template
    const newRef = `shopify://shop_images/${webpFilename}`;
    imgRef.settingsObj[imgRef.key] = newRef;
    convertedUrls.push(newRef);
    
    // cleanup temp files
    fs.unlinkSync(originalPath);
    fs.unlinkSync(webpPath);
  }

  if (convertedUrls.length > 0) {
    console.log('Update template data...');

    console.log('Pushing updated template to Shopify...');
    await apiFetch(`themes/${activeTheme.id}/assets.json`, {
      method: 'PUT',
      body: JSON.stringify({ asset: { key: assetKey, value: JSON.stringify(template, null, 2) } }),
    });

    return {
      success: true,
      converted: convertedUrls.length,
      message: `Immagini (${convertedUrls.length}) convertite in .webp e template ${targetTemplateName} aggiornato.`,
      urls_mapped: convertedUrls
    };

  } else {
    return { success: true, message: "Nessuna immagine convertibile o trovata." };
  }
}
