import 'dotenv/config';
import fs from 'fs';
import { extractProductData } from './service/openai-analyzer.js';

async function main() {
  const url = "https://it.aliexpress.com/item/1005010678793629.html?spm=a2g0o.imagesearchproductlist.main.3.67becbzicbzizU&algo_pvid=6d6d40bf-1623-40a4-aeb9-231c371f52be&algo_exp_id=6d6d40bf-1623-40a4-aeb9-231c371f52be&pdp_ext_f=%7B%22order%22%3A%22-1%22%2C%22fromPage%22%3A%22search%22%7D&pdp_npi=6%40dis%21EUR%2127.13%2118.99%21%21%2130.64%2121.45%21%40210385db17742315993704191e2111%2112000053167322278%21sea%21IT%211699417194%21ACX%211%210%21n_tag%3A-29919%3Bd%3A36b27a79%3Bm03_new_user%3A-29894&curPageLogUid=LlXAPjlQ3kW8&utparam-url=scene%3Aimage_search%7Cquery_from%3Apc_web_image_search%7Cx_object_id%3A1005010678793629%7C_p_origin_prod%3A";
  console.log("Starting analysis...");
  try {
    const productData = await extractProductData(url);
    const state = { productData, url };
    fs.writeFileSync('./service/.landing-state.json', JSON.stringify(state, null, 2));
    console.log("Analysis complete! Saved to .landing-state.json");
    console.log(JSON.stringify(productData, null, 2));
  } catch (err) {
    console.error("Error analyzing product:", err);
  }
}

main();
