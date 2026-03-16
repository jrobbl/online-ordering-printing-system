const productModel = require('../backend/models/productModel');

async function testProductModel() {
  console.log('=== Testing Product Model ===\n');

  try {
    // Test 1: Get all products
    console.log('Test 1: getAllProducts()');
    const allProducts = await productModel.getAllProducts();
    console.log(`✅ Found ${allProducts.length} products`);
    if (allProducts.length > 0) {
      console.log('   First product:', allProducts[0]);
    }

    // Test 2: Get product by ID
    console.log('\nTest 2: getProductById(1)');
    const product = await productModel.getProductById(1);
    if (product) {
      console.log('✅ Product found:', product);
    } else {
      console.log('⚠️  Product ID 1 not found');
    }

    // Test 3: Get non-existent product
    console.log('\nTest 3: getProductById(9999)');
    const nonExistent = await productModel.getProductById(9999);
    console.log('✅ Returns null for non-existent:', nonExistent === null);

    // Test 4: Get products by IDs
    console.log('\nTest 4: getProductsByIds([1, 2])');
    const multipleProducts = await productModel.getProductsByIds([1, 2]);
    console.log(`✅ Found ${multipleProducts.length} products`);
    multipleProducts.forEach(p => {
      console.log(`   - ${p.product_name}: $${p.price}`);
    });

    // Test 5: Check if product exists
    console.log('\nTest 5: productExists(1)');
    const exists = await productModel.productExists(1);
    console.log('✅ Product 1 exists:', exists);

    console.log('\nTest 6: productExists(9999)');
    const notExists = await productModel.productExists(9999);
    console.log('✅ Product 9999 exists:', notExists);

    console.log('\n✅ All tests completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testProductModel();
