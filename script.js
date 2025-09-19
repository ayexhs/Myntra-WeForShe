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
  friends: [], // array of {id, name, email}
  friendRequests: [], // outgoing {id, name, email, token, status: 'sent'|'accepted'|'rejected'}
  incomingRequests: [], // incoming {id, name, email, fromUserId, status: 'pending'|'accepted'|'rejected'}
  wishlists: [], // {id, name, ownerId, members: [userId], items: [{productId, size, note}]}
  incomingListInvites: [], // { token, list: {id,name,ownerId,members,items}, from: {id,name,email} }
  contacts: [
    { id: 'u-aarav', name: 'Aarav', email: 'aarav@example.com' },
    { id: 'u-vani', name: 'Vani', email: 'vani@example.com' },
    { id: 'u-ishita', name: 'Ishita', email: 'ishita@example.com' },
    { id: 'u-kiran', name: 'Kiran', email: 'kiran@example.com' },
    { id: 'u-rohan', name: 'Rohan', email: 'rohan@example.com' },
  ],
  channel: null,
  friendRequests: [], // {id, name, email, token}
};

// Trending data (mock)
const trendingProducts = [
  { id: 1, brand: 'Roadster', title: 'Men Cotton Casual Shirt', price: 799, mrp: 1599, discount: 50, img: 'static/Images/RoadsterShirt.jpeg', category: 'men' },
  { id: 2, brand: 'H&M', title: 'Oversized Tee', price: 499, mrp: 999, discount: 50, img: './static/Images/OversizedTee.jpeg', category: 'men' },
  { id: 3, brand: 'Puma', title: 'Running Shoes', price: 2199, mrp: 3999, discount: 45, img: './static/Images/PumaShoes.jpeg', category: 'footwear' },
  { id: 4, brand: 'MANGO', title: 'Women Floral Dress', price: 1899, mrp: 3299, discount: 42, img: 'static/Images/FloralDress.jpeg', category: 'women' },
  { id: 5, brand: 'Levi’s', title: '511 Slim Fit Jeans', price: 2499, mrp: 4199, discount: 40, img: 'static/Images/Jeans.jpeg', category: 'men' },
  { id: 6, brand: 'HRX', title: 'Training Joggers', price: 999, mrp: 1999, discount: 50, img: 'static/Images/Jogger.jpeg', category: 'men' },
  { id: 7, brand: 'Anouk', title: 'Printed Kurta', price: 1299, mrp: 2299, discount: 43, img: 'static/Images/Kurta.jpeg', category: 'women' },
  { id: 8, brand: 'WROGN', title: 'Casual Sneakers', price: 1499, mrp: 2999, discount: 50, img: 'static/Images/Sneakers.jpeg', category: 'footwear' },
  { id: 9, brand: 'HERE&NOW', title: 'Printed Tee', price: 599, mrp: 1199, discount: 50, img: 'static/Images/PrintedTee.jpeg', category: 'men' },
  { id: 10, brand: 'DressBerry', title: 'Shoulder Bag', price: 1399, mrp: 2499, discount: 44, img: 'static/Images/Bag.jpeg', category: 'accessories' },
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
      <a class="product-link" href="?p=${p.id}" data-product-link data-id="${p.id}">
        <img src="${p.img}" alt="${p.brand} ${p.title}">
      </a>
      <button class="heart ${state.wishlist.has(p.id) ? 'active' : ''}" data-toggle-wishlist data-id="${p.id}">♥️</button>
      <div class="card-body">
        <div class="card-brand">${p.brand}</div>
        <a class="card-title product-link" href="?p=${p.id}" data-product-link data-id="${p.id}">${p.title}</a>
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
  localStorage.setItem('myntra_friends', JSON.stringify(state.friends));
  localStorage.setItem('myntra_wishlists_v2', JSON.stringify(state.wishlists));
  localStorage.setItem('myntra_wishlist_invites', JSON.stringify(state.incomingListInvites));
  localStorage.setItem('myntra_friendRequests', JSON.stringify(state.friendRequests));
  localStorage.setItem('myntra_incoming_requests', JSON.stringify(state.incomingRequests));
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
    const friends = JSON.parse(localStorage.getItem('myntra_friends') || '[]');
    state.friends = Array.isArray(friends) ? friends : [];
    // profiles feature removed
    const lists = JSON.parse(localStorage.getItem('myntra_wishlists_v2') || '[]');
    state.wishlists = Array.isArray(lists) ? lists : [];
    const wlInvites = JSON.parse(localStorage.getItem('myntra_wishlist_invites') || '[]');
    state.incomingListInvites = Array.isArray(wlInvites) ? wlInvites : [];
    // update badge: sum of items across lists
    try {
      const accessible = state.wishlists.filter(l => l.ownerId === state.user.id || (l.members||[]).includes(state.user.id));
      const totalItems = accessible.reduce((sum, l) => sum + ((l.items||[]).length), 0);
      state.wishlistCount = totalItems;
    } catch {}
    const friendRequests = JSON.parse(localStorage.getItem('myntra_friendRequests') || '[]');
    state.friendRequests = Array.isArray(friendRequests) ? friendRequests : [];
    const incomingRequests = JSON.parse(localStorage.getItem('myntra_incoming_requests') || '[]');
    state.incomingRequests = Array.isArray(incomingRequests) ? incomingRequests : [];
  } catch {}
}

function setupCartWishlist() {
  const wishlistCountEl = document.getElementById('wishlistCount');
  const cartCountEl = document.getElementById('cartCount');

  document.body.addEventListener('click', (e) => {
    const target = e.target;
    if (target && (target.matches('[data-product-link]') || target.closest('[data-product-link]'))) {
      const el = target.closest('[data-product-link]') || target;
      const id = Number(el.getAttribute('data-id'));
      e.preventDefault();
      const url = new URL(window.location.href);
      url.searchParams.set('p', String(id));
      window.history.pushState({}, '', url.toString());
      openQuickView(id);
      return;
    }
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
      const url = new URL(window.location.href);
      url.searchParams.delete('p');
      window.history.pushState({}, '', url.toString());
    }
  });
}

// -------- Profile / User --------
function ensureUserProfile() {
  if (state.user && state.user.id) return;
  let name = '';
  let email = '';
  try {
    name = (localStorage.getItem('myntra_display_name') || '').trim();
    email = (localStorage.getItem('myntra_email') || '').trim();
  } catch {}
  if (!name) { name = prompt('Enter your name') || ''; }
  if (!email) { email = prompt('Enter your email') || ''; }
  name = (name || 'Guest').trim().slice(0, 40);
  email = email.trim().toLowerCase();
  const id = 'u-' + Math.random().toString(36).slice(2, 10);
  state.user = { id, name, email };
  try {
    localStorage.setItem('myntra_display_name', name);
    localStorage.setItem('myntra_email', email);
  } catch {}
  document.getElementById('profileLabel').textContent = name;
  saveState();
}

function setupProfileButton() {
  const btn = document.getElementById('profileButton');
  if (btn) {
    btn.addEventListener('click', () => {
      openFriendsModal();
    });
  }
}

function openFriendsModal() {
  const modal = document.getElementById('friendsModal');
  const body = document.getElementById('friendsModalBody');
  if (!modal || !body) return;
  const all = [...state.friends];
  body.innerHTML = `
    <div style="display:grid; gap:12px;">
      <div>
        <label>Your friends</label>
        <div class="friends-grid">
          ${all.map(f => `
            <div class="friend-row">
              <div><strong>${f.name}</strong><div style="font-size:12px;opacity:.7">${f.email}</div></div>
              <button class="btn-outline" data-remove-friend data-id="${f.id}">Remove</button>
            </div>
          `).join('') || '<em>No friends yet</em>'}
        </div>
      </div>
      <div>
        <label>Send a friend request</label>
        <form class="friend-form" id="friendForm">
          <div class="row">
            <label>Name</label>
            <input id="friendName" class="input" placeholder="Friend's name" required />
          </div>
          <div class="row">
            <label>Email</label>
            <input id="friendEmail" type="email" class="input" placeholder="friend@example.com" required />
          </div>
          <button class="btn-primary" type="submit">Send Request</button>
        </form>
      </div>
      ${state.incomingRequests && state.incomingRequests.length ? `<div>
        <label>Incoming requests</label>
        <div class="friends-grid">
          ${state.incomingRequests.map(r => `
            <div class="friend-row">
              <div><strong>${r.name}</strong><div style="font-size:12px;opacity:.7">${r.email}</div></div>
              <div style="display:flex; gap:4px;">
                <button class="btn-outline" data-accept-request data-id="${r.id}">Accept</button>
                <button class="btn-outline" data-reject-request data-id="${r.id}">Reject</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
      ${state.friendRequests && state.friendRequests.length ? `<div>
        <label>Sent requests</label>
        <div class="friends-grid">
          ${state.friendRequests.map(r => `<div class=\"friend-row\"><div>${r.name} <small style=\"opacity:.7\">${r.email}</small></div><div><small>${r.status || 'Sent - waiting for reply'}</small></div></div>`).join('')}
        </div>
      </div>` : ''}
    </div>
  `;
  modal.setAttribute('aria-hidden', 'false');

  body.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.matches('[data-remove-friend]')) {
      const id = t.getAttribute('data-id');
      state.friends = state.friends.filter(f => f.id !== id);
      saveState();
      openFriendsModal();
    }
    if (t && t.matches('[data-accept-request]')) {
      const id = t.getAttribute('data-id');
      const req = state.incomingRequests.find(r => r.id === id);
      if (req) {
        // Add to friends
        state.friends.push({ id: req.id, name: req.name, email: req.email });
        // Update request status
        req.status = 'accepted';
        // Update sender's outgoing request status
        const outgoingReq = state.friendRequests.find(r => r.email === req.email);
        if (outgoingReq) outgoingReq.status = 'accepted';
        // Remove from incoming
        state.incomingRequests = state.incomingRequests.filter(r => r.id !== id);
        // Broadcast acceptance so the original sender updates their outgoing request
        sendSync('friend:response', {
          status: 'accepted',
          fromEmail: req.email,           // original sender
          toEmail: state.user.email       // responder (me)
        });
        saveState();
        toast('Friend request accepted');
        openFriendsModal();
      }
    }
    if (t && t.matches('[data-reject-request]')) {
      const id = t.getAttribute('data-id');
      const req = state.incomingRequests.find(r => r.id === id);
      if (req) {
        // Update sender's outgoing request status
        const outgoingReq = state.friendRequests.find(r => r.email === req.email);
        if (outgoingReq) outgoingReq.status = 'rejected';
        // Remove from incoming
        state.incomingRequests = state.incomingRequests.filter(r => r.id !== id);
        // Broadcast rejection so the original sender updates their outgoing request
        sendSync('friend:response', {
          status: 'rejected',
          fromEmail: req.email,           // original sender
          toEmail: state.user.email       // responder (me)
        });
        saveState();
        toast('Friend request rejected');
        openFriendsModal();
      }
    }
  });

  const form = body.querySelector('#friendForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = body.querySelector('#friendName').value.trim();
      const email = body.querySelector('#friendEmail').value.trim();
      if (!name || !email) return;
      
      // Check if already friends
      if (state.friends.some(f => f.email === email)) {
        toast('Already friends with this person');
        return;
      }
      
      // Check if request already sent
      if (state.friendRequests.some(r => r.email === email)) {
        toast('Request already sent to this person');
        return;
      }
      
      // Create outgoing request
      const token = 'fr-' + Math.random().toString(36).slice(2, 10);
      const outgoingReq = { id: token, name, email, token, status: 'sent' };
      state.friendRequests.push(outgoingReq);
      
      // Broadcast to relay so only the intended recipient receives an incoming request
      sendSync('friend:request', {
        token,
        toEmail: email,
        toName: name,
        from: { id: state.user.id, name: state.user.name, email: state.user.email }
      });
      
      saveState();
      toast('Friend request sent!');
      form.reset();
      openFriendsModal();
    });
  }

  modal.addEventListener('click', (e) => { const t = e.target; if (t && t.hasAttribute('data-close-friends')) modal.setAttribute('aria-hidden','true'); });
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
  refreshWishlistBadge();
  // Broadcast updated list to all members (including owner) so items sync
  try {
    const recipientsEmails = computeWishlistRecipientsEmails(list);
    const recipientsIds = [list.ownerId, ...(list.members||[])];
    if (recipientsEmails.length || recipientsIds.length) {
      sendSync('wishlist:sync', { list, recipientsEmails, recipientsIds });
    }
  } catch {}
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
            <strong class="wishlist-name" data-open-list data-id="${l.id}">${l.name}</strong>
            <div class="wishlist-actions">
              <button class="btn-outline" data-share-list data-id="${l.id}">Share</button>
              <button class="btn-outline" data-delete-list data-id="${l.id}">Delete</button>
            </div>
          </div>
          <div class="wishlist-row">
            <small>Members: ${[l.ownerId, ...(l.members||[])].length}</small>
            <small>Items: ${(l.items||[]).length}</small>
          </div>
          <div class="wishlist-items" data-items-for="${l.id}" hidden></div>
        </div>
      `).join('')}
    </div>
    ${state.incomingListInvites && state.incomingListInvites.length ? `
      <div style="margin-top:16px;">
        <label>Shared wishlist invites</label>
        <div class="picker-list">
          ${state.incomingListInvites.map(inv => `
            <div class="picker-row">
              <div><strong>${inv.list.name}</strong> <small style="opacity:.7">from ${inv.from?.name || inv.from?.email || 'Unknown'}</small></div>
              <div style="display:flex; gap:6px;">
                <button class="btn-outline" data-accept-list-invite data-token="${inv.token}">Accept</button>
                <button class="btn-outline" data-reject-list-invite data-token="${inv.token}">Reject</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
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
    if (t && (t.matches('[data-open-list]') || t.closest('[data-open-list]'))) {
      const id = (t.getAttribute('data-id')) || t.closest('[data-open-list]').getAttribute('data-id');
      renderWishlistItems(id);
    }
    if (t && t.matches('[data-remove-item]')) {
      const listId = t.getAttribute('data-list');
      const pid = Number(t.getAttribute('data-pid'));
      const list = state.wishlists.find(l => l.id === listId);
      if (list) {
        list.items = (list.items||[]).filter(it => it.productId !== pid);
        upsertWishlist(list);
        renderWishlistItems(listId);
        refreshWishlistBadge();
        try {
          const recipientsEmails = computeWishlistRecipientsEmails(list);
          const recipientsIds = [list.ownerId, ...(list.members||[])];
          if (recipientsEmails.length || recipientsIds.length) {
            sendSync('wishlist:sync', { list, recipientsEmails, recipientsIds });
          }
        } catch {}
      }
    }
    if (t && t.matches('[data-accept-list-invite]')) {
      const token = t.getAttribute('data-token');
      const inv = state.incomingListInvites.find(i => i.token === token);
      if (!inv) return;
      // Add/merge list locally
      const l = Object.assign({}, inv.list);
      l.members = l.members || [];
      if (!l.members.includes(state.user.id) && state.user.id !== l.ownerId) {
        l.members.push(state.user.id);
      }
      upsertWishlist(l);
      // Remove invite
      state.incomingListInvites = state.incomingListInvites.filter(i => i.token !== token);
      saveState();
      // Notify inviter to add this member and sync the list to both sides
      sendSync('wishlist:accept', { listId: l.id, member: { id: state.user.id, name: state.user.name, email: state.user.email } });
      const recipientsEmails = computeWishlistRecipientsEmails(l);
      const recipientsIds = [l.ownerId, ...(l.members||[])];
      if (recipientsEmails.length || recipientsIds.length) sendSync('wishlist:sync', { list: l, recipientsEmails, recipientsIds });
      toast('Joined shared wishlist');
      openWishlistModal();
    }
    if (t && t.matches('[data-reject-list-invite]')) {
      const token = t.getAttribute('data-token');
      state.incomingListInvites = state.incomingListInvites.filter(i => i.token !== token);
      saveState();
      toast('Invite dismissed');
      openWishlistModal();
    }
  });
}

// Compute recipient emails for a wishlist sync broadcast
function computeWishlistRecipientsEmails(list) {
  const emails = new Set();
  // Include self if part of the list
  if (state.user && state.user.email) emails.add(state.user.email);
  // Owner email (if friend entry exists or if self is owner)
  if (list.ownerId === state.user.id) {
    if (state.user.email) emails.add(state.user.email);
  } else {
    const ownerFriend = state.friends.find(f => f.id === list.ownerId);
    if (ownerFriend && ownerFriend.email) emails.add(ownerFriend.email);
  }
  // Members' emails from friends list
  (list.members || []).forEach(mid => {
    if (mid === state.user.id) { emails.add(state.user.email); return; }
    const fr = state.friends.find(f => f.id === mid);
    if (fr && fr.email) emails.add(fr.email);
  });
  return Array.from(emails).filter(Boolean);
}

function refreshWishlistBadge() {
  const wishlistCountEl = document.getElementById('wishlistCount');
  const accessible = state.wishlists.filter(l => l.ownerId === state.user.id || (l.members||[]).includes(state.user.id));
  const totalItems = accessible.reduce((sum, l) => sum + ((l.items||[]).length), 0);
  state.wishlistCount = totalItems;
  if (wishlistCountEl) wishlistCountEl.textContent = String(totalItems);
}

function renderWishlistItems(listId) {
  const container = document.querySelector(`[data-items-for="${listId}"]`);
  if (!container) return;
  const list = state.wishlists.find(l => l.id === listId);
  const items = (list && list.items) || [];
  if (!items.length) {
    container.innerHTML = '<em>No items yet.</em>';
  } else {
    container.innerHTML = items.map(it => {
      const p = trendingProducts.find(x => x.id === it.productId);
      const img = p ? p.img : 'https://dummyimage.com/80x80/eee/aaa&text=%20';
      const title = p ? (p.brand + ' ' + p.title) : ('Product #' + it.productId);
      return `
        <div class="wishlist-product">
          <img src="${img}" alt="${title}">
          <div class="meta">
            <strong>${title}</strong>
            ${it.size ? `<small>Size: ${it.size}</small>` : ''}
            ${it.note ? `<small>Note: ${it.note}</small>` : ''}
          </div>
          <button class="btn-outline" data-remove-item data-list="${listId}" data-pid="${it.productId}">Remove</button>
        </div>
      `;
    }).join('');
  }
  container.hidden = false;
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
        <label>Add members from friends</label>
        <div class="picker-list">
          ${state.friends.map(c => `
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
      if (!l) { toast('List missing'); return; }
      if (!l.members) l.members = [];
      if (uid === l.ownerId || l.members.includes(uid)) { toast('Already a member'); return; }
      const friend = state.friends.find(f => f.id === uid);
      if (!friend) { toast('Friend not found'); return; }
      const token = 'wlinv-' + Math.random().toString(36).slice(2, 10);
      // Send invite via relay; do NOT mutate local list yet.
      sendSync('wishlist:invite', {
        token,
        toEmail: friend.email,
        toId: friend.id,
        toName: friend.name,
        list: { id: l.id, name: l.name, ownerId: l.ownerId, members: l.members || [], items: l.items || [] },
        from: { id: state.user.id, name: state.user.name, email: state.user.email }
      });
      toast('Invite sent to ' + friend.name);
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
  const acceptFriendToken = params.get('acceptFriend');
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
  if (acceptFriendToken) {
    const name = decodeURIComponent(params.get('n') || '');
    const email = decodeURIComponent(params.get('e') || '');
    // Accept friend (legacy URL format)
    const existing = state.friends.find(f => f.email === email);
    if (!existing && email) {
      state.friends.push({ id: 'f-' + Math.random().toString(36).slice(2,9), name: name || email, email });
      // clear pending
      state.friendRequests = (state.friendRequests||[]).filter(r => r.token !== acceptFriendToken);
      saveState();
      toast('Friend request accepted');
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

// ---- SSE Relay Helpers ----
function getRelayUrl(path) {
  // Same-origin server.js serves both app and relay; fallback to absolute localhost in case of file://
  try {
    const base = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'http://localhost:8787';
    return base + (path || '');
  } catch {
    return 'http://localhost:8787' + (path || '');
  }
}

async function sendSync(kind, payload) {
  try {
    await fetch(getRelayUrl('/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, user: { id: state.user.id, name: state.user.name, email: state.user.email }, payload })
    });
  } catch (e) {
    // Non-fatal in demo
    console.warn('sendSync failed', e);
  }
}

function connectRelay() {
  try {
    const es = new EventSource(getRelayUrl('/events?userId=' + encodeURIComponent(state.user.id)));
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (!msg || !msg.type) return;
        // Handle friend request events
        if (msg.type === 'friend:request') {
          const { token, toEmail, toName, from } = msg;
          if (!toEmail || !from) return;
          if (state.user.email && state.user.email.toLowerCase() === String(toEmail).toLowerCase()) {
            // Only the intended recipient stores an incoming request
            const incomingReq = {
              id: token || ('in-' + Math.random().toString(36).slice(2, 9)),
              name: from.name || from.email || 'Friend',
              email: from.email || (from.id + '@myntra.local'),
              fromUserId: from.id,
              status: 'pending'
            };
            // De-dupe by email
            if (!state.incomingRequests.some(r => r.email === incomingReq.email)) {
              state.incomingRequests.push(incomingReq);
              saveState();
              // If modal open, re-render
              const fm = document.getElementById('friendsModal');
              if (fm && fm.getAttribute('aria-hidden') === 'false') openFriendsModal();
              toast('New friend request from ' + incomingReq.name);
            }
          }
        }
        // Wishlist: delete
        if (msg.type === 'wishlist:delete') {
          const { listId, recipientsEmails, recipientsIds } = msg;
          if (listId) {
            const myEmail = (state.user.email || '').toLowerCase();
            const myId = state.user.id;
            const emailTargets = (recipientsEmails || []).map(e => String(e).toLowerCase());
            const idTargets = recipientsIds || [];
            const isTarget = (myEmail && emailTargets.includes(myEmail)) || (myId && idTargets.includes(myId));
            if (isTarget) {
              state.wishlists = state.wishlists.filter(w => w.id !== listId);
              saveState();
              const wm = document.getElementById('wishlistModal');
              if (wm && wm.getAttribute('aria-hidden') === 'false') openWishlistModal();
              refreshWishlistBadge();
              toast('A shared wishlist was deleted');
            }
          }
        }
        if (msg.type === 'friend:response') {
          const { status, fromEmail, toEmail } = msg; // fromEmail = sender's email; toEmail = responder's email
          // Only the original sender updates their outgoing request status
          if (state.user.email && state.user.email.toLowerCase() === String(fromEmail).toLowerCase()) {
            const req = state.friendRequests.find(r => r.email && r.email.toLowerCase() === String(toEmail).toLowerCase());
            if (req) {
              req.status = status;
              if (status === 'accepted') {
                // Add friend upon acceptance
                const name = req.name || req.email;
                if (!state.friends.some(f => f.email === req.email)) {
                  state.friends.push({ id: 'f-' + Math.random().toString(36).slice(2,9), name, email: req.email });
                }
              }
              saveState();
              const fm = document.getElementById('friendsModal');
              if (fm && fm.getAttribute('aria-hidden') === 'false') openFriendsModal();
              toast('Your request was ' + status);
            }
          }
        }

        // Wishlist: incoming invite for the intended recipient
        if (msg.type === 'wishlist:invite') {
          const { token, toEmail, toId, list, from } = msg;
          if ((!toEmail && !toId) || !list || !list.id) {
            // malformed
          } else {
            const emailMatch = state.user.email && toEmail && (state.user.email.toLowerCase() === String(toEmail).toLowerCase());
            const idMatch = state.user.id && toId && (state.user.id === toId);
            if (emailMatch || idMatch) {
              if (!state.incomingListInvites.some(inv => inv.token === token)) {
                state.incomingListInvites.push({ token, list, from });
                saveState();
                const wm = document.getElementById('wishlistModal');
                if (wm && wm.getAttribute('aria-hidden') === 'false') openWishlistModal();
                toast(`Wishlist invite: ${list.name}`);
              }
            }
          }
        }

        // Wishlist: inviter updates members when recipient accepts
        if (msg.type === 'wishlist:accept') {
          const { listId, member } = msg; // member: {id,name,email}
          if (listId && member) {
            const l = state.wishlists.find(x => x.id === listId);
            if (l && l.ownerId === state.user.id) {
              l.members = l.members || [];
              if (!l.members.includes(member.id) && member.id !== l.ownerId) {
                l.members.push(member.id);
                upsertWishlist(l);
                toast(member.name + ' joined "' + l.name + '"');
              }
            }
          }
        }

        // Wishlist: full list snapshot sync to specific recipients
        if (msg.type === 'wishlist:sync') {
          const { list, recipientsEmails, recipientsIds } = msg;
          if (list && list.id) {
            const myEmail = (state.user.email || '').toLowerCase();
            const myId = state.user.id;
            const emailTargets = (recipientsEmails || []).map(e => String(e).toLowerCase());
            const idTargets = recipientsIds || [];
            const isExplicitEmail = myEmail && emailTargets.includes(myEmail);
            const isExplicitId = myId && idTargets.includes(myId);
            const isMemberInSnapshot = myId && (list.ownerId === myId || (list.members||[]).includes(myId));
            if (isExplicitEmail || isExplicitId || isMemberInSnapshot) {
              const idx = state.wishlists.findIndex(w => w.id === list.id);
              if (idx >= 0) state.wishlists[idx] = list; else state.wishlists.push(list);
              saveState();
              const wm = document.getElementById('wishlistModal');
              if (wm && wm.getAttribute('aria-hidden') === 'false') openWishlistModal();
              refreshWishlistBadge();
            }
          }
        }
      } catch (e) {
        console.warn('Failed to handle relay message', e);
      }
    };
  } catch (e) {
    console.warn('connectRelay failed', e);
  }
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

// -------- Myna Chatbot --------
function setupMynaChat() {
  const toggle = document.getElementById('mynaToggle');
  const panel = document.getElementById('mynaPanel');
  const close = document.getElementById('mynaClose');
  const form = document.getElementById('mynaForm');
  const input = document.getElementById('mynaInput');
  const feed = document.getElementById('mynaMessages');
  if (!toggle || !panel || !close || !form || !input || !feed) return;

  // Ensure initial state: button visible, panel hidden
  try { panel.hidden = true; toggle.hidden = false; } catch {}

  const addMsg = (txt, who = 'bot') => {
    const el = document.createElement('div');
    el.className = 'myna-msg' + (who === 'me' ? ' me' : '');
    el.textContent = txt;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  };

  const addActionLine = (obj) => {
    const el = document.createElement('div');
    el.className = 'myna-action';
    el.textContent = JSON.stringify({ __action__: obj });
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  };

  const categories = ['men','women','footwear','accessories'];
  const normalize = (s) => String(s||'').trim().toLowerCase();
  const canon = (s) => normalize(s).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const parsePrice = (s) => {
    const m = String(s).match(/(under|below|<=|less than)\s*(\d{2,6})/i) || String(s).match(/\b(\d{2,6})\b/);
    return m ? Number(m[2] || m[1]) : null;
  };

  function mynaParse(text) {
    const t = normalize(text);
    const isGreeting = /\b(hi|hello|hey|namaste|hola)\b/.test(t);
    const hasCommandVerb = /\b(add|remove|delete|find|show|search|recommend|suggest|watch|style|outfit|look|moodboard|board)\b/.test(t);
    const tokenCount = t.split(/\s+/).filter(Boolean).length;
    // Only treat as greeting if short and without commands
    if (isGreeting && !hasCommandVerb && tokenCount <= 3) {
      return { type: 'chat.reply', payload: { text: 'Hi! I can search, manage wishlists, suggest styles, set watches, and build moodboards.' } };
    }
    // Search intent
    if (/\b(find|show|search|recommend|suggest)\b/.test(t)) {
      const maxPrice = parsePrice(t);
      let category = categories.find(c => t.includes(c)) || null;
      // crude color extraction
      const colors = ['red','blue','black','white','green','pink','yellow','beige','brown'];
      const color = colors.find(c => t.includes(c)) || null;
      // Filter products
      let results = trendingProducts.slice();
      if (category) results = results.filter(p => p.category === category);
      if (maxPrice) results = results.filter(p => p.price <= maxPrice);
      if (color) results = results.filter(p => (p.title + ' ' + p.brand).toLowerCase().includes(color));
      results = results.slice(0, 6).map(p => ({ id: p.id, title: p.title, brand: p.brand, price: p.price, img: p.img, discount: p.discount, category: p.category }));
      return { type: 'search.results', payload: { query: text, results } };
    }

    // Wishlist create (multiple phrasings)
    let m = t.match(/\bcreate\b.*\b(?:wishlist|list)\b.*\bnamed\b\s+([\w\s-]{2,40})/)
         || t.match(/\b(create|new)\b\s+(?:a\s+)?(?:wishlist|list)\s+([\w\s-]{2,40})/)
         || t.match(/\bnew\b\s+(?:wishlist|list)\b\s+([\w\s-]{2,40})/);
    if (m) {
      const name = (m[2] || m[1]).trim();
      return { type: 'wishlist.create', payload: { name } };
    }

    // Wishlist delete (broader phrasings)
    m = t.match(/\b(delete|remove)\b\s+(?:the\s*)?(?:wishlist|list)\s+([\w\s-]{1,40})/)
      || t.match(/\b(delete|remove)\b\s+([\w\s-]{1,40})\s+(?:wishlist|list)\b/)
      || t.match(/\b(delete|remove)\b\s+(?:the\s*)?(?:wishlist|list)\b\s*(?:named|called)?\s+([\w\s-]{1,40})/);
    if (m) {
      const name = (m[2] || m[1]).replace(/^(delete|remove)\s+/,'').trim();
      return { type: 'wishlist.delete', payload: { name } };
    }

    // Wishlist list
    if (/\b(list|show)\b.*\b(wishlists|lists)\b/.test(t)) {
      return { type: 'wishlist.list', payload: {} };
    }

    // Wishlist add/remove by NAME first (allow missing 'wishlist')
    m = t.match(/\badd\b\s+(.+?)\s+(?:to|into|in)\s+(?:wishlist|list\s+)?([\w\s-]{1,40})/);
    if (m) {
      const prodQ = m[1].trim();
      const wishlistName = m[2].trim();
      // try fuzzy match against catalog
      const pq = canon(prodQ);
      const found = trendingProducts.find(p => {
        const t1 = canon(p.brand + ' ' + p.title);
        const t2 = canon(p.title + ' ' + p.brand);
        return t1.includes(pq) || t2.includes(pq) || pq.includes(t1) || pq.includes(t2);
      });
      if (!found) {
        return { type: 'chat.reply', payload: { text: 'Which product did you mean? Please specify an item id (e.g., 3) or exact name.' } };
      }
      return { type: 'wishlist.add', payload: { productId: found.id, wishlistName } };
    }
    m = t.match(/\bremove\b\s+(.+?)\s+from\s+(?:wishlist|list\s+)?([\w\s-]{1,40})/);
    if (m) {
      const prodQ = m[1].trim();
      const wishlistName = m[2].trim();
      const pq = canon(prodQ);
      const found = trendingProducts.find(p => {
        const t1 = canon(p.brand + ' ' + p.title);
        const t2 = canon(p.title + ' ' + p.brand);
        return t1.includes(pq) || t2.includes(pq) || pq.includes(t1) || pq.includes(t2);
      })
        || { id: Number.isFinite(Number(prodQ)) ? Number(prodQ) : null };
      if (!found || !found.id) {
        return { type: 'chat.reply', payload: { text: 'Please tell me which item to remove — a product name or id will work.' } };
      }
      return { type: 'wishlist.remove', payload: { productId: found.id, wishlistName } };
    }

    // Wishlist add/remove by ID (fallback, allow missing 'wishlist')
    m = t.match(/\badd\b\s+(?:item\s*)?(\d+)\s+(?:to|into|in)\s+(?:wishlist|list\s+)?([\w\s-]{1,40})/);
    if (m) {
      const productId = Number(m[1]);
      const wishlistName = m[2].trim();
      return { type: 'wishlist.add', payload: { productId, wishlistName } };
    }
    m = t.match(/\bremove\b\s+(?:item\s*)?(\d+)\s+from\s+(?:wishlist|list\s+)?([\w\s-]{1,40})/);
    if (m) {
      const productId = Number(m[1]);
      const wishlistName = m[2].trim();
      return { type: 'wishlist.remove', payload: { productId, wishlistName } };
    }

    // Style suggestions
    if (/\b(style|outfit|look|mix|match|pair)\b/.test(t)) {
      const combos = [
        { top: 'Oversized Tee', bottom: '511 Slim Fit Jeans', footwear: 'Casual Sneakers' },
        { dress: 'Women Floral Dress', accessory: 'Shoulder Bag' }
      ];
      return { type: 'style.suggestions', payload: { query: text, combos } };
    }

    // Watch/alert
    m = t.match(/\bwatch\b\s*(\d+)/);
    if (m) {
      const productId = Number(m[1]);
      const threshold = parsePrice(t);
      return { type: 'watch.set', payload: { productId, threshold: threshold || null } };
    }

    // Moodboard
    m = t.match(/\b(moodboard|board)\b\s*(?:for|of)?\s*([\w\s-]{2,40})/);
    if (m) {
      const theme = (m[2] || 'style').trim();
      const items = trendingProducts.slice(0, 4).map(p => ({ id: p.id, title: p.title, img: p.img }));
      return { type: 'moodboard.create', payload: { theme, items } };
    }

    return { type: 'chat.reply', payload: { text: "I'm here to help with search, wishlists, styles, watches, and moodboards." } };
  }

  function ensureListByName(name) {
    const n = name.trim();
    const lower = n.toLowerCase();
    // Prefer an owned list with this name
    let list = state.wishlists.find(l => l.name.toLowerCase() === lower && l.ownerId === state.user.id);
    if (list) return list;
    // Otherwise, use any accessible member list with this name
    list = state.wishlists.find(l => l.name.toLowerCase() === lower && (l.ownerId === state.user.id || (l.members||[]).includes(state.user.id)));
    if (list) return list;
    // Otherwise, create a new owned list
    list = { id: generateId('wl'), name: n, ownerId: state.user.id, members: [], items: [] };
    upsertWishlist(list);
    return list;
  }

  function mynaPerform(action) {
    switch (action.type) {
      case 'search.results': {
        // no state mutation
        return `Found ${action.payload.results.length} items for “${action.payload.query}”.`;
      }
      case 'wishlist.create': {
        const list = ensureListByName(action.payload.name);
        // Refresh modal if open
        const wm = document.getElementById('wishlistModal');
        if (wm && wm.getAttribute('aria-hidden') === 'false') openWishlistModal();
        return `Created wishlist “${list.name}”.`;
      }
      case 'wishlist.delete': {
        const name = action.payload.name.trim();
        const list = state.wishlists.find(l => l.name.toLowerCase() === name.toLowerCase());
        if (!list) return `No wishlist named “${name}” found.`;
        if (list.ownerId !== state.user.id) return `Only the owner can delete “${list.name}”.`;
        // capture recipients before deletion
        const recipientsEmails = computeWishlistRecipientsEmails(list);
        const recipientsIds = [list.ownerId, ...(list.members||[])];
        removeWishlist(list.id);
        refreshWishlistBadge();
        // Refresh modal if open
        {
          const wm = document.getElementById('wishlistModal');
          if (wm && wm.getAttribute('aria-hidden') === 'false') openWishlistModal();
        }
        try {
          if (recipientsEmails.length || recipientsIds.length) {
            sendSync('wishlist:delete', { listId: list.id, recipientsEmails, recipientsIds });
          }
        } catch {}
        return `Deleted wishlist “${list.name}”.`;
      }
      case 'wishlist.list': {
        const names = getUserLists().map(l => l.name);
        return names.length ? `Your wishlists: ${names.join(', ')}.` : 'No wishlists yet.';
      }
      case 'wishlist.add': {
        const list = ensureListByName(action.payload.wishlistName);
        const res = addItemToList(list.id, action.payload.productId, '', '');
        return res.ok ? `Added item to “${list.name}”.` : `Could not add (maybe duplicate).`;
      }
      case 'wishlist.remove': {
        const list = ensureListByName(action.payload.wishlistName);
        list.items = (list.items||[]).filter(it => it.productId !== action.payload.productId);
        upsertWishlist(list);
        // broadcast sync
        try {
          const recipientsEmails = computeWishlistRecipientsEmails(list);
          const recipientsIds = [list.ownerId, ...(list.members||[])];
          if (recipientsEmails.length || recipientsIds.length) sendSync('wishlist:sync', { list, recipientsEmails, recipientsIds });
        } catch {}
        return `Removed item from “${list.name}”.`;
      }
      case 'style.suggestions': {
        return 'Here are two outfit ideas. Want me to save one to a moodboard?';
      }
      case 'watch.set': {
        // Just acknowledge in demo
        return action.payload.threshold ? `I’ll watch item ${action.payload.productId} and alert under ₹${action.payload.threshold}.` : `I’ll watch item ${action.payload.productId} and alert on changes.`;
      }
      case 'moodboard.create': {
        return `Created a “${action.payload.theme}” moodboard with ${action.payload.items.length} items.`;
      }
      default:
        return 'Okay.';
    }
  }

  // Open panel: hide button
  toggle.addEventListener('click', () => {
    panel.hidden = false;
    toggle.hidden = true;
    try { input.focus(); } catch {}
  });
  // Close panel: show button
  close.addEventListener('click', () => {
    panel.hidden = true;
    toggle.hidden = false;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, 'me');
    input.value = '';
    const action = mynaParse(text);
    if (action.type === 'chat.reply') {
      addMsg(action.payload.text);
      return;
    }
    // Perform action silently (do not render JSON action line)
    const confirmation = mynaPerform(action);
    addMsg(confirmation);
  });
}

// -------- Rooms / Group call using Jitsi --------
function randomRoomId() {
  return 'weforshe-' + Math.random().toString(36).slice(2, 8);
}

function openRoomModal(prefill) {
  const modal = document.getElementById('roomModal');
  const body = document.getElementById('roomModalBody');
  if (!modal || !body) return;
  const contacts = state.friends.length ? state.friends.map(f => f.name) : ['Friend 1','Friend 2'];
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
  const productId = Number(params.get('p'));
  if (roomId) {
    startRoom(roomId, 'Shopping Room');
  }
  if (productId) {
    openQuickView(productId);
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
  connectRelay();
  setupMynaChat();
});


