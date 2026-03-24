const storeUrl = process.env.SHOPIFY_STORE_URL || 'test-mcp-3.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || '';
const productId = '7800192172122';

async function run() {
  const query = `
    query {
      product(id: "gid://shopify/Product/${productId}") {
        metafields(first: 20) {
          edges {
            node {
              namespace
              key
              value
            }
          }
        }
      }
    }
  `;
  const res = await fetch(`https://${storeUrl}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query })
  });
  console.log(JSON.stringify(await res.json(), null, 2));
}
run();
