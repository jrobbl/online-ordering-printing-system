let allProducts = [];
let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const ok = await requireAuth();
    if (!ok) return;

    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('add-product-btn').addEventListener('click', () => openModal(null));
    document.getElementById('product-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('product-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('product-modal')) closeModal();
    });

    await loadProducts();
});

async function loadProducts() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('products-container').innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/admin/products`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (!res.ok) throw new Error();
        allProducts = await res.json();
        renderProducts();
    } catch {
        document.getElementById('empty-state').classList.remove('hidden');
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function renderProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';

    if (allProducts.length === 0) {
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }
    document.getElementById('empty-state').classList.add('hidden');

    const byCategory = {};
    for (const p of allProducts) {
        if (!byCategory[p.category]) byCategory[p.category] = [];
        byCategory[p.category].push(p);
    }

    for (const cat of Object.keys(byCategory).sort()) {
        const section = document.createElement('div');
        section.className = 'product-category-section';

        const title = document.createElement('h3');
        title.className = 'category-heading';
        title.textContent = cat;
        section.appendChild(title);

        for (const p of byCategory[cat]) {
            section.appendChild(makeProductRow(p));
        }
        container.appendChild(section);
    }
}

function makeProductRow(p) {
    const row = document.createElement('div');
    row.className = `product-row${p.active ? '' : ' product-paused'}`;

    row.innerHTML = `
        <span class="product-name">${p.product_name}</span>
        <div class="product-actions">
            <button class="btn btn-sm ${p.active ? 'btn-pause' : 'btn-resume'}"
                onclick="toggleActive(${p.product_id}, ${p.active})">
                ${p.active ? 'Pausar' : 'Reanudar'}
            </button>
            <button class="btn btn-sm btn-outline" onclick="openModal(${p.product_id})">✎ Editar</button>
        </div>
    `;
    return row;
}

async function toggleActive(id, currentActive) {
    try {
        const res = await fetch(`${API_URL}/admin/products/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ active: !currentActive })
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        const idx = allProducts.findIndex(p => p.product_id === id);
        if (idx !== -1) allProducts[idx] = updated;
        renderProducts();
    } catch {
        alert('No se pudo actualizar el producto');
    }
}

function openModal(id) {
    editingId = id;

    const categories = [...new Set(allProducts.map(p => p.category))].sort();
    const select = document.getElementById('product-category-select');
    select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');

    if (id !== null) {
        const p = allProducts.find(p => p.product_id === id);
        document.getElementById('modal-title').textContent = 'Editar Producto';
        document.getElementById('product-name-input').value = p.product_name;
        select.value = p.category;
    } else {
        document.getElementById('modal-title').textContent = 'Agregar Producto';
        document.getElementById('product-name-input').value = '';
        select.selectedIndex = 0;
    }

    document.getElementById('product-modal').classList.remove('hidden');
    document.getElementById('product-name-input').focus();
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
    editingId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('product-name-input').value.trim();
    const category = document.getElementById('product-category-select').value;
    if (!name || !category) return;

    const isEdit = editingId !== null;
    const url = isEdit ? `${API_URL}/admin/products/${editingId}` : `${API_URL}/admin/products`;

    try {
        const res = await fetch(url, {
            method: isEdit ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ product_name: name, category })
        });
        if (!res.ok) throw new Error();
        const product = await res.json();

        if (isEdit) {
            const idx = allProducts.findIndex(p => p.product_id === editingId);
            if (idx !== -1) allProducts[idx] = product;
        } else {
            allProducts.push(product);
        }

        closeModal();
        renderProducts();
    } catch {
        alert('No se pudo guardar el producto');
    }
}
