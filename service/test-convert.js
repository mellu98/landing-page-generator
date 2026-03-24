import { convertLandingImages } from './image-converter.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

console.log('Testing image conversion on Landing-shl0zv...');
// Use the same storeUrl and token from the user's previous successful request
const storeUrl = process.env.SHOPIFY_STORE_URL || 'test-mcp-3.myshopify.com';
const storeToken = process.env.SHOPIFY_ACCESS_TOKEN || '';

convertLandingImages(storeUrl, storeToken, 'Landing-shl0zv')
  .then(res => console.log('Result:', res))
  .catch(err => console.error('Error:', err));
