const state = {
  wishlistCount: 0,
  cartCount: 0,
  currentSlide: 0,
  autoAdvanceMs: 5000,
  theme: 'light',
  wishlist: new Set(),
  cart: [],
  filters: { category: 'all', minDiscount: 0, sortBy: 'popular' },
  // Wishlist V2
  user: null, // { id, name }
  wishlists: [], // { id, name, ownerId, members: [userId], items: [{ productId, size, note }] }
  contacts: [
    { id: 'u_bff', name: 'Bestie' },
    { id: 'u_mom', name: 'Mom' },
    { id: 'u_bro', name: 'Brother' },
    { id: 'u_dad', name: 'Dad' }
  ],
  sse: null,
  backendUrl: 'http://localhost:8787'
};

// Trending data (mock)
const trendingProducts = [
  { id: 1, brand: 'Roadster', title: 'Men Cotton Casual Shirt', price: 799, mrp: 1599, discount: 50, img: 'https://images.unsplash.com/photo-1521575107034-e0fa0b594529?q=80&w=800&auto=format&fit=crop', category: 'men' },
  { id: 2, brand: 'H&M', title: 'Oversized Tee', price: 499, mrp: 999, discount: 50, img: 'https://images.unsplash.com/photo-1520975693413-c78b37a21c79?q=80&w=800&auto=format&fit=crop', category: 'men' },
  { id: 3, brand: 'Puma', title: 'Running Shoes', price: 2199, mrp: 3999, discount: 45, img: 'https://images.unsplash.com/photo-1519744346363-66f7b52c4b04?q=80&w=800&auto=format&fit=crop', category: 'footwear' },
  { id: 4, brand: 'MANGO', title: 'Women Floral Dress', price: 1899, mrp: 3299, discount: 42, img: 'https://images.unsplash.com/photo-1520975651327-4b8a2f2a4a80?q=80&w=800&auto=format&fit=crop', category: 'women' },
  { id: 5, brand: 'Levi’s', title: '511 Slim Fit Jeans', price: 2499, mrp: 4199, discount: 40, img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800&auto=format&fit=crop', category: 'men' },
  { id: 6, brand: 'HRX', title: 'Training Joggers', price: 999, mrp: 1999, discount: 50, img: 'https://images.unsplash.com/photo-1520975403439-743d23976d2f?q=80&w=800&auto=format&fit=crop', category: 'men' },
  { id: 7, brand: 'Anouk', title: 'Printed Kurta', price: 1299, mrp: 2299, discount: 43, img: 'https://images.unsplash.com/photo-1552346989-1a6a1b6b8dc1?q=80&w=800&auto=format&fit=crop', category: 'women' },
  { id: 8, brand: 'WROGN', title: 'Casual Sneakers', price: 1499, mrp: 2999, discount: 50, img: 'https://images.unsplash.com/photo-1520975794856-6c1e0eac9b14?q=80&w=800&auto=format&fit=crop', category: 'footwear' },
  { id: 9, brand: 'HERE&NOW', title: 'Printed Tee', price: 599, mrp: 1199, discount: 50, img: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=800&auto=format&fit=crop', category: 'men' },
  { id: 10, brand: 'DressBerry', title: 'Shoulder Bag', price: 1399, mrp: 2499, discount: 44, img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=800&auto=format&fit=crop', category: 'accessories' },
];

function applyFilters(products) {
  let list = [...products];
  if (state.filters.category !== 'all') {
    list = list.filter(p => p.category === state.filters.category);
  }
  list = list.filter(p => p.discount >= state.filters.minDiscount);
  switch (state.filters.sortBy) {
    case 'priceAsc': list.sort((a,b) => a.price - b.price); break;
    case 'priceDesc': list.sort((a,b) => b.price - a.price); break;
    case 'discountDesc': list.sort((a,b) => b.discount - a.discount); break;
    default: break; // popular - leave order
  }
  return list;
}

function renderTrending() {
  const grid = document.getElementById('trendingGrid');
  if (!grid) return;
  const list = applyFilters(trendingProducts);
  grid.innerHTML = list.map(p => `
    <article class="card" data-id="${p.id}">
      <img src="${p.img}" alt="${p.brand} ${p.title}" data-quick-view>
      <button class="heart ${state.wishlist.has(p.id) ? 'active' : ''}" data-toggle-wishlist data-id="${p.id}">🤍</button>
      <div class="card-body">
        <div class="card-brand">${p.brand}</div>
        <div class="card-title">${p.title}</div>
        <div class="price-row">
          <span class="price">₹${p.price}</span>
          <span class="mrp">₹${p.mrp}</span>
          <span class="discount">${p.discount}% OFF</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-outline" data-add-to-cart data-id="${p.id}">Add to Bag</button>
        <button class="btn-outline" data-quick-view data-id="${p.id}">Quick View</button>
      </div>
    </article>
  `).join('');
}

function saveState() {
  localStorage.setItem('myntra_theme', state.theme);
  localStorage.setItem('myntra_wishlist', JSON.stringify(Array.from(state.wishlist)));
  localStorage.setItem('myntra_cart', JSON.stringify(state.cart));
  // V2 persistence
  if (state.user) localStorage.setItem('mw_user', JSON.stringify(state.user));
  localStorage.setItem('mw_wishlists', JSON.stringify(state.wishlists));
}

function loadState() {
  try {
    const theme = localStorage.getItem('myntra_theme');
    if (theme) state.theme = theme;
    const wl = JSON.parse(localStorage.getItem('myntra_wishlist') || '[]');
    state.wishlist = new Set(wl);
    const cart = JSON.parse(localStorage.getItem('myntra_cart') || '[]');
    state.cart = cart;
    state.wishlistCount = state.wishlist.size;
    state.cartCount = state.cart.length;
    // V2
    const user = JSON.parse(localStorage.getItem('mw_user') || 'null');
    state.user = user;
    state.wishlists = JSON.parse(localStorage.getItem('mw_wishlists') || '[]');
  } catch {}
}

function ensureUser() {
  if (state.user && state.user.id) return;
  const name = prompt('Enter a display name to start');
  const id = `u_${Math.random().toString(36).slice(2, 10)}`;
  state.user = { id, name: (name && name.trim()) ? name.trim() : `Guest-${id.slice(-4)}` };
  // Create a default personal wishlist if none exist
  if (!state.wishlists || state.wishlists.length === 0) {
    state.wishlists = [{ id: `wl_${Date.now()}`, name: 'Personal', ownerId: state.user.id, members: [], items: [] }];
  }
  saveState();
}

function getWishlistById(id) {
  return state.wishlists.find(w => w.id === id);
}

function upsertWishlist(w) {
  const idx = state.wishlists.findIndex(x => x.id === w.id);
  if (idx === -1) state.wishlists.push(w); else state.wishlists[idx] = w;
  saveState();
}

function showToast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.setAttribute('data-show', '1');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.removeAttribute('data-show'), 1800);
}

function addItemToWishlist(wishlistId, productId, size, note) {
  const w = getWishlistById(wishlistId);
  if (!w) return;
  const normalizedSize = (size === undefined) ? null : size;
  const exists = w.items.find(i => i.productId === productId && ((i.size === undefined ? null : i.size) === normalizedSize));
  if (exists) {
    showToast('Already in wishlist');
    return;
  }
  w.items.push({ productId, size: normalizedSize, note: note || '' });
  upsertWishlist(w);
  // also update simple wishlist count/badge for backward compatibility
  state.wishlist.add(productId);
  state.wishlistCount = state.wishlist.size;
  document.getElementById('wishlistCount').textContent = String(state.wishlistCount);
  showToast('Added to wishlist');
}

function dedupeWishlistItems(w) {
  const seen = new Set();
  const unique = [];
  for (const it of (w.items || [])) {
    const key = `${it.productId}|${(it.size === undefined ? null : it.size)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // normalize size to null
    unique.push({ productId: it.productId, size: (it.size === undefined ? null : it.size), note: it.note || '' });
  }
  if (unique.length !== (w.items || []).length) {
    w.items = unique;
    upsertWishlist(w);
  }
  return w;
}

function removeItemFromWishlist(wishlistId, productId, size) {
  const w = getWishlistById(wishlistId);
  if (!w) return;
  w.items = w.items.filter(i => !(i.productId === productId && (size ? i.size === size : true)));
  upsertWishlist(w);
}

function showModal(id) { const m = document.getElementById(id); if (m) m.setAttribute('aria-hidden', 'false'); }
function hideModal(id) { const m = document.getElementById(id); if (m) m.setAttribute('aria-hidden', 'true'); }

let pickerContext = { productId: null, selectedWishlistId: null };

function openWishlistPicker(productId) {
  ensureUser();
  pickerContext.productId = productId;
  // render lists
  const container = document.getElementById('wishlistPickerLists');
  const preview = document.getElementById('pickerProductPreview');
  const product = trendingProducts.find(p => p.id === productId);
  if (container) {
    container.innerHTML = state.wishlists.map(w => `
      <label class="wl-row">
        <input type="radio" name="wlPick" value="${w.id}">
        <button type="button" class="wl-name" data-view-wl="${w.id}">${w.name}</button>
        <span class="wl-meta">${w.items.length} items</span>
        ${w.ownerId === state.user.id ? '<button class="tiny" data-open-share data-wid="'+w.id+'">Share</button>' : ''}
      </label>
    `).join('');
  }
  if (preview) {
    if (product) {
      preview.innerHTML = `
        <div class="picker-preview">
          <img src="${product.img}" alt="${product.brand} ${product.title}">
          <div>
            <div class="card-brand">${product.brand}</div>
            <div class="card-title">${product.title}</div>
          </div>
        </div>`;
    } else {
      preview.innerHTML = `<div class="muted">Select a wishlist to manage or share</div>`;
    }
  }
  showModal('wishlistPicker');
}

function renderWishlistContents(wishlistId) {
  const w = dedupeWishlistItems(getWishlistById(wishlistId));
  const preview = document.getElementById('pickerProductPreview');
  if (!w || !preview) return;
  if (!w.items.length) {
    preview.innerHTML = `<div class="muted">No items in "${w.name}" yet.</div>`;
    return;
  }
  const items = w.items.map(it => {
    const p = trendingProducts.find(tp => tp.id === it.productId);
    if (!p) return '';
    return `
      <div class="wl-item" data-wid="${w.id}" data-pid="${p.id}">
        <img src="${p.img}" alt="${p.brand} ${p.title}">
        <div class="wl-item-info">
          <div class="card-brand">${p.brand}</div>
          <div class="card-title">${p.title}</div>
          <div class="price">₹${p.price}</div>
        </div>
        <button class="tiny danger" data-remove-wl-item>Remove</button>
      </div>`;
  }).join('');
  preview.innerHTML = `<div class="wishlist-items">${items}</div>`;
}

function setupWishlistPicker() {
  const picker = document.getElementById('wishlistPicker');
  if (!picker) return;
  picker.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.hasAttribute('data-close-modal')) {
      // Fallback: if a product was intended to be added but no list selected, add to Personal
      if (pickerContext.productId && !pickerContext.selectedWishlistId) {
        let personal = state.wishlists.find(w => w.ownerId === state.user.id && w.name.toLowerCase() === 'personal');
        if (!personal) {
          personal = { id: `wl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name: 'Personal', ownerId: state.user.id, members: [], items: [] };
          state.wishlists.push(personal);
        }
        addItemToWishlist(personal.id, pickerContext.productId);
        renderTrending();
        broadcastLocalChange({ type: 'item:add', wishlistId: personal.id, productId: pickerContext.productId });
      }
      hideModal('wishlistPicker');
    }
    if (target && target.matches('input[name="wlPick"]')) {
      pickerContext.selectedWishlistId = target.value;
      // If adding from a product, single select should add immediately
      if (pickerContext.productId) {
        addItemToWishlist(pickerContext.selectedWishlistId, pickerContext.productId, null);
        hideModal('wishlistPicker');
        renderTrending();
        broadcastLocalChange({ type: 'item:add', wishlistId: pickerContext.selectedWishlistId, productId: pickerContext.productId });
      }
    }
    // View wishlist contents when clicking on wishlist name
    if (target && target.matches('[data-view-wl]')) {
      const wid = target.getAttribute('data-view-wl');
      pickerContext.selectedWishlistId = wid;
      renderWishlistContents(wid);
    }
    if (target && target.id === 'createWishlistBtn') {
      const input = document.getElementById('newWishlistName');
      const name = input ? input.value.trim() : '';
      if (name) {
        const w = { id: `wl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name, ownerId: state.user.id, members: [], items: [] };
        state.wishlists.push(w);
        saveState();
        openWishlistPicker(pickerContext.productId);
      }
    }
    if (target && target.id === 'openShareFromPicker') {
      if (!pickerContext.selectedWishlistId) return alert('Pick a wishlist first');
      openShareWishlist(pickerContext.selectedWishlistId);
    }
    if (target && target.matches('[data-open-share]')) {
      const wid = target.getAttribute('data-wid');
      openShareWishlist(wid);
    }
    if (target && target.matches('[data-remove-wl-item]')) {
      const itemRow = target.closest('.wl-item');
      if (!itemRow) return;
      const wid = itemRow.getAttribute('data-wid');
      const pid = Number(itemRow.getAttribute('data-pid'));
      removeItemFromWishlist(wid, pid);
      renderWishlistContents(wid);
      renderTrending();
    }
    // removed confirmAddBtn path
  });

  // Confirm add on double click of a wl-row
  picker.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.wl-row');
    if (!row) return;
    const radio = row.querySelector('input[type="radio"]');
    if (radio) {
      pickerContext.selectedWishlistId = radio.value;
      if (pickerContext.productId) {
        addItemToWishlist(pickerContext.selectedWishlistId, pickerContext.productId);
        hideModal('wishlistPicker');
        renderTrending();
        broadcastLocalChange({ type: 'item:add', wishlistId: pickerContext.selectedWishlistId, productId: pickerContext.productId });
      } else {
        // No product selected: treat dblclick as quick-share/manage shortcut
        openShareWishlist(pickerContext.selectedWishlistId);
      }
    }
  });
}

function openShareWishlist(wishlistId) {
  const w = getWishlistById(wishlistId);
  if (!w) return;
  document.getElementById('shareWishlistName').textContent = w.name;
  const contactsList = document.getElementById('contactsList');
  const shareLinkInput = document.getElementById('shareLink');
  const selected = new Set(w.members);
  if (contactsList) {
    contactsList.innerHTML = state.contacts.map(c => `
      <label class="contact-row">
        <input type="checkbox" value="${c.id}" ${selected.has(c.id) ? 'checked' : ''}>
        <span>${c.name}</span>
      </label>
    `).join('');
  }
  showModal('shareWishlist');
  const confirm = document.getElementById('confirmShareBtn');
  confirm.onclick = async () => {
    const inputs = contactsList.querySelectorAll('input[type="checkbox"]');
    const members = Array.from(inputs).filter(i => i.checked).map(i => i.value);
    w.members = members;
    upsertWishlist(w);
    hideModal('shareWishlist');
    broadcastLocalChange({ type: 'share:update', wishlistId: w.id, members });
    await syncToBackend('share', { wishlist: w });
  };
  // Create shareable link (encoded in URL hash)
  if (shareLinkInput) {
    const data = { id: w.id, name: w.name, items: w.items };
    const enc = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    shareLinkInput.value = `${location.origin}${location.pathname}#wishlist=${enc}`;
  }
  const copyBtn = document.getElementById('copyShareLink');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(shareLinkInput.value);
        showToast('Link copied');
      } catch { showToast('Copy failed'); }
    };
  }
}

// Basic backend integration and realtime
async function syncToBackend(kind, payload) {
  try {
    await fetch(`${state.backendUrl}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, user: state.user, payload }) });
  } catch {}
}

function initSSE() {
  try {
    if (state.sse) { state.sse.close(); }
    const url = `${state.backendUrl}/events?userId=${encodeURIComponent(state.user.id)}`;
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleIncomingEvent(msg);
      } catch {}
    };
    state.sse = es;
  } catch {}
}

function handleIncomingEvent(msg) {
  if (!msg || msg.senderId === state.user.id) return; // ignore own
  if (msg.type === 'item:add') {
    const { wishlistId, productId } = msg;
    addItemToWishlist(wishlistId, productId);
    renderTrending();
  }
  if (msg.type === 'share:update') {
    const w = getWishlistById(msg.wishlistId);
    if (w) { w.members = msg.members; upsertWishlist(w); }
  }
}

function broadcastLocalChange(evt) {
  try { navigator.serviceWorker; } catch {}
  // Local multi-tab broadcast using storage event mirror
  localStorage.setItem('mw_broadcast', JSON.stringify({ ...evt, senderId: state.user.id, ts: Date.now() }));
}

function listenLocalBroadcast() {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'mw_broadcast' || !e.newValue) return;
    const msg = JSON.parse(e.newValue);
    handleIncomingEvent(msg);
  });
}

function setupCartWishlist() {
  const wishlistCountEl = document.getElementById('wishlistCount');
  const cartCountEl = document.getElementById('cartCount');

  document.body.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.matches('[data-add-to-cart]')) {
      const id = Number(target.getAttribute('data-id'));
      state.cart.push(id);
      state.cartCount = state.cart.length;
      cartCountEl.textContent = String(state.cartCount);
      saveState();
    }
    if (target && target.matches('[data-toggle-wishlist]')) {
      const id = Number(target.getAttribute('data-id'));
      openWishlistPicker(id);
    }
    if (target && target.matches('[data-quick-view]')) {
      const id = Number(target.getAttribute('data-id'));
      openQuickView(id);
    }
  });

  // Simulate wishlist increments when double-clicking product images
  document.body.addEventListener('dblclick', (e) => {
    const target = e.target;
    if (target && target.tagName === 'IMG') {
      const card = target.closest('.card');
      if (card) {
        const id = Number(card.getAttribute('data-id'));
        if (!state.wishlist.has(id)) {
          state.wishlist.add(id);
          state.wishlistCount = state.wishlist.size;
          wishlistCountEl.textContent = String(state.wishlistCount);
          saveState();
          renderTrending();
        }
      }
    }
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      alert(`Searching for: ${input.value}`);
    }
  });
}

function setupControls() {
  const category = document.getElementById('filterCategory');
  const discount = document.getElementById('filterDiscount');
  const sortBy = document.getElementById('sortBy');
  if (!category || !discount || !sortBy) return;
  category.value = state.filters.category;
  discount.value = String(state.filters.minDiscount);
  sortBy.value = state.filters.sortBy;
  const update = () => { renderTrending(); };
  category.addEventListener('change', () => { state.filters.category = category.value; update(); });
  discount.addEventListener('change', () => { state.filters.minDiscount = Number(discount.value); update(); });
  sortBy.addEventListener('change', () => { state.filters.sortBy = sortBy.value; update(); });
}

function setupTheme() {
  const btn = document.getElementById('themeToggle');
  const apply = () => { document.documentElement.setAttribute('data-theme', state.theme); };
  apply();
  if (btn) {
    btn.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      apply();
      saveState();
    });
  }
}

function openQuickView(id) {
  const p = trendingProducts.find(x => x.id === id);
  const modal = document.getElementById('quickView');
  const body = document.getElementById('modalBody');
  if (!p || !modal || !body) return;
  body.innerHTML = `
    <img src="${p.img}" alt="${p.brand} ${p.title}">
    <div class="modal-info">
      <h3>${p.brand}</h3>
      <p>${p.title}</p>
      <div class="price-row">
        <span class="price">₹${p.price}</span>
        <span class="mrp">₹${p.mrp}</span>
        <span class="discount">${p.discount}% OFF</span>
      </div>
      <div class="modal-actions">
        <button class="btn-primary" data-add-to-cart data-id="${p.id}">Add to Bag</button>
        <button class="btn-outline" data-toggle-wishlist data-id="${p.id}">${state.wishlist.has(p.id) ? 'Remove Wishlist' : 'Add Wishlist'}</button>
      </div>
    </div>`;
  modal.setAttribute('aria-hidden', 'false');
}

function setupModal() {
  const modal = document.getElementById('quickView');
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.hasAttribute('data-close-modal')) {
      modal.setAttribute('aria-hidden', 'true');
    }
  });
}

// Carousel
function setupCarousel() {
  const carousel = document.getElementById('heroCarousel');
  if (!carousel) return;
  const track = carousel.querySelector('.carousel-track');
  const slides = Array.from(track.children);
  const dotsContainer = carousel.querySelector('.carousel-dots');
  const prevBtn = carousel.querySelector('.prev');
  const nextBtn = carousel.querySelector('.next');

  function update(activeIndex) {
    state.currentSlide = (activeIndex + slides.length) % slides.length;
    const offset = -state.currentSlide * 100;
    track.style.transform = `translateX(${offset}%)`;
    dotsContainer.querySelectorAll('button').forEach((d, i) => d.classList.toggle('active', i === state.currentSlide));
  }

  // dots
  dotsContainer.innerHTML = slides.map((_, i) => `<button aria-label="Go to slide ${i+1}"></button>`).join('');
  dotsContainer.querySelectorAll('button').forEach((dot, i) => dot.addEventListener('click', () => update(i)));

  prevBtn.addEventListener('click', () => update(state.currentSlide - 1));
  nextBtn.addEventListener('click', () => update(state.currentSlide + 1));

  // auto advance
  let timer = setInterval(() => update(state.currentSlide + 1), state.autoAdvanceMs);
  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', () => timer = setInterval(() => update(state.currentSlide + 1), state.autoAdvanceMs));

  update(0);
}

function setYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  ensureUser();
  // Normalize existing wishlists to remove duplicates
  state.wishlists = (state.wishlists || []).map(dedupeWishlistItems);
  // If URL has a shared wishlist, import it as a new list (no members)
  try {
    const m = location.hash.match(/#wishlist=([^&]+)/);
    if (m) {
      const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
      const data = JSON.parse(json);
      if (data && data.items) {
        const newId = `wl_shared_${Date.now()}`;
        state.wishlists.push({ id: newId, name: data.name || 'Shared', ownerId: state.user.id, members: [], items: data.items });
        saveState();
        location.hash = '';
        showToast('Imported shared wishlist');
      }
    }
  } catch {}
  document.getElementById('wishlistCount').textContent = String(state.wishlistCount);
  document.getElementById('cartCount').textContent = String(state.cartCount);
  setupTheme();
  renderTrending();
  setupControls();
  setupCartWishlist();
  setupSearch();
  setupCarousel();
  setupModal();
  setupWishlistPicker();
  listenLocalBroadcast();
  initSSE();
  setYear();

  // Header Wishlist button opens the picker as a manager/share modal
  const headerWishlistBtn = document.querySelector('.action[aria-label="Wishlist"]');
  if (headerWishlistBtn) {
    headerWishlistBtn.addEventListener('click', () => openWishlistPicker(null));
  }
});


