import fs from 'fs';
import path from 'path';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'your-store.myshopify.com';
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

function apiUrl(p) {
  return `https://${STORE_URL}/admin/api/2024-10/${p}`;
}

async function shopifyFetch(p, options = {}) {
  const res = await fetch(apiUrl(p), {
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

async function shopifyGraphQL(query, variables = {}) {
  const res = await fetch(`https://${STORE_URL}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  return data;
}

// Upload file to Shopify Files via staged upload + GraphQL
async function uploadFileToShopify(filepath, filename) {
  const mimeType = 'image/png';
  const fileSize = fs.statSync(filepath).size;

  // Step 1: Create staged upload
  const stageQuery = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors { field message }
      }
    }
  `;

  console.log(`[1/3] Creating staged upload for ${filename}...`);
  const stageResult = await shopifyGraphQL(stageQuery, {
    input: [{
      resource: 'FILE',
      filename: filename,
      mimeType: mimeType,
      fileSize: fileSize.toString(),
      httpMethod: 'POST',
    }],
  });

  const target = stageResult.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) {
    throw new Error('Failed to create staged upload: ' + JSON.stringify(stageResult));
  }

  // Step 2: Upload file to staged URL
  console.log(`[2/3] Uploading file to staged URL...`);
  const formData = new FormData();
  for (const param of target.parameters) {
    formData.append(param.name, param.value);
  }
  const fileBuffer = fs.readFileSync(filepath);
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, filename);

  const uploadRes = await fetch(target.url, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Staged upload failed (${uploadRes.status}): ${errText}`);
  }

  // Step 3: Create file in Shopify
  console.log(`[3/3] Creating file record in Shopify...`);
  const createFileQuery = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          alt
          createdAt
        }
        userErrors { field message }
      }
    }
  `;

  const fileResult = await shopifyGraphQL(createFileQuery, {
    files: [{
      alt: filename.replace('.png', '').replace(/-/g, ' '),
      contentType: 'IMAGE',
      originalSource: target.resourceUrl,
    }],
  });

  const createdFile = fileResult.data?.fileCreate?.files?.[0];
  if (!createdFile) {
    throw new Error('Failed to create file: ' + JSON.stringify(fileResult));
  }

  console.log(`File created: ${createdFile.id}`);
  return createdFile;
}

// Poll for file URL (Shopify processes files async)
async function getFileUrl(fileId) {
  const query = `
    query getFile($id: ID!) {
      node(id: $id) {
        ... on MediaImage {
          image {
            url
          }
        }
        ... on GenericFile {
          url
        }
      }
    }
  `;

  for (let attempt = 0; attempt < 15; attempt++) {
    console.log(`  Polling file URL (attempt ${attempt + 1}/15)...`);
    await new Promise(r => setTimeout(r, 2000));

    const result = await shopifyGraphQL(query, { id: fileId });
    const node = result.data?.node;
    const url = node?.image?.url || node?.url;
    if (url) {
      console.log(`  File URL ready: ${url.slice(0, 80)}...`);
      return url;
    }
  }
  throw new Error(`Timeout waiting for file URL: ${fileId}`);
}

// ─── Exported reusable function for use by Telegram bot / other scripts ───
export async function fixImagesForState(state, storeUrlOverride, accessTokenOverride, imgDirOverride) {
  const store = storeUrlOverride || STORE_URL;
  const token = accessTokenOverride || ACCESS_TOKEN;

  // Helper wrappers that use the provided credentials
  function apiFetch(p, options = {}) {
    return fetch(`https://${store}/admin/api/2024-10/${p}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        ...options.headers,
      },
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(`Shopify API error (${res.status}): ${JSON.stringify(data)}`);
      return data;
    });
  }

  function gql(query, variables = {}) {
    return fetch(`https://${store}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    }).then(async res => {
      const data = await res.json();
      if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
      return data;
    });
  }

  async function uploadFile(filepath, filename) {
    const mimeType = 'image/png';
    const fileSize = fs.statSync(filepath).size;
    const stageQuery = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `;
    const stageResult = await gql(stageQuery, {
      input: [{ resource: 'FILE', filename, mimeType, fileSize: fileSize.toString(), httpMethod: 'POST' }],
    });
    const target = stageResult.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) throw new Error('Failed to create staged upload: ' + JSON.stringify(stageResult));

    const formData = new FormData();
    for (const param of target.parameters) formData.append(param.name, param.value);
    const fileBuffer = fs.readFileSync(filepath);
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);
    const uploadRes = await fetch(target.url, { method: 'POST', body: formData });
    if (!uploadRes.ok) throw new Error(`Staged upload failed (${uploadRes.status}): ${await uploadRes.text()}`);

    const createFileQuery = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) { files { id alt createdAt } userErrors { field message } }
      }
    `;
    const fileResult = await gql(createFileQuery, {
      files: [{ alt: filename.replace('.png', '').replace(/-/g, ' '), contentType: 'IMAGE', originalSource: target.resourceUrl }],
    });
    const createdFile = fileResult.data?.fileCreate?.files?.[0];
    if (!createdFile) throw new Error('Failed to create file: ' + JSON.stringify(fileResult));
    return createdFile;
  }

  async function pollFileUrl(fileId) {
    const query = `query getFile($id: ID!) { node(id: $id) { ... on MediaImage { image { url } } ... on GenericFile { url } } }`;
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const result = await gql(query, { id: fileId });
      const node = result.data?.node;
      const url = node?.image?.url || node?.url;
      if (url) return url;
    }
    throw new Error(`Timeout waiting for file URL: ${fileId}`);
  }

  // ─── Core logic ───
  const imgDir = imgDirOverride || path.join(process.cwd(), 'generated-images');
  const allFiles = fs.readdirSync(imgDir).filter(f => f.endsWith('.png'));
  const sorted = allFiles.sort();
  console.log(`Found ${allFiles.length} generated images in total.`);

  const latest = {};
  for (const f of sorted) {
    if (f.startsWith('lifestyle-')) latest.lifestyle = f;
    if (f.startsWith('product-photo-')) latest.productPhoto = f;
    if (f.startsWith('infographic-')) latest.infographic = f;
    if (f.startsWith('how-to-process-')) latest.howTo = f;
    if (f.startsWith('social-proof-')) latest.socialProof = f;
  }
  console.log('Latest images found:', JSON.stringify(latest, null, 2));

  const imageMapping = [
    { key: 'imgText1', file: latest.lifestyle || latest.productPhoto, sectionId: null },
    { key: 'benefits', file: latest.productPhoto || latest.infographic, sectionId: null },
    { key: 'percentage', file: latest.socialProof || latest.lifestyle, sectionId: null },
    { key: 'imgText2', file: latest.howTo || latest.infographic, sectionId: null },
  ];

  const sectionOrder = state.template.order;
  for (const sectionId of sectionOrder) {
    const sec = state.template.sections[sectionId];
    if (sec.type === 'pp-image-with-text-v1-0-0') {
      if (!imageMapping[0].sectionId) imageMapping[0].sectionId = sectionId;
      else imageMapping[3].sectionId = sectionId;
    }
    if (sec.type === 'pp-image-with-benefits-v1-0-0') imageMapping[1].sectionId = sectionId;
    if (sec.type === 'pp-image-with-percentage-v1-0-0') imageMapping[2].sectionId = sectionId;
  }

  // Upload images to Shopify Files and collect URLs
  const uploadedUrls = {};
  for (const m of imageMapping) {
    if (!m.file || !m.sectionId) continue;
    const filepath = path.join(imgDir, m.file);
    console.log(`Uploading ${m.key}: ${m.file}...`);
    const created = await uploadFile(filepath, m.file);
    const url = await pollFileUrl(created.id);
    uploadedUrls[m.sectionId] = url;
  }

  // Update template sections with image URLs
  for (const [sectionId, url] of Object.entries(uploadedUrls)) {
    if (state.template.sections[sectionId]?.settings) {
      state.template.sections[sectionId].settings.image = url;
    }
  }

  // Upload generated images as product gallery images
  const productId = state.shopifyProduct?.id;
  if (productId) {
    console.log(`Uploading generated images as product gallery (product ${productId})...`);
    const categoriesToUpload = ['productPhoto', 'lifestyle', 'infographic', 'howTo', 'socialProof'];
    for (const cat of categoriesToUpload) {
      if (latest[cat]) {
        const filepath = path.join(imgDir, latest[cat]);
        const base64 = fs.readFileSync(filepath).toString('base64');
        try {
          const imgResult = await fetch(`https://${store}/admin/api/2024-10/products/${productId}/images.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
            body: JSON.stringify({ image: { attachment: base64, filename: latest[cat] } }),
          });
          const imgData = await imgResult.json();
          if (imgResult.ok) console.log(`  Added ${cat} to gallery: ${imgData.image?.id}`);
          else console.error(`  Failed ${cat}: ${JSON.stringify(imgData)}`);
        } catch (e) {
          console.error(`  Error uploading ${cat}: ${e.message}`);
        }
      }
    }
  }

  // Re-upload updated template to theme
  console.log('Re-uploading template to theme...');
  const themes = await apiFetch('themes.json');
  const activeTheme = themes.themes.find(t => t.role === 'main');
  if (!activeTheme) throw new Error('No active theme found');

  const assetKey = `templates/product.${state.templateName}.json`;
  await apiFetch(`themes/${activeTheme.id}/assets.json`, {
    method: 'PUT',
    body: JSON.stringify({ asset: { key: assetKey, value: JSON.stringify(state.template, null, 2) } }),
  });

  console.log(`Template updated: ${assetKey}`);
  return { uploadedUrls, latest, state };
}

// ─── CLI entry point ───
async function main() {
  try {
    const state = JSON.parse(fs.readFileSync('.landing-state.json', 'utf8'));
    const result = await fixImagesForState(state);
    // Save updated state
    fs.writeFileSync('.landing-state.json', JSON.stringify(result.state, null, 2), 'utf8');
    console.log('\n✅ DONE! All images uploaded and template updated.');
  } catch (e) {
    console.error('Error:', e);
  }
}

// Only run main() when executed directly (not imported)
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
if (isMainModule) {
  main();
}
