const storeUrl = process.env.SHOPIFY_STORE_URL || 'test-mcp-3.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || '';

async function run() {
  console.log("Fetching themes...");
  const themeRes = await fetch(`https://${storeUrl}/admin/api/2024-10/themes.json`, {
    headers: { "X-Shopify-Access-Token": token }
  });
  const themeData = await themeRes.json();
  const mainTheme = themeData.themes.find(t => t.role === 'main');
  console.log(`Main Theme ID: ${mainTheme.id}`);
  
  console.log("Fetching products matching 'Organizer'...");
  const prodRes = await fetch(`https://${storeUrl}/admin/api/2024-10/products.json?title=Organizer`, {
    headers: { "X-Shopify-Access-Token": token }
  });
  const prodData = await prodRes.json();
  let product = prodData.products.find(p => p.title.toLowerCase().includes('organizer'));
  
  if (!product) {
    console.log("Searching all products just in case...");
    const allProdRes = await fetch(`https://${storeUrl}/admin/api/2024-10/products.json`, {
      headers: { "X-Shopify-Access-Token": token }
    });
    const allProdData = await allProdRes.json();
    product = allProdData.products.find(p => p.title.toLowerCase().includes('organizer'));
  }

  if (product) {
    console.log(`Found Product: ${product.title} (ID: ${product.id})`);
    if (product.image) {
      console.log(`Product Image URL: ${product.image.src}`);
    }
    
    // Update the title
    const newTitle = "Premium Kleiderschrank Organizer";
    console.log(`Updating product title to: ${newTitle}`);
    const updateRes = await fetch(`https://${storeUrl}/admin/api/2024-10/products/${product.id}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({
        product: { id: product.id, title: newTitle }
      })
    });
    const updateData = await updateRes.json();
    console.log(`Update successful: ${updateData.product.title}`);
  } else {
    console.error("Could not find the product 'Organizer'.");
  }
}
run();
