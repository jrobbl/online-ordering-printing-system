// ============================================
// CONFIGURATION
// ============================================

// API_URL is declared in auth.js (loaded first via index.html)

// ============================================
// AUTHENTICATION CHECK
// ============================================

// Check if user is authenticated on page load
(async function checkAuth() {
    const authenticated = await requireAuth();
    if (!authenticated) {
        // requireAuth() will redirect to login
        return;
    }

    // Display admin username in header
    const token = getAuthToken();
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const usernameElement = document.getElementById('admin-username');
            if (usernameElement) {
                usernameElement.textContent = `👤 ${payload.username}`;
            }
        } catch (error) {
            console.error('Error decoding token:', error);
        }
    }

    // Fetch orders only after auth is confirmed
    fetchOrders('pending');
})();

// ============================================
// STATE MANAGEMENT
// ============================================

let orders = [];
let currentFilter = 'pending';
const printedOrders = new Set();

// ============================================
// STATUS TRANSLATION
// ============================================

const STATUS_LABELS = {
    'pending': 'PENDIENTE',
    'completed': 'COMPLETADO',
    'cancelled': 'CANCELADO'
};

const STATUS_LABELS_LOWER = {
    'pending': 'pendiente',
    'completed': 'completado',
    'cancelled': 'cancelado'
};

function translateStatus(status) {
    return STATUS_LABELS[status] || status.toUpperCase();
}

// ============================================
// DOM ELEMENTS
// ============================================

const loadingSpinner = document.getElementById('loading');
const ordersContainer = document.getElementById('orders-container');
const emptyState = document.getElementById('empty-state');
const errorMessage = document.getElementById('error-message');
const currentTimeElement = document.getElementById('current-time');

// Stats elements (may be null if stats cards are commented out in HTML)
const totalOrdersElement = document.getElementById('total-orders');
const pendingOrdersElement = document.getElementById('pending-orders');
const completedOrdersElement = document.getElementById('completed-orders');

// ============================================
// FETCH ORDERS FROM API
// ============================================

async function fetchOrders(filter = null) {
    try {
        loadingSpinner.classList.remove('hidden');
        ordersContainer.classList.add('hidden');
        emptyState.classList.add('hidden');
        errorMessage.classList.add('hidden');

        const url = filter && filter !== 'all'
            ? `${API_URL}/orders?status=${filter}`
            : `${API_URL}/orders`;

        const token = getAuthToken();

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Handle authentication errors
        if (response.status === 401) {
            console.log('Authentication failed, redirecting to login...');
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }

        orders = await response.json();

        // Populate printedOrders from has_print_jobs flag
        printedOrders.clear();
        orders.forEach(o => { if (o.has_print_jobs) printedOrders.add(o.order_id); });

        loadingSpinner.classList.add('hidden');

        if (orders.length === 0) {
            emptyState.classList.remove('hidden');
            ordersContainer.classList.add('hidden');      // ← Add this line
            errorMessage.classList.add('hidden');         // ← Add this line
        } else {
            ordersContainer.classList.remove('hidden');
            emptyState.classList.add('hidden');           // ← Add this line
            errorMessage.classList.add('hidden');         // ← Add this line
            displayOrders();
        }

        updateStats();

    } catch (error) {
        console.error('Error fetching orders:', error);
        loadingSpinner.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
}

// ============================================
// DISPLAY ORDERS
// ============================================

function displayOrders() {
    ordersContainer.innerHTML = '';

    orders.forEach(order => {
        const orderCard = createOrderCard(order);
        ordersContainer.innerHTML += orderCard;
    });
}

// ============================================
// CREATE ORDER CARD HTML
// ============================================

function createOrderCard(order) {
    const statusColor = getStatusColor(order.status);
    const formattedDate = formatDate(order.order_date);

    return `
        <div class="card mb-3">
            <div class="card-body">
                <div class="flex-between mb-2">
                    <div>
                        <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">
                            ${escapeHtml(order.customer_name)}
                        </p>
                        <p style="font-size: 1rem; margin: 0; color: var(--gray);">
                            ${escapeHtml(order.customer_branch)}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge" style="background-color: ${statusColor};">
                            ${translateStatus(order.status)}
                        </span>
                        <p class="text-muted" style="font-size: 0.875rem; margin-top: 0.5rem;">
                            ${formattedDate}
                        </p>
                    </div>
                </div>

                <div style="border-top: 1px solid #eee; padding-top: 1rem; margin-top: 1rem;">
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        ${printedOrders.has(order.order_id) ? `
                            <span style="color: #4caf50; font-size: 0.85rem; font-weight: bold;">Impreso ✓</span>
                        ` : ''}
                        <button class="btn btn-sm btn-outline" onclick="viewOrderDetails(${order.order_id})">
                            Ver Detalles
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="printOrder(${order.order_id})" title="Imprimir ticket">
                            🖨️
                        </button>
                        ${order.status === 'pending' ? `
                            <button class="btn btn-sm btn-primary" onclick="updateOrderStatus(${order.order_id}, 'completed')">
                                Marcar Completado
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="updateOrderStatus(${order.order_id}, 'cancelled')">
                                Cancelar
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Order Details (Initially Hidden) -->
                <div id="order-details-${order.order_id}" class="hidden" style="border-top: 1px solid #eee; margin-top: 1rem; padding-top: 1rem;">
                    <div class="spinner" style="margin: 2rem auto;"></div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// VIEW ORDER DETAILS
// ============================================

async function viewOrderDetails(orderId) {
    const detailsContainer = document.getElementById(`order-details-${orderId}`);

    // Toggle visibility
    if (!detailsContainer.classList.contains('hidden')) {
        detailsContainer.classList.add('hidden');
        return;
    }

    detailsContainer.classList.remove('hidden');

    try {
        const token = getAuthToken();

        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Handle authentication errors
        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to fetch order details');
        }

        const order = await response.json();

        detailsContainer.innerHTML = `
            <div class="grid order-details-grid">
                <div>
                    <h4 class="mb-2">Información del Cliente</h4>
                    <p><strong>Nombre:</strong> ${escapeHtml(order.customer_name)}</p>
                    <p><strong>Teléfono:</strong> ${escapeHtml(order.customer_phone)}</p>
                    <p><strong>Correo:</strong> ${escapeHtml(order.customer_email)}</p>
                    ${order.notes ? `<p><strong>Notas:</strong> ${escapeHtml(order.notes)}</p>` : ''}
                </div>

                <div>
                    <h4 class="mb-2">Artículos del Pedido</h4>
                    ${order.items.map(item => `
                        <div class="flex-between mb-2" style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
                            <strong>${escapeHtml(item.product_name)}</strong>
                            <span class="text-muted">${item.quantity} unidades</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error fetching order details:', error);
        detailsContainer.innerHTML = `
            <p class="text-muted text-center">Error al cargar los detalles del pedido</p>
        `;
    }
}

// ============================================
// UPDATE ORDER STATUS
// ============================================

async function updateOrderStatus(orderId, newStatus) {
    const statusName = STATUS_LABELS_LOWER[newStatus] || newStatus;
    const confirmed = confirm(`¿Estás seguro de que deseas marcar este pedido como ${statusName}?`);

    if (!confirmed) return;

    try {
        const token = getAuthToken();

        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        // Handle authentication errors
        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to update order status');
        }

        showToast(`Pedido #${orderId} marcado como ${statusName}`, 'success');

        // Refresh orders
        fetchOrders(currentFilter === 'all' ? null : currentFilter);

    } catch (error) {
        console.error('Error updating order status:', error);
        showToast('Error al actualizar el estado del pedido', 'error');
    }
}

// ============================================
// PRINT FUNCTIONS
// ============================================

async function printOrder(orderId) {
    try {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/print-job/order/${orderId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) throw new Error('Error al crear trabajos de impresión');

        const data = await response.json();
        if (data.alreadyPrinted) {
            showToast(`Pedido #${orderId} ya estaba en cola`, 'success');
        } else {
            showToast(`Pedido #${orderId}: 2 trabajos creados`, 'success');
        }

        printedOrders.add(orderId);
        // Re-render to show the badge without a full network fetch
        displayOrders();

    } catch (error) {
        console.error('Error printing order:', error);
        showToast('Error al imprimir el pedido', 'error');
    }
}

async function printRecentOrders() {
    try {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/print-job/recent`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) throw new Error('Error al encolar pedidos recientes');

        const data = await response.json();
        showToast(`${data.queued} pedido(s) recientes encolados para impresión`, 'success');

        // Refresh to update badges
        fetchOrders(currentFilter === 'all' ? null : currentFilter);

    } catch (error) {
        console.error('Error printing recent orders:', error);
        showToast('Error al imprimir pedidos recientes', 'error');
    }
}

// ============================================
// FILTER ORDERS
// ============================================

function filterOrders(filter) {
    currentFilter = filter;

    // Update active button
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    // Fetch filtered orders
    fetchOrders(filter === 'all' ? null : filter);
}

// ============================================
// UPDATE STATS
// ============================================

async function updateStats() {
    try {
        // Fetch all orders for stats (regardless of current filter)
        const token = getAuthToken();

        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Handle authentication errors
        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }
        const allOrders = await response.json();

        const total = allOrders.length;
        const pending = allOrders.filter(o => o.status === 'pending').length;
        const completed = allOrders.filter(o => o.status === 'completed').length;

        if (totalOrdersElement) totalOrdersElement.textContent = total;
        if (pendingOrdersElement) pendingOrdersElement.textContent = pending;
        if (completedOrdersElement) completedOrdersElement.textContent = completed;

    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getStatusColor(status) {
    const colors = {
        'pending': '#ff9800',
        'completed': '#4caf50',
        'cancelled': '#f44336'
    };
    return colors[status] || '#666666';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('es-MX', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateCurrentTime() {
    const now = new Date();
    currentTimeElement.textContent = now.toLocaleString('es-MX', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
// AUTO-REFRESH
// ============================================

// Refresh orders every 30 seconds
setInterval(() => {
    fetchOrders(currentFilter === 'all' ? null : currentFilter);
}, 30000);

// Update time every second
setInterval(updateCurrentTime, 1000);

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateCurrentTime();

    // Logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
