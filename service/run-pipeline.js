import 'dotenv/config';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { extractProductData, generateCopy } from "./openai-analyzer.js";
import { generateLandingTemplate } from "./template-generator.js";
import { generateImageSet, CATEGORIES } from "./image-generator.js";
import * as shopify from "./shopify-client.js";
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = "https://www.aliexpress.com/p/tesla-landing/index.html?scenario=c_ppc_item_bridge&productId=1005011632608675&_immersiveMode=true&withMainCard=true&src=google&aff_platform=true&isdl=y&src=google&albch=shopping&acnt=742-864-1166&isdl=y&slnk=&plac=&mtctp=&albbt=Google_7_shopping&aff_platform=google&aff_short_key=UneMJZVf&gclsrc=aw.ds&&albagn=888888&&ds_e_adid=&ds_e_matchtype=&ds_e_device=c&ds_e_network=x&ds_e_product_group_id=&ds_e_product_id=it1005011632608675&ds_e_product_merchant_id=5720613590&ds_e_product_country=IT&ds_e_product_language=it&ds_e_product_channel=online&ds_e_product_store_id=&ds_url_v=2&albcp=22118443566&albag=&isSmbAutoCall=false&needSmbHouyi=false&gad_source=1&gad_campaignid=22128437173&gclid=CjwKCAjwyYPOBhBxEiwAgpT8P46UAAKdrJL1NLunCKU6z2vTVy1LeBNdZpFbLxQL4Ssel9ElrAWJLRoCEosQAvD_BwE";

const storeUrl = process.env.SHOPIFY_STORE_URL;
const token = process.env.SHOPIFY_ACCESS_TOKEN;

async function run() {
  try {
    console.log("1. Analyzing product from AliExpress...");
    const productData = await extractProductData(url);
    
    console.log("\n2. Generating persuasive copy...");
    const copyData = await generateCopy(productData, "Usa stile Signora Market Copy in italiano");
    
    console.log("\n3. Generating PagePilot template...");
    const { templateName, template } = generateLandingTemplate(productData, copyData);
    
    console.log("\n4. Pushing draft product and template to Shopify...");
    const result = await shopify.fullImport(storeUrl, token, productData, copyData, templateName, template);
    
    // Save state for fix-images.js
    const state = {
      url,
      productData,
      copyData,
      templateName,
      template,
      shopifyProduct: result.product,
      shopifyUrl: result.productUrl,
      adminUrl: result.adminUrl
    };
    fs.writeFileSync(join(__dirname, '.landing-state.json'), JSON.stringify(state, null, 2), 'utf-8');
    
    console.log(`\nProduct created as Draft!`);
    console.log(`Admin URL: ${result.adminUrl}`);
    console.log(`Preview URL: ${result.productUrl}`);
    
    console.log("\n5. Generating premium 1:1 image set...");
    if (productData.images && productData.images.length > 0) {
      const referenceImage = productData.images[0];
      const categoriesToGenerate = Object.keys(CATEGORIES); // all 6 categories
      await generateImageSet(referenceImage, productData, categoriesToGenerate);
      
      console.log("\n6. Running fix-images.js to upload to Shopify Files and map to template...");
      execSync('node fix-images.js', { stdio: 'inherit', cwd: __dirname });
    } else {
      console.log("No reference images found on AliExpress. Skipping AI image generation.");
    }
    
    console.log("\n🚀 Pipeline fully completed successfully! Review the product on Shopify at:");
    console.log(result.adminUrl);
  } catch(e) {
    console.error("Pipeline failed:", e);
  }
}

run();
