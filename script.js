const state = {
  wishlistCount: 0,
  cartCount: 0,
  currentSlide: 0,
  autoAdvanceMs: 5000,
  theme: 'light',
  wishlist: new Set(), // legacy single wishlist ids
  cart: [],
  filters: { category: 'all', minDiscount: 0, sortBy: 'popular' },
  room: { id: '', name: '', contacts: [], api: null },
  // Multi-wishlist
  user: { id: '', name: '' },
  wishlists: [], // {id, name, ownerId, members: [userId], items: [{productId, size, note}]}
  contacts: [
    { id: 'u-aarav', name: 'Aarav', email: 'aarav@example.com' },
    { id: 'u-vani', name: 'Vani', email: 'vani@example.com' },
    { id: 'u-ishita', name: 'Ishita', email: 'ishita@example.com' },
    { id: 'u-kiran', name: 'Kiran', email: 'kiran@example.com' },
    { id: 'u-rohan', name: 'Rohan', email: 'rohan@example.com' },
  ],
  channel: null,
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
        <button class="btn-outline" data-add-to-wishlist data-id="${p.id}">Add to Wishlist</button>
      </div>
    </article>
  `).join('');
}

function saveState() {
  localStorage.setItem('myntra_theme', state.theme);
  localStorage.setItem('myntra_wishlist', JSON.stringify(Array.from(state.wishlist)));
  localStorage.setItem('myntra_cart', JSON.stringify(state.cart));
  localStorage.setItem('myntra_user', JSON.stringify(state.user));
  localStorage.setItem('myntra_wishlists_v2', JSON.stringify(state.wishlists));
  // broadcast
  try { if (state.channel) state.channel.postMessage({ type: 'state:update' }); } catch {}
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
    const user = JSON.parse(localStorage.getItem('myntra_user') || 'null');
    if (user && user.id) state.user = user;
    const lists = JSON.parse(localStorage.getItem('myntra_wishlists_v2') || '[]');
    state.wishlists = Array.isArray(lists) ? lists : [];
  } catch {}
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
    if (target && target.matches('[data-add-to-wishlist]')) {
      const id = Number(target.getAttribute('data-id'));
      openPickerModal(id);
    }
    if (target && target.matches('[data-toggle-wishlist]')) {
      const id = Number(target.getAttribute('data-id'));
      if (state.wishlist.has(id)) { state.wishlist.delete(id); } else { state.wishlist.add(id); }
      state.wishlistCount = state.wishlist.size;
      wishlistCountEl.textContent = String(state.wishlistCount);
      saveState();
      renderTrending();
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

// -------- Profile / User --------
function ensureUserProfile() {
  if (state.user && state.user.id) return;
  let name = '';
  try { name = (localStorage.getItem('myntra_display_name') || '').trim(); } catch {}
  if (!name) {
    name = prompt('Enter display name');
  }
  name = (name || 'Guest').trim().slice(0, 40);
  const id = 'u-' + Math.random().toString(36).slice(2, 10);
  state.user = { id, name };
  try { localStorage.setItem('myntra_display_name', name); } catch {}
  document.getElementById('profileLabel').textContent = name;
  saveState();
}

function setupProfileButton() {
  const btn = document.getElementById('profileButton');
  if (btn) {
    btn.addEventListener('click', () => {
      const newName = prompt('Update display name', state.user.name || '');
      if (newName && newName.trim()) {
        state.user.name = newName.trim();
        localStorage.setItem('myntra_display_name', state.user.name);
        document.getElementById('profileLabel').textContent = state.user.name;
        saveState();
      }
    });
  }
}

// -------- Multi-Wishlist Model & UI --------
function generateId(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 9); }

function getUserLists() {
  return state.wishlists.filter(w => w.ownerId === state.user.id || (w.members || []).includes(state.user.id));
}

function upsertWishlist(list) {
  const idx = state.wishlists.findIndex(l => l.id === list.id);
  if (idx >= 0) state.wishlists[idx] = list; else state.wishlists.push(list);
  saveState();
}

function removeWishlist(id) {
  state.wishlists = state.wishlists.filter(l => l.id !== id);
  saveState();
}

function addItemToList(listId, productId, size, note) {
  const list = state.wishlists.find(l => l.id === listId);
  if (!list) return { ok: false, reason: 'List missing' };
  list.items = list.items || [];
  if (list.items.some(it => it.productId === productId && it.size === size)) {
    return { ok: false, reason: 'Duplicate' };
  }
  list.items.push({ productId, size: size || '', note: note || '' });
  upsertWishlist(list);
  toast('Added to "' + list.name + '"');
  return { ok: true };
}

function openWishlistModal() {
  const modal = document.getElementById('wishlistModal');
  const body = document.getElementById('wishlistModalBody');
  if (!modal || !body) return;
  const lists = getUserLists();
  body.innerHTML = `
    <div class="wishlist-header">
      <input id="newListName" class="input" placeholder="New wishlist name (e.g. Personal)" />
      <button class="btn-primary" id="createList">Create</button>
    </div>
    <div class="wishlist-list">
      ${lists.map(l => `
        <div class="wishlist-item" data-id="${l.id}">
          <div class="wishlist-row">
            <strong>${l.name}</strong>
            <div class="wishlist-actions">
              <button class="btn-outline" data-share-list data-id="${l.id}">Share</button>
              <button class="btn-outline" data-delete-list data-id="${l.id}">Delete</button>
            </div>
          </div>
          <div class="wishlist-row">
            <small>Members: ${[l.ownerId, ...(l.members||[])].length}</small>
            <small>Items: ${(l.items||[]).length}</small>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  modal.setAttribute('aria-hidden', 'false');

  body.querySelector('#createList').addEventListener('click', () => {
    const name = body.querySelector('#newListName').value.trim();
    if (!name) return;
    const list = { id: generateId('wl'), name, ownerId: state.user.id, members: [], items: [] };
    upsertWishlist(list);
    openWishlistModal();
  });

  body.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.matches('[data-delete-list]')) {
      const id = t.getAttribute('data-id');
      if (confirm('Delete this wishlist?')) { removeWishlist(id); openWishlistModal(); }
    }
    if (t && t.matches('[data-share-list]')) {
      const id = t.getAttribute('data-id');
      openShareModal(id);
    }
  });
}

function openShareModal(listId) {
  const modal = document.getElementById('pickerModal');
  const body = document.getElementById('pickerModalBody');
  if (!modal || !body) return;
  const list = state.wishlists.find(l => l.id === listId);
  const url = new URL(window.location.href);
  url.searchParams.set('join', listId);
  body.innerHTML = `
    <div class="wishlist-header">
      <div style="display:grid; gap:8px; width:100%">
        <label>Shareable link</label>
        <div style="display:flex; gap:8px;">
          <input class="input" id="shareLink" value="${url.toString()}" readonly />
          <button class="btn-primary" id="copyShare">Copy</button>
        </div>
        <label>Add members from contacts</label>
        <div class="picker-list">
          ${state.contacts.map(c => `
            <div class="picker-row">
              <div>${c.name} <small style="opacity:.7">${c.email}</small></div>
              <button class="btn-outline" data-add-member data-uid="${c.id}">Add</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  modal.setAttribute('aria-hidden', 'false');

  body.querySelector('#copyShare').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(body.querySelector('#shareLink').value); toast('Link copied'); } catch {}
  });

  body.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.matches('[data-add-member]')) {
      const uid = t.getAttribute('data-uid');
      const l = state.wishlists.find(x => x.id === listId);
      if (!l.members) l.members = [];
      if (!l.members.includes(uid) && uid !== l.ownerId) {
        l.members.push(uid);
        upsertWishlist(l);
        toast('Member added');
      } else {
        toast('Already a member');
      }
    }
  });
}

function openPickerModal(productId) {
  const modal = document.getElementById('pickerModal');
  const body = document.getElementById('pickerModalBody');
  if (!modal || !body) return;
  const lists = getUserLists();
  body.innerHTML = `
    <div style="display:grid; gap:12px; width:100%">
      <div class="wishlist-header">
        <input id="pickerNewList" class="input" placeholder="Create new wishlist" />
        <button class="btn-primary" id="pickerCreate">Create</button>
      </div>
      <div>
        <label>Choose wishlist</label>
        <div class="picker-list">
          ${lists.map(l => `
            <div class="picker-row">
              <div>${l.name}</div>
              <button class="btn-outline" data-pick-list data-id="${l.id}">Add Here</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  modal.setAttribute('aria-hidden', 'false');

  body.querySelector('#pickerCreate').addEventListener('click', () => {
    const name = body.querySelector('#pickerNewList').value.trim();
    if (!name) return;
    const list = { id: generateId('wl'), name, ownerId: state.user.id, members: [], items: [] };
    upsertWishlist(list);
    openPickerModal(productId);
  });

  body.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.matches('[data-pick-list]')) {
      const listId = t.getAttribute('data-id');
      const res = addItemToList(listId, productId, '', '');
      if (!res.ok && res.reason === 'Duplicate') toast('Already in wishlist');
    }
  });
}

// Close wishlist/picker modals
function setupWishlistModals() {
  const wishlistModal = document.getElementById('wishlistModal');
  const pickerModal = document.getElementById('pickerModal');
  if (wishlistModal) wishlistModal.addEventListener('click', (e) => { const t = e.target; if (t && t.hasAttribute('data-close-wishlist')) wishlistModal.setAttribute('aria-hidden','true'); });
  if (pickerModal) pickerModal.addEventListener('click', (e) => { const t = e.target; if (t && t.hasAttribute('data-close-picker')) pickerModal.setAttribute('aria-hidden','true'); });
  const openBtn = document.getElementById('openWishlist');
  if (openBtn) openBtn.addEventListener('click', openWishlistModal);
}

// Shareable join link handler
function handleJoinLink() {
  const params = new URLSearchParams(window.location.search);
  const joinId = params.get('join');
  if (joinId) {
    const list = state.wishlists.find(l => l.id === joinId);
    if (list) {
      if (!list.members) list.members = [];
      if (!list.members.includes(state.user.id) && state.user.id !== list.ownerId) {
        list.members.push(state.user.id);
        upsertWishlist(list);
        toast('You joined "' + list.name + '"');
      }
    }
  }
}

// Toasts
function toast(message) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => { el.remove(); }, 1800);
}

// Realtime sync across tabs
function setupRealtime() {
  try {
    state.channel = new BroadcastChannel('myntra-sync');
    state.channel.onmessage = (ev) => {
      if (ev && ev.data && ev.data.type === 'state:update') {
        // Refresh from storage and rerender
        const prevWishlists = JSON.stringify(state.wishlists);
        loadState();
        if (prevWishlists !== JSON.stringify(state.wishlists)) {
          // update header counts and any open modals
          document.getElementById('wishlistCount').textContent = String(state.wishlist.size);
          renderTrending();
          // if wishlist modal is open, rerender it
          const wm = document.getElementById('wishlistModal');
          if (wm && wm.getAttribute('aria-hidden') === 'false') openWishlistModal();
        }
      }
    };
  } catch {
    window.addEventListener('storage', (e) => {
      if (e.key === 'myntra_wishlists_v2' || e.key === 'myntra_wishlist') {
        loadState();
        renderTrending();
      }
    });
  }
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

// -------- Rooms / Group call using Jitsi --------
function randomRoomId() {
  return 'weforshe-' + Math.random().toString(36).slice(2, 8);
}

function openRoomModal(prefill) {
  const modal = document.getElementById('roomModal');
  const body = document.getElementById('roomModalBody');
  if (!modal || !body) return;
  const contacts = [
    'Aarav', 'Vani', 'Ishita', 'Kiran', 'Rohan', 'Nisha', 'Meera', 'Rahul', 'Aisha', 'Kabir'
  ];
  const roomId = (prefill && prefill.roomId) || randomRoomId();
  const roomName = (prefill && prefill.roomName) || 'Shopping Room';
  const inviteUrl = new URL(window.location.href);
  inviteUrl.searchParams.set('room', roomId);
  body.innerHTML = `
    <form class="room-form" id="roomForm">
      <div class="room-row">
        <label for="roomName">Room name</label>
        <input id="roomName" type="text" value="${roomName}" />
      </div>
      <div class="room-row">
        <label for="roomContacts">Add friends</label>
        <select id="roomContacts" multiple size="6">${contacts.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        <div class="chips" id="selectedChips"></div>
      </div>
      <div class="room-row">
        <label>Invite link</label>
        <div style="display:flex; gap:8px;">
          <input id="inviteLink" type="text" value="${inviteUrl.toString()}" readonly />
          <button type="button" class="btn-primary" id="copyInvite">Copy</button>
        </div>
      </div>
      <div class="room-actions">
        <button type="button" class="btn-outline" id="joinWithLink">Join via link</button>
        <button type="submit" class="btn-primary">Create & Start</button>
      </div>
    </form>
  `;
  modal.setAttribute('aria-hidden', 'false');

  const multi = body.querySelector('#roomContacts');
  const chips = body.querySelector('#selectedChips');
  function renderChips() {
    const values = Array.from(multi.selectedOptions).map(o => o.value);
    chips.innerHTML = values.map(v => `<span class="chip">${v}</span>`).join('');
  }
  multi.addEventListener('change', renderChips);
  renderChips();

  body.querySelector('#copyInvite').addEventListener('click', async () => {
    const input = body.querySelector('#inviteLink');
    try { await navigator.clipboard.writeText(input.value); } catch {}
    (body.querySelector('#copyInvite')).textContent = 'Copied';
    setTimeout(() => (body.querySelector('#copyInvite')).textContent = 'Copy', 1200);
  });

  body.querySelector('#joinWithLink').addEventListener('click', () => {
    window.location.href = body.querySelector('#inviteLink').value;
  });

  body.querySelector('#roomForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = body.querySelector('#roomName').value.trim() || 'Shopping Room';
    const selected = Array.from(multi.selectedOptions).map(o => o.value);
    state.room.name = name;
    state.room.contacts = selected;
    state.room.id = roomId;
    startRoom(roomId, name);
    modal.setAttribute('aria-hidden', 'true');
  });
}

function startRoom(roomId, roomName) {
  const section = document.getElementById('roomSection');
  const container = document.getElementById('jitsiContainer');
  if (!section || !container || !window.JitsiMeetExternalAPI) {
    alert('Video SDK failed to load. Please check your connection.');
    return;
  }
  section.hidden = false;
  container.innerHTML = '';
  if (state.room.api) {
    try { state.room.api.dispose(); } catch {}
    state.room.api = null;
  }
  const domain = 'meet.jit.si';
  const options = {
    roomName: roomId,
    parentNode: container,
    userInfo: { displayName: 'Guest' },
    configOverwrite: { disableDeepLinking: true },
    interfaceConfigOverwrite: { APP_NAME: roomName }
  };
  const api = new JitsiMeetExternalAPI(domain, options);
  state.room.api = api;
  // Expose simple screen share shortcut
  api.addListener('videoConferenceJoined', () => {
    // nothing else; toolbar has screen share button by default
  });
}

function setupRoomUX() {
  const btn = document.getElementById('roomButton');
  const modal = document.getElementById('roomModal');
  if (btn) {
    btn.addEventListener('click', () => openRoomModal());
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      const t = e.target;
      if (t && (t.hasAttribute('data-close-room'))) {
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  }
  // Deep link join via ?room=xyz
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  if (roomId) {
    startRoom(roomId, 'Shopping Room');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  document.getElementById('wishlistCount').textContent = String(state.wishlistCount);
  document.getElementById('cartCount').textContent = String(state.cartCount);
  setupTheme();
  renderTrending();
  setupControls();
  setupCartWishlist();
  setupSearch();
  setupCarousel();
  setupModal();
  setupRoomUX();
  setYear();
  ensureUserProfile();
  setupProfileButton();
  document.getElementById('profileLabel').textContent = state.user.name || 'Profile';
  setupWishlistModals();
  handleJoinLink();
  setupRealtime();
});


