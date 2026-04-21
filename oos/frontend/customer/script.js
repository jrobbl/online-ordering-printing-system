// ============================================
// CONFIGURATION
// ============================================

//const API_URL = 'http://localhost:3000/api';  // dev only
const API_URL = '/api';

// ============================================
// STATE MANAGEMENT
// ============================================

let products = [];
let cart = [];
let currentView = 'cart'; // 'cart', 'checkout', 'success'
let searchQuery = '';

// ============================================
// DOM ELEMENTS
// ============================================

const productsGrid = document.getElementById('products-grid');
const loadingSpinner = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const emptyCartMessage = document.getElementById('empty-cart');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalSection = document.getElementById('cart-total');
const totalAmountElement = document.getElementById('total-amount');
const checkoutBtn = document.getElementById('checkout-btn');

// Search and mobile cart bar
const productSearchInput = document.getElementById('product-search');
const mobileCartBar = document.getElementById('mobile-cart-bar');

// Checkout form elements
const checkoutForm = document.getElementById('checkout-form');
const orderForm = document.getElementById('order-form');
const customerNameInput = document.getElementById('customer-name');
const customerBranchInput = document.getElementById('customer-branch');
const customerEmailInput = document.getElementById('customer-email');
const orderNotesInput = document.getElementById('order-notes');
const checkoutTotalAmount = document.getElementById('checkout-total-amount');
const placeOrderBtn = document.getElementById('place-order-btn');
const backToCartBtn = document.getElementById('back-to-cart-btn');

// Success message elements
const orderSuccess = document.getElementById('order-success');
const orderTotal = document.getElementById('order-total');
const newOrderBtn = document.getElementById('new-order-btn');

// ============================================
// FETCH PRODUCTS FROM API
// ============================================

async function fetchProducts() {
    try {
        loadingSpinner.classList.remove('hidden');
        errorMessage.classList.add('hidden');

        const response = await fetch(`${API_URL}/products`);

        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }

        products = await response.json();

        loadingSpinner.classList.add('hidden');
        productsGrid.classList.remove('hidden');

        displayProducts();

    } catch (error) {
        console.error('Error fetching products:', error);
        loadingSpinner.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
}

// ============================================
// DISPLAY PRODUCTS
// ============================================

const CATEGORY_CONFIG = [
    { key: 'Pan dulce',                  label: 'Pan Dulce',                  color: '#5cb85c' },
    { key: 'Pan salado',                 label: 'Pan Salado',                 color: '#e07830' },
    { key: 'Pan y productos por pedido', label: 'Pan y Productos por Pedido', color: '#d4a017' },
    { key: 'MINIs',                      label: 'MINIs',                      color: '#b5606e' },
    { key: 'Congelados y abarrotes',     label: 'Congelados y Abarrotes',     color: '#2980b9' },
];

function displayProducts() {
    productsGrid.innerHTML = '';

    const filtered = products.filter(p =>
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filtered.length === 0 && searchQuery) {
        productsGrid.innerHTML = `<p class="text-muted text-center" style="padding: 1rem 0;">Sin resultados para "<strong>${escapeHtml(searchQuery)}</strong>"</p>`;
        return;
    }

    // When searching, show flat list; otherwise show category blocks
    if (searchQuery) {
        filtered.forEach(product => {
            productsGrid.innerHTML += buildProductCard(product);
        });
        return;
    }

    CATEGORY_CONFIG.forEach(cat => {
        const items = products.filter(p => p.category === cat.key);
        if (items.length === 0) return;

        const block = document.createElement('div');
        block.className = 'category-block';

        block.innerHTML = `
            <button class="category-header" style="background-color: ${cat.color};" onclick="toggleCategory(this)">
                <span>${cat.label}</span>
                <span class="category-chevron">▼</span>
            </button>
            <div class="category-products hidden">
                ${items.map(p => buildProductCard(p)).join('')}
            </div>
        `;

        productsGrid.appendChild(block);
    });
}

function buildProductCard(product) {
    const qty = getCartQuantity(product.product_id);
    return `
        <div class="card product-card">
            <div class="product-card-body">
                <span class="product-card-name">${product.product_name}</span>
                <div id="stepper-${product.product_id}" class="product-card-stepper">
                    ${renderStepper(product.product_id, product.product_name, product.price, qty)}
                </div>
            </div>
        </div>
    `;
}

function toggleCategory(headerBtn) {
    const productsList = headerBtn.nextElementSibling;
    const chevron = headerBtn.querySelector('.category-chevron');
    productsList.classList.toggle('hidden');
    chevron.textContent = productsList.classList.contains('hidden') ? '▼' : '▲';
}

function getCartQuantity(productId) {
    const item = cart.find(i => i.product_id === productId);
    return item ? item.quantity : 0;
}

function renderStepper(productId, productName, price, qty) {
    if (qty === 0) {
        return `
            <button
                class="btn btn-product-unselected btn-block"
                onclick="incrementProduct(${productId}, '${escapeHtml(productName)}', ${price})"
            >
                + Agregar
            </button>
        `;
    }
    return `
        <div class="qty-stepper">
            <button class="qty-stepper-btn" onclick="decrementProduct(${productId})">&#8722;</button>
            <span class="qty-stepper-value">${qty}</span>
            <button class="qty-stepper-btn" onclick="incrementProduct(${productId}, '${escapeHtml(productName)}', ${price})">+</button>
        </div>
    `;
}

function updateStepper(productId) {
    const product = products.find(p => p.product_id === productId);
    if (!product) return;
    const container = document.getElementById(`stepper-${productId}`);
    if (!container) return;
    const qty = getCartQuantity(productId);
    container.innerHTML = renderStepper(product.product_id, product.product_name, product.price, qty);
}

// ============================================
// INCREMENT / DECREMENT PRODUCT (stepper)
// ============================================

function incrementProduct(productId, productName, price) {
    const existingItem = cart.find(item => item.product_id === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            product_id: productId,
            product_name: productName,
            price: price,
            quantity: 1
        });
    }

    updateStepper(productId);
    updateCartDisplay();
    showToast(`¡${productName} agregado al carrito!`);
}

function decrementProduct(productId) {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;

    item.quantity--;

    if (item.quantity <= 0) {
        showToast(`${item.product_name} eliminado del carrito`);
        cart = cart.filter(i => i.product_id !== productId);
    }

    updateStepper(productId);
    updateCartDisplay();
}

// ============================================
// REMOVE FROM CART (used by cart sidebar)
// ============================================

function removeFromCart(productId) {
    const item = cart.find(i => i.product_id === productId);
    if (item) {
        showToast(`${item.product_name} eliminado del carrito`);
    }
    cart = cart.filter(i => i.product_id !== productId);
    updateStepper(productId);
    updateCartDisplay();
}

// ============================================
// UPDATE CART DISPLAY
// ============================================

function updateCartDisplay() {
    if (cart.length === 0) {
        emptyCartMessage.classList.remove('hidden');
        cartItemsContainer.classList.add('hidden');
        cartTotalSection.classList.add('hidden');

        // Go back to cart view if cart is empty
        if (currentView === 'checkout') {
            switchView('cart');
        }
    } else {
        emptyCartMessage.classList.add('hidden');
        cartItemsContainer.classList.remove('hidden');
        cartTotalSection.classList.remove('hidden');

        cartItemsContainer.innerHTML = '';

        cart.forEach(item => {
            const subtotal = item.price * item.quantity;

            const cartItemHTML = `
                <div style="border-bottom: 1px solid #eee; padding: 0.6rem 0;">
                    <div class="flex-between">
                        <strong style="font-size: 0.9rem;">${escapeHtml(item.product_name)}</strong>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span class="text-muted" style="font-size: 0.85rem;">${item.quantity} unid.</span>
                            <button
                                class="btn-sm"
                                onclick="removeFromCart(${item.product_id})"
                                style="color: #f44336; font-size: 0.8rem; cursor: pointer;"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            `;

            cartItemsContainer.innerHTML += cartItemHTML;
        });

    }

    updateMobileCartBar();
}

// ============================================
// MOBILE CART BAR
// ============================================

function updateMobileCartBar() {
    if (!mobileCartBar) return;
    const total = cart.reduce((sum, i) => sum + i.quantity, 0);
    if (total > 0) {
        mobileCartBar.classList.remove('hidden');
        document.getElementById('mobile-cart-count').textContent =
            `🛒  ${total} ${total === 1 ? 'producto' : 'productos'}`;
    } else {
        mobileCartBar.classList.add('hidden');
    }
}

// ============================================
// CALCULATE TOTAL
// ============================================

function calculateTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// ============================================
// SWITCH BETWEEN VIEWS
// ============================================

function switchView(view) {
    currentView = view;

    if (view === 'cart') {
        cartItemsContainer.classList.remove('hidden');
        cartTotalSection.classList.remove('hidden');
        checkoutForm.classList.add('hidden');
        orderSuccess.classList.add('hidden');
    } else if (view === 'checkout') {
        cartItemsContainer.classList.add('hidden');
        cartTotalSection.classList.add('hidden');
        checkoutForm.classList.remove('hidden');
        orderSuccess.classList.add('hidden');
    } else if (view === 'success') {
        cartItemsContainer.classList.add('hidden');
        cartTotalSection.classList.add('hidden');
        checkoutForm.classList.add('hidden');
        orderSuccess.classList.remove('hidden');
    }
}

// ============================================
// FORM VALIDATION
// ============================================

function validateForm() {
    let isValid = true;

    // Reset error states
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('error');
    });

    // Validate name
    if (!customerNameInput.value.trim()) {
        customerNameInput.classList.add('error');
        isValid = false;
    }

    // Validate branch
    if (!customerBranchInput.value.trim()) {
        customerBranchInput.classList.add('error');
        isValid = false;
    }

    // Validate email only if provided
    const emailValue = customerEmailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailValue && !emailRegex.test(emailValue)) {
        customerEmailInput.classList.add('error');
        isValid = false;
    }

    return isValid;
}

// ============================================
// SUBMIT ORDER
// ============================================

async function submitOrder(event) {
    event.preventDefault();

    if (!validateForm()) {
        showToast('Por favor completa todos los campos requeridos', 'error');
        return;
    }

    const orderData = {
        customer_name: customerNameInput.value.trim(),
        customer_branch: customerBranchInput.value.trim(),
        customer_email: customerEmailInput.value.trim() || undefined,
        notes: orderNotesInput.value.trim() || undefined,
        items: cart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity
        }))
    };

    try {
        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = 'Realizando Pedido...';

        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Error al realizar el pedido');
        }

        // Success!
        // Clear cart and reset all product steppers immediately
        cart = [];
        if (mobileCartBar) mobileCartBar.classList.add('hidden');
        displayProducts();

        // Reset form
        orderForm.reset();

        // Show success view
        switchView('success');
        showToast('¡Pedido realizado con éxito!', 'success');

        // Auto-return to clean state after 5 seconds
        setTimeout(() => {
            switchView('cart');
            updateCartDisplay();
        }, 5000);

    } catch (error) {
        console.error('Error placing order:', error);
        showToast(error.message, 'error');
    } finally {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Realizar Pedido';
    }
}

// ============================================
// TOAST NOTIFICATION
// ============================================

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// UTILITY: ESCAPE HTML
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// EVENT LISTENERS
// ============================================

checkoutBtn.addEventListener('click', () => {
    switchView('checkout');
});

backToCartBtn.addEventListener('click', () => {
    switchView('cart');
});

orderForm.addEventListener('submit', submitOrder);

newOrderBtn.addEventListener('click', () => {
    switchView('cart');
    updateCartDisplay();
    displayProducts();
});

// ============================================
// INITIALIZE APP
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();

    if (productSearchInput) {
        const handleSearch = e => {
            searchQuery = e.target.value;
            displayProducts();
        };
        productSearchInput.addEventListener('input', handleSearch);
        productSearchInput.addEventListener('keyup', handleSearch);
        productSearchInput.addEventListener('change', handleSearch);
    }

    if (mobileCartBar) {
        mobileCartBar.addEventListener('click', () => {
            document.getElementById('cart-panel').scrollIntoView({ behavior: 'smooth' });
        });
    }
});
