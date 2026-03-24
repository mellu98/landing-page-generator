

const storeUrl = process.env.SHOPIFY_STORE_URL || 'test-mcp-3.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || '';

async function findImages() {
  const query = `
    query {
      product(id: "gid://shopify/Product/7800192172122") {
        title
        images(first: 1) {
          edges {
            node {
              url
            }
          }
        }
      }
    }
  `;
  const res = await fetch(`https://${storeUrl}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data.data.product, null, 2));
}

findImages().catch(console.error);
