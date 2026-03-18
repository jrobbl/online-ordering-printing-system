// ============================================
// CONFIGURATION
// ============================================

// API_URL is declared in auth.js (loaded first via index.html)

// ============================================
// AUTHENTICATION CHECK
// ============================================

(async function checkAuth() {
    const authenticated = await requireAuth();
    if (!authenticated) return;

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

    fetchOrders();
})();

// ============================================
// STATE
// ============================================

let orders = [];
let currentPeriod = 'today_yesterday'; // 'today_yesterday' | 'this_week' | 'all'
let currentStatus = null;              // null | 'pending' | 'completed' | 'cancelled'
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
// PERIOD → DATE RANGE
// ============================================

function getDateRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === 'today_yesterday') {
        const from = new Date(today);
        from.setDate(from.getDate() - 1); // midnight yesterday
        return { date_from: from.toISOString(), date_to: null };
    }

    if (period === 'this_week') {
        const dayOfWeek = today.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(monday.getDate() - daysFromMonday);
        return { date_from: monday.toISOString(), date_to: null };
    }

    return { date_from: null, date_to: null };
}

// ============================================
// FETCH ORDERS FROM API
// ============================================

async function fetchOrders() {
    try {
        loadingSpinner.classList.remove('hidden');
        ordersContainer.classList.add('hidden');
        emptyState.classList.add('hidden');
        errorMessage.classList.add('hidden');

        const { date_from, date_to } = getDateRange(currentPeriod);
        const params = new URLSearchParams();
        if (currentStatus) params.set('status', currentStatus);
        if (date_from) params.set('date_from', date_from);
        if (date_to) params.set('date_to', date_to);

        const url = `${API_URL}/orders${params.toString() ? '?' + params.toString() : ''}`;
        const token = getAuthToken();

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch orders');

        orders = await response.json();

        printedOrders.clear();
        orders.forEach(o => { if (o.has_print_jobs) printedOrders.add(o.order_id); });

        loadingSpinner.classList.add('hidden');

        if (orders.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            ordersContainer.classList.remove('hidden');
            displayOrders();
        }

    } catch (error) {
        console.error('Error fetching orders:', error);
        loadingSpinner.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
}

// ============================================
// PERIOD AND STATUS CONTROLS
// ============================================

function setPeriod(period) {
    currentPeriod = period;
    document.querySelectorAll('[data-period]').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-period="${period}"]`).classList.add('active');
    fetchOrders();
}

function setStatus(status) {
    currentStatus = status;
    document.querySelectorAll('[data-status]').forEach(btn => btn.classList.remove('active'));
    const selector = status ? `[data-status="${status}"]` : '[data-status=""]';
    document.querySelector(selector).classList.add('active');
    fetchOrders();
}

// ============================================
// DISPLAY ORDERS
// ============================================

function displayOrders() {
    ordersContainer.innerHTML = '';

    if (currentPeriod === 'all') {
        const groups = groupByWeek(orders);
        groups.forEach(({ label, orders: weekOrders }) => {
            ordersContainer.innerHTML += `<div class="week-header">${escapeHtml(label)}</div>`;
            weekOrders.forEach(order => {
                ordersContainer.innerHTML += createOrderCard(order);
            });
        });
    } else {
        orders.forEach(order => {
            ordersContainer.innerHTML += createOrderCard(order);
        });
    }
}

// ============================================
// GROUP BY WEEK (for historical view)
// ============================================

function groupByWeek(orders) {
    const weeks = new Map();

    orders.forEach(order => {
        const date = new Date(order.order_date);
        const day = date.getDay();
        const daysFromMonday = day === 0 ? 6 : day - 1;
        const monday = new Date(date);
        monday.setDate(monday.getDate() - daysFromMonday);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const weekKey = monday.toISOString().split('T')[0];

        if (!weeks.has(weekKey)) {
            weeks.set(weekKey, { label: formatWeekLabel(monday, sunday), orders: [] });
        }
        weeks.get(weekKey).orders.push(order);
    });

    return Array.from(weeks.values());
}

function formatWeekLabel(monday, sunday) {
    const opts = { day: 'numeric', month: 'short' };
    const m = monday.toLocaleDateString('es-MX', opts);
    const s = sunday.toLocaleDateString('es-MX', opts);
    return `Semana del ${m} al ${s}, ${sunday.getFullYear()}`;
}

// ============================================
// CREATE ORDER CARD HTML
// ============================================

function createOrderCard(order) {
    const statusColor = getStatusColor(order.status);
    const formattedDate = formatDate(order.order_date);
    const itemCount = order.item_count != null
        ? `${order.item_count} producto${order.item_count !== 1 ? 's' : ''}`
        : '';

    return `
        <div class="order-card order-card--${order.status}" onclick="toggleOrderDetails(${order.order_id}, this)">
            <div class="order-card-header">
                <div class="order-card-info">
                    <p class="order-card-name">${escapeHtml(order.customer_name)}</p>
                    <p class="order-card-branch">${escapeHtml(order.customer_branch)}</p>
                </div>
                <span class="badge" style="background-color: ${statusColor}; align-self: flex-start;">
                    ${translateStatus(order.status)}
                </span>
            </div>
            <div class="order-card-meta">
                <span>${formattedDate}</span>
                <span>${itemCount}</span>
                ${printedOrders.has(order.order_id) ? '<span class="printed-badge">Impreso ✓</span>' : ''}
            </div>
            <div id="order-details-${order.order_id}" class="order-card-details hidden">
                <div class="spinner" style="margin: 0.75rem auto; width: 24px; height: 24px; border-width: 2px;"></div>
            </div>
        </div>
    `;
}

// ============================================
// TOGGLE ORDER DETAILS (expand / collapse card)
// ============================================

async function toggleOrderDetails(orderId, cardEl) {
    const detailsEl = document.getElementById(`order-details-${orderId}`);

    if (!detailsEl.classList.contains('hidden')) {
        detailsEl.classList.add('hidden');
        cardEl.classList.remove('expanded');
        return;
    }

    detailsEl.classList.remove('hidden');
    cardEl.classList.add('expanded');

    // Already loaded — skip fetch
    if (!detailsEl.querySelector('.spinner')) return;

    try {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch order details');

        const order = await response.json();
        const printed = printedOrders.has(orderId);

        detailsEl.innerHTML = `
            <div class="order-card-expanded">
                <div class="order-items-list">
                    ${order.items.map(item => `
                        <div class="order-item-row">
                            <span>${escapeHtml(item.product_name)}</span>
                            <span class="text-muted">${item.quantity} unid.</span>
                        </div>
                    `).join('')}
                </div>
                ${order.notes ? `<p class="order-notes">${escapeHtml(order.notes)}</p>` : ''}
                ${order.customer_phone ? `<p class="order-phone">📞 ${escapeHtml(order.customer_phone)}</p>` : ''}
                <div class="order-actions">
                    ${printed ? '<span class="printed-badge">Impreso ✓</span>' : ''}
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); printOrder(${orderId})" title="Imprimir ticket">🖨️</button>
                    ${order.status === 'pending' ? `
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); updateOrderStatus(${orderId}, 'completed')">Completado</button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); updateOrderStatus(${orderId}, 'cancelled')">Cancelar</button>
                    ` : ''}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error fetching order details:', error);
        detailsEl.innerHTML = '<p class="text-muted" style="padding: 0.5rem 0; font-size: 0.85rem;">Error al cargar detalles</p>';
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

        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) throw new Error('Failed to update order status');

        showToast(`Pedido #${orderId} marcado como ${statusName}`, 'success');
        fetchOrders();

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
        fetchOrders();

    } catch (error) {
        console.error('Error printing recent orders:', error);
        showToast('Error al imprimir pedidos recientes', 'error');
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
// BACKGROUND REFRESH (non-disruptive)
// ============================================

async function refreshOrdersData() {
    try {
        const { date_from, date_to } = getDateRange(currentPeriod);
        const params = new URLSearchParams();
        if (currentStatus) params.set('status', currentStatus);
        if (date_from) params.set('date_from', date_from);
        if (date_to) params.set('date_to', date_to);

        const url = `${API_URL}/orders${params.toString() ? '?' + params.toString() : ''}`;
        const token = getAuthToken();

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            clearAuthToken();
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) return; // silently ignore on background refresh

        const freshOrders = await response.json();
        freshOrders.forEach(o => { if (o.has_print_jobs) printedOrders.add(o.order_id); });
        orders = freshOrders;

        // Only re-render if no card is currently open
        const hasExpandedCard = !!document.querySelector('.order-card.expanded');
        if (!hasExpandedCard) {
            if (orders.length === 0) {
                ordersContainer.classList.add('hidden');
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                ordersContainer.classList.remove('hidden');
                displayOrders();
            }
        }
        // else: data is updated in memory — DOM stays untouched until user closes the card

    } catch (error) {
        // silently ignore — background refresh should never disrupt the user
    }
}

// ============================================
// AUTO-REFRESH
// ============================================

setInterval(() => refreshOrdersData(), 30000);
setInterval(updateCurrentTime, 1000);

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateCurrentTime();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
