const state = {
  wishlistCount: 0,
  cartCount: 0,
  currentSlide: 0,
  autoAdvanceMs: 5000,
  theme: 'light',
  wishlist: new Set(), // legacy single wishlist ids
  cart: [], // legacy
  cartV2: [], // [{ id: cid, productId, size:'', qty:1, forUser:{id,name,email} }]
  filters: { category: 'all', minDiscount: 0, sortBy: 'popular' },
  room: { id: '', name: '', contacts: [], api: null },
  // Room-scoped shared cart state
  roomCart: {
    roomId: '',
    items: [], // { productId, size:'', qty:1, addedBy:'userId', addedByName:'Name' }
    split: { method: 'equal', custom: {} },
    participants: {}
  },
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
  friendRequestsLegacy: [], // {id, name, email, token} (legacy; not used)
};

// Global friendly label resolver for any user id
function resolveUserLabel(uid) {
  if (!uid) return 'Member';
  // User-defined label (manual override)
  if (state.userLabels && state.userLabels[uid]) return state.userLabels[uid];
  if (state.user && state.user.id === uid) return state.user.name || state.user.email || 'Me';
  const fr = (state.friends||[]).find(f => f.id === uid);
  if (fr) return fr.name || fr.email || ('Member ' + String(uid).slice(-4));
  const contact = (state.contacts||[]).find(c => c.id === uid);
  if (contact) return contact.name || contact.email || ('Member ' + String(uid).slice(-4));
  // Scan all wishlists for any metadata about this uid
  for (const wl of (state.wishlists||[])) {
    if (wl && wl.ownerMeta && wl.ownerMeta.id === uid) return wl.ownerMeta.name || wl.ownerMeta.email || ('Member ' + String(uid).slice(-4));
    const mm = (wl && wl.membersMeta || []).find(m => m.id === uid);
    if (mm) return mm.name || mm.email || ('Member ' + String(uid).slice(-4));
  }
  // Fallback: avoid showing raw ids like u_abcd...; show generic member label
  return /^u_[a-z0-9]+$/i.test(String(uid)) ? ('Member ' + String(uid).slice(-4)) : String(uid);
}

// Global helper to derive a stable user id from email (matches auth gate logic)
function makeUserId(email) {
  try {
    const base = btoa(unescape(encodeURIComponent(String(email).toLowerCase()))).replace(/[^a-z0-9]/gi,'').slice(0,12);
    return 'u_' + (base || Math.random().toString(36).slice(2, 10));
  } catch {
    return 'u_' + Math.random().toString(36).slice(2, 10);
  }
}

// ----- Order math: subtotal, tax, shipping, per-person split -----
function computeOrderCharges(lines) {
  const TAX_RATE = 0.18; // 18% GST for demo
  const subtotal = lines.reduce((s, l) => s + (l.product?.price || 0) * (l.qty || 1), 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const shipping = subtotal >= 1500 ? 0 : (subtotal > 0 ? 99 : 0);
  const total = subtotal + tax + shipping;
  // Per person split based on forUser
  const perItemSub = {};
  const people = {};
  lines.forEach(l => {
    const uid = (l.forUser && l.forUser.id) || state.user.id;
    const amt = (l.product?.price || 0) * (l.qty || 1);
    perItemSub[uid] = (perItemSub[uid] || 0) + amt;
    if (!people[uid]) people[uid] = l.forUser || { id: state.user.id, name: state.user.name, email: state.user.email };
  });
  const totalItemsSub = Object.values(perItemSub).reduce((a,b)=>a+b,0) || 0;
  const perPerson = {};
  if (totalItemsSub > 0) {
    Object.entries(perItemSub).forEach(([uid, amt]) => {
      const share = amt / totalItemsSub;
      perPerson[uid] = Math.round(amt + tax * share + shipping * share);
    });
  }
  return { subtotal, tax, shipping, total, perPerson, people };
}

// ----- Add to bag prompt (size + optional assignee) -----
function openAddToBagPrompt(productId, options = {}) {
  const modal = document.getElementById('pickerModal');
  const body = document.getElementById('pickerModalBody');
  if (!modal || !body) return;
  const p = trendingProducts.find(x => x.id === productId);
  const askAssignee = !!options.askAssignee;
  const isFootwear = String(p?.category || '').toLowerCase() === 'footwear';
  const sizeOpts = isFootwear ? ['UK 3','UK 4','UK 5','UK 6','UK 7','UK 8','UK 9','UK 10','UK 11','UK 12'] : ['XS','S','M','L','XL'];
  // Helper to get a friendly label for a user id
  function displayFor(uid, wl) {
    if (!uid) return 'Member';
    if (uid === state.user.id) return state.user.name || state.user.email || 'Me';
    if (wl && wl.ownerMeta && wl.ownerMeta.id === uid) return wl.ownerMeta.name || wl.ownerMeta.email || uid;
    if (wl && Array.isArray(wl.membersMeta)) {
      const mm = wl.membersMeta.find(m => m.id === uid);
      if (mm) return mm.name || mm.email || ('Member ' + String(uid).slice(-4));
    }
    const fr = state.friends.find(f => f.id === uid);
    if (fr) return fr.name || fr.email || ('Member ' + String(uid).slice(-4));
    // Fallback to contacts directory (seeded sample contacts)
    const contact = (state.contacts || []).find(c => c.id === uid);
    if (contact) return contact.name || contact.email || ('Member ' + String(uid).slice(-4));
    // Try incoming shared invites to extract names
    const inv = (state.incomingListInvites||[]).find(i => i && i.list && i.list.id === (wl && wl.id) && (i.from?.id === uid || i.toId === uid));
    if (inv) return (inv.from && inv.from.id === uid && (inv.from.name || inv.from.email)) || inv.toName || ('Member ' + String(uid).slice(-4));
    // Try friend requests lists
    const outReq = (state.friendRequests||[]).find(r => r.id === uid);
    if (outReq) return outReq.name || outReq.email || ('Member ' + String(uid).slice(-4));
    const inReq = (state.incomingRequests||[]).find(r => r.fromUserId === uid || r.id === uid);
    if (inReq) return inReq.name || inReq.email || ('Member ' + String(uid).slice(-4));
    // Last fallback: global resolver
    return resolveUserLabel(uid);
  }
  let assignees = [{ id: state.user.id, name: state.user.name || 'Me', email: state.user.email }];
  if (options.fromListId) {
    const wl = state.wishlists.find(l => l.id === options.fromListId);
    if (wl) {
      const map = new Map();
      // 1) Owner first (with meta if present)
      if (wl.ownerId) {
        const label = (wl.ownerMeta && (wl.ownerMeta.name || wl.ownerMeta.email)) || displayFor(wl.ownerId, wl);
        const pretty = /^u_[a-z0-9]+$/i.test(String(label)) ? ('Member ' + String(wl.ownerId).slice(-4)) : label;
        const fr = state.friends.find(f => f.id === wl.ownerId);
        map.set(wl.ownerId, {
          id: wl.ownerId,
          name: (fr && fr.name) || pretty,
          email: (fr && fr.email) || (wl.ownerMeta && wl.ownerMeta.email) || '',
          label: pretty
        });
      }
      // 2) Members from membersMeta if available for names
      (Array.isArray(wl.membersMeta) ? wl.membersMeta : []).forEach(m => {
        if (!m || !m.id) return;
        const pretty = /^u_[a-z0-9]+$/i.test(String(m.name||m.email||'')) ? ('Member ' + String(m.id).slice(-4)) : (m.name || m.email || displayFor(m.id, wl));
        map.set(m.id, { id: m.id, name: m.name || pretty, email: m.email || '', label: pretty });
      });
      // 3) Any remaining member ids without meta
      (Array.isArray(wl.members) ? wl.members : []).forEach(uid => {
        if (!uid || map.has(uid)) return;
        const label = displayFor(uid, wl);
        const pretty = /^u_[a-z0-9]+$/i.test(String(label)) ? ('Member ' + String(uid).slice(-4)) : label;
        const fr = state.friends.find(f => f.id === uid);
        map.set(uid, { id: uid, name: (fr && fr.name) || pretty, email: (fr && fr.email) || '', label: pretty });
      });
      // 4) Ensure self present with nicest label
      map.set(state.user.id, { id: state.user.id, name: state.user.name || resolveUserLabel(state.user.id), email: state.user.email, label: state.user.name || resolveUserLabel(state.user.id) });
      assignees = Array.from(map.values()).sort((a,b) => (a.id === state.user.id ? -1 : b.id === state.user.id ? 1 : String(a.label||a.name||'').localeCompare(String(b.label||b.name||''))));
    }
  }
  body.innerHTML = `
    <div style="display:grid; gap:10px; width:100%">
      <div style="display:flex; gap:12px; align-items:center;">
        <img src="${p?.img || ''}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">
        <div style="line-height:1.2">
          <div style="font-weight:700">${p?.brand || ''}</div>
          <div style="font-size:12px;opacity:.75">${p?.title || ''}</div>
        </div>
      </div>
      <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px; min-width:180px;">
          <label>Size${isFootwear ? ' (UK)' : ''}</label>
          <select id="bagSize" class="input" style="width:120px;">
            <option value="">Select</option>
            ${sizeOpts.map(opt => `<option value="${opt.replace('UK ','')}">${opt}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:8px; min-width:140px;">
          <label>Qty</label>
          <input id="bagQty" type="number" class="input" style="width:72px;" value="1" min="1" />
        </div>
        ${askAssignee ? `
        <div style="display:flex; align-items:center; gap:8px; min-width:220px; margin-left:auto;">
          <label>For</label>
          <select id="bagAssignee" class="input" style="width:200px;">
            ${assignees.map(a => `<option value="${a.id}">${a.label || a.name || a.email || displayFor(a.id)}</option>`).join('')}
          </select>
        </div>
        ` : ''}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:4px;">
        <button class="btn-outline" data-close-picker>Cancel</button>
        <button class="btn-primary" id="confirmAddToBag">Add to Bag</button>
      </div>
    </div>
  `;
  modal.setAttribute('aria-hidden','false');
  setTimeout(() => {
    const btn = body.querySelector('#confirmAddToBag');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const size = String(body.querySelector('#bagSize')?.value || '').trim();
      const qty = Math.max(1, Number(body.querySelector('#bagQty')?.value || 1));
      let forUser = { id: state.user.id, name: state.user.name, email: state.user.email };
      if (askAssignee) {
        const sel = body.querySelector('#bagAssignee');
        const uid = sel ? sel.value : state.user.id;
        if (uid === state.user.id) {
          forUser = { id: state.user.id, name: state.user.name, email: state.user.email };
        } else {
          const fr = state.friends.find(f => f.id === uid);
          if (fr) forUser = { id: fr.id, name: fr.name, email: fr.email };
          else forUser = { id: uid, name: resolveUserLabel(uid), email: '' };
        }
      }
      // Add to cartV2
      const cid = 'c-' + Math.random().toString(36).slice(2, 9);
      state.cartV2 = state.cartV2 || [];
      state.cartV2.push({ id: cid, productId, size, qty, forUser });
      state.cartCount = state.cartV2.reduce((s,l)=>s+(l.qty||1),0);
      try { document.getElementById('cartCount').textContent = String(state.cartCount); } catch {}
      saveState();
      toast('Added to bag');
      // close
      const pm = document.getElementById('pickerModal');
      if (pm) pm.setAttribute('aria-hidden','true');
    });
  }, 0);
}


// -------- Cart / Checkout UI --------
function cartLines() {
  // Prefer cartV2 if present
  if (Array.isArray(state.cartV2) && state.cartV2.length) {
    return state.cartV2.map(l => ({
      id: l.productId,
      product: trendingProducts.find(x => x.id === l.productId),
      qty: l.qty || 1,
      size: l.size || '',
      forUser: l.forUser || null,
      _cid: l.id || `${l.productId}|${l.size||''}|${l.forUser?.id||''}`
    }));
  }
  // Fallback legacy
  const counts = new Map();
  for (const id of state.cart) counts.set(id, (counts.get(id) || 0) + 1);
  const lines = [];
  counts.forEach((qty, id) => {
    const p = trendingProducts.find(x => x.id === id);
    if (p) lines.push({ id, product: p, qty });
  });
  return lines;
}

// -------- Room Cart helpers --------
function ensureRoomCartForCurrentRoom() {
  if (!state.room || !state.room.id) return null;
  if (!state.roomCart || state.roomCart.roomId !== state.room.id) {
    state.roomCart = { roomId: state.room.id, items: [], split: { method: 'equal', custom: {} }, participants: {} };
  }
  // Ensure self as participant
  const uid = state.user.id;
  if (uid) {
    state.roomCart.participants = state.roomCart.participants || {};
    state.roomCart.participants[uid] = { id: uid, name: state.user.name, email: state.user.email };
  }
  return state.roomCart;
}

function roomCartBroadcast(payload) {
  const rc = ensureRoomCartForCurrentRoom();
  if (!rc) return;
  sendSync('roomcart:event', Object.assign({ roomId: rc.roomId }, payload));
  saveState();
}

function addToRoomCart(productId, size = '', qty = 1) {
  const rc = ensureRoomCartForCurrentRoom();
  if (!rc) { toast('Join a Room to use Room Cart'); return; }
  rc.items = rc.items || [];
  const addedBy = state.user.id;
  const keyMatch = (it) => it.productId === productId && it.addedBy === addedBy && String(it.size||'') === String(size||'');
  const existing = rc.items.find(keyMatch);
  if (existing) {
    existing.qty = Math.max(1, (existing.qty||1) + (qty||1));
  } else {
    rc.items.push({ productId, size: size||'', qty: Math.max(1, qty||1), addedBy, addedByName: state.user.name || 'Me' });
  }
  roomCartBroadcast({ type: 'roomcart:add', item: { productId, size: size||'', qty: Math.max(1, qty||1), addedBy, addedByName: state.user.name || 'Me' } });
}

function roomCartUpdateItem(productId, addedBy, changes) {
  const rc = ensureRoomCartForCurrentRoom();
  if (!rc) return;
  rc.items = rc.items || [];
  const it = rc.items.find(x => x.productId === productId && x.addedBy === addedBy);
  if (!it) return;
  if ('size' in changes) {
    it.size = changes.size;
  }
  if ('qty' in changes) {
    const delta = Number(changes.qty||0);
    it.qty = Math.max(1, (it.qty||1) + delta);
  }
  if (changes.absolute) {
    // already applied
  }
  roomCartBroadcast({ type: 'roomcart:update', productId, addedBy, changes: { size: it.size, qty: it.qty } });
}

function roomCartRemoveItem(productId, addedBy) {
  const rc = ensureRoomCartForCurrentRoom();
  if (!rc) return;
  rc.items = (rc.items||[]).filter(x => !(x.productId === productId && x.addedBy === addedBy));
  roomCartBroadcast({ type: 'roomcart:remove', productId, addedBy });
}

function roomCartSendSnapshot() {
  const rc = ensureRoomCartForCurrentRoom();
  if (!rc) return;
  roomCartBroadcast({ type: 'roomcart:snapshot', snapshot: rc });
}

function formatINR(n) { try { return new Intl.NumberFormat('en-IN').format(n); } catch { return String(n); } }

function openCartModal(step = 'cart') {
  const modal = document.getElementById('cartModal');
  const body = document.getElementById('cartModalBody');
  if (!modal || !body) return;

  const lines = cartLines();
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const mrpTotal = lines.reduce((s, l) => s + l.product.mrp * l.qty, 0);
  const savings = Math.max(0, mrpTotal - subtotal);

  const renderCartView = () => {
    const container = document.getElementById('cartTabBody') || body;
    container.innerHTML = `
      <div style="display:grid; gap:12px; width:100%">
        <h3>Your Bag</h3>
        ${lines.length ? `
          <div class="picker-list">
            ${lines.map(l => `
              <div class="picker-row" data-cart-line="${l._cid || l.id}">
                <div style="display:flex; gap:10px; align-items:center;">
                  <img src="${l.product.img}" alt="${l.product.brand} ${l.product.title}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">
                  <div>
                    <strong>${l.product.brand}</strong>
                    <div style="font-size:12px;opacity:.8">${l.product.title}</div>
                    ${l.size ? `<div style="font-size:12px;opacity:.8">Size: ${l.size}</div>` : ''}
                    ${l.forUser ? (() => { const u=l.forUser||{}; const nm=String(u.name||''); const isUid=/^u_[a-z0-9]+$/i.test(nm); const label = (!nm || isUid) ? (u.email || resolveUserLabel(u.id)) : nm; return `<div style="font-size:12px;opacity:.8">For: ${label}</div>`; })() : ''}
                    <div class="price-row" style="margin-top:4px;">
                      <span class="price">₹${formatINR(l.product.price)}</span>
                      <span class="mrp">₹${formatINR(l.product.mrp)}</span>
                      <span class="discount">${l.product.discount}% OFF</span>
                    </div>
                  </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                  <button class="btn-outline" data-cart-dec ${l._cid?`data-cid="${l._cid}"`:''} data-id="${l.id}">-</button>
                  <span aria-label="Quantity">${l.qty}</span>
                  <button class="btn-outline" data-cart-inc ${l._cid?`data-cid="${l._cid}"`:''} data-id="${l.id}">+</button>
                  <button class="btn-outline" data-cart-remove ${l._cid?`data-cid="${l._cid}"`:''} data-id="${l.id}">Remove</button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="wishlist-row" style="justify-content:space-between;">
            <div>
              <div><strong>Subtotal:</strong> ₹${formatINR(subtotal)}</div>
              ${savings ? `<small style="opacity:.8">You save ₹${formatINR(savings)}</small>` : ''}
            </div>
            <button class="btn-primary" data-checkout>Proceed to Checkout</button>
          </div>
        ` : `<em>Your bag is empty.</em>`}
      </div>
    `;
  };

  const renderCheckoutView = () => {
    const order = computeOrderCharges(lines);
    const container = document.getElementById('cartTabBody') || body;
    container.innerHTML = `
      <div style="display:grid; gap:12px; width:100%">
        <h3>Checkout</h3>
        <div class="wishlist-row" style="justify-content:space-between;">
          <div>
            <div><strong>Items:</strong> ${lines.reduce((s,l)=>s+(l.qty||1),0)}</div>
            <div><strong>Subtotal:</strong> ₹${formatINR(order.subtotal)}</div>
            <div><strong>Tax (18%):</strong> ₹${formatINR(order.tax)}</div>
            <div><strong>Shipping:</strong> ₹${formatINR(order.shipping)}</div>
            <div><strong>Total Payable:</strong> ₹${formatINR(order.total)}</div>
          </div>
          <button class="btn-outline" data-back-to-cart>Back</button>
        </div>
        ${Object.keys(order.perPerson).length ? `
        <div>
          <label>Per-person totals</label>
          <div class="picker-list">
            ${Object.entries(order.perPerson).map(([uid, amt]) => `
              <div class="picker-row"><div>${order.people[uid]?.name || resolveUserLabel(uid)}</div><div>₹${formatINR(amt)}</div></div>
            `).join('')}
          </div>
        </div>` : ''}
        <form id="checkoutForm" class="friend-form" style="display:grid; gap:10px;">
          <div class="row">
            <label>Name</label>
            <input id="coName" class="input" placeholder="Your full name" required value="${state.user.name || ''}" />
          </div>
          <div class="row">
            <label>Email</label>
            <input id="coEmail" type="email" class="input" placeholder="you@example.com" required value="${state.user.email || ''}" />
          </div>
          <div class="row">
            <label>Address</label>
            <textarea id="coAddr" class="input" placeholder="Shipping address" required rows="3"></textarea>
          </div>
          <div class="row">
            <label>Payment</label>
            <select id="coPay" class="input">
              <option value="cod">Cash on Delivery</option>
              <option value="card">Credit/Debit Card</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          <button class="btn-primary" type="submit">Place Order</button>
        </form>
      </div>
    `;
  };

  // ----- Room Cart helpers -----
  function roomCartSubtotal(rc) {
    return (rc.items||[]).reduce((sum, it) => {
      const p = trendingProducts.find(x => x.id === it.productId);
      return sum + (p ? (p.price * (it.qty||1)) : 0);
    }, 0);
  }
  function roomCartLines(rc) {
    return (rc.items||[]).map(it => {
      const p = trendingProducts.find(x => x.id === it.productId) || null;
      return { ...it, product: p };
    });
  }
  function computeParticipants(rc) {
    const map = Object.assign({}, rc.participants);
    // ensure self exists if contributed
    (rc.items||[]).forEach(it => {
      const uid = it.addedBy;
      if (uid && !map[uid]) {
        // Best-effort name from item
        map[uid] = { id: uid, name: it.addedByName || 'Member', email: '' };
      }
    });
    if (state.user && state.user.id) map[state.user.id] = { id: state.user.id, name: state.user.name, email: state.user.email };
    return map;
  }
  function computeSplit(rc) {
    const total = roomCartSubtotal(rc);
    const participants = computeParticipants(rc);
    const ids = Object.keys(participants);
    const result = {};
    if (!ids.length || total <= 0) return { total, shares: result, participants };
    if (rc.split && rc.split.method === 'byItems') {
      // Sum by who added what
      const sums = {};
      (rc.items||[]).forEach(it => {
        const p = trendingProducts.find(x => x.id === it.productId);
        if (!p) return;
        const amt = p.price * (it.qty||1);
        sums[it.addedBy] = (sums[it.addedBy]||0) + amt;
      });
      ids.forEach(id => { result[id] = sums[id] || 0; });
    } else if (rc.split && rc.split.method === 'custom') {
      // custom percentages (0..100) or absolute shares; normalize to total
      const weights = ids.map(id => Math.max(0, Number(rc.split.custom?.[id] || 0)));
      const sumW = weights.reduce((a,b)=>a+b,0) || ids.length;
      ids.forEach((id, i) => { result[id] = Math.round((total * (weights[i] || (sumW ? (1) : 1))) / sumW); });
    } else {
      // equal split
      const each = Math.round(total / ids.length);
      ids.forEach(id => { result[id] = each; });
    }
    return { total, shares: result, participants };
  }
  function exportRoomRecap(rc) {
    const lines = roomCartLines(rc);
    const split = computeSplit(rc);
    const header = `Room Cart Recap - ${state.room.name || state.room.id}`;
    const itemsStr = lines.map(l => {
      const title = l.product ? (l.product.brand + ' ' + l.product.title) : ('#' + l.productId);
      const price = l.product ? l.product.price : 0;
      return `- ${title} x${l.qty||1} @ ₹${formatINR(price)} by ${l.addedByName||l.addedBy}`;
    }).join('\n');
    const totalsStr = Object.entries(split.shares).map(([uid, amt]) => {
      const name = split.participants[uid]?.name || uid;
      return `- ${name}: ₹${formatINR(amt)}`;
    }).join('\n');
    const text = `${header}\n\nItems:\n${itemsStr}\n\nSplit (${state.roomCart.split.method}):\n${totalsStr}\n\nTotal: ₹${formatINR(split.total)}`;
    return text;
  }
  function renderRoomCartView() {
    const rc = state.roomCart && state.roomCart.roomId === state.room.id ? state.roomCart : { roomId: state.room.id, items: [], split: { method: 'equal', custom: {} }, participants: {} };
    const lines = roomCartLines(rc);
    const split = computeSplit(rc);
    const container = document.getElementById('cartTabBody') || body;
    container.innerHTML = `
      <div style="display:grid; gap:12px; width:100%">
        <div class="wishlist-row" style="justify-content:space-between; align-items:center;">
          <h3>Room Cart · ${state.room.name || state.room.id}</h3>
          <div style="display:flex; gap:8px;">
            <select id="roomSplitMethod" class="input">
              <option value="equal" ${rc.split.method==='equal'?'selected':''}>Split equally</option>
              <option value="byItems" ${rc.split.method==='byItems'?'selected':''}>Each pays their items</option>
              <option value="custom" ${rc.split.method==='custom'?'selected':''}>Custom split</option>
            </select>
            <button class="btn-outline" id="roomExportRecap">Export Recap</button>
          </div>
        </div>
        ${lines.length ? `
          <div class="picker-list">
            ${lines.map(l => `
              <div class="picker-row" data-room-line="${l.productId}" data-addedby="${l.addedBy}">
                <div style="display:flex; gap:10px; align-items:center;">
                  <img src="${l.product?.img || ''}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">
                  <div>
                    <strong>${l.product ? l.product.brand : ''}</strong>
                    <div style="font-size:12px;opacity:.8">${l.product ? l.product.title : ('#'+l.productId)}</div>
                    <div class="price-row" style="margin-top:4px;">
                      <span class="price">₹${formatINR(l.product?.price || 0)}</span>
                      ${l.product ? `<span class="mrp">₹${formatINR(l.product.mrp)}</span><span class="discount">${l.product.discount}% OFF</span>` : ''}
                    </div>
                    <small>by ${l.addedByName || l.addedBy}</small>
                  </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                  <label style="font-size:12px;">Size</label>
                  <input class="input" style="width:70px" value="${l.size||''}" data-room-size data-id="${l.productId}" data-addedby="${l.addedBy}">
                  <button class="btn-outline" data-room-dec data-id="${l.productId}" data-addedby="${l.addedBy}">-</button>
                  <span aria-label="Quantity">${l.qty||1}</span>
                  <button class="btn-outline" data-room-inc data-id="${l.productId}" data-addedby="${l.addedBy}">+</button>
                  <button class="btn-outline" data-room-remove data-id="${l.productId}" data-addedby="${l.addedBy}">Remove</button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="wishlist-row" style="justify-content:space-between;">
            <div>
              <div><strong>Total:</strong> ₹${formatINR(split.total)}</div>
              <div style="font-size:12px;opacity:.85">${Object.keys(split.participants).length} participant(s)</div>
            </div>
            <button class="btn-outline" data-back-to-cart>Back</button>
          </div>
          <div style="display:grid; gap:8px;">
            <label>Per-person totals</label>
            <div class="picker-list">
              ${Object.entries(split.shares).map(([uid, amt]) => `
                <div class="picker-row">
                  <div>${split.participants[uid]?.name || resolveUserLabel(uid)}</div>
                  ${rc.split.method==='custom' ? `<input class="input" style="width:90px" data-custom-share data-uid="${uid}" value="${Number(rc.split.custom?.[uid]||0)}" />` : ''}
                  <div>₹${formatINR(amt)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `<em>No items in room cart yet.</em>`}
      </div>
    `;
  }

  // Tabs when in room
  if (state.room && state.room.id) {
    body.innerHTML = `
      <div style="display:grid; gap:10px;">
        <div class="wishlist-row" style="justify-content:flex-start; gap:8px;">
          <button class="btn-outline" data-tab="cart" ${step==='cart'?'disabled':''}>My Bag</button>
          <button class="btn-outline" data-tab="roomcart" ${step==='roomcart'?'disabled':''}>Room Cart</button>
        </div>
        <div id="cartTabBody"></div>
      </div>
    `;
    const tabBody = body.querySelector('#cartTabBody');
    function renderTab() {
      if (step === 'checkout') { renderCheckoutView(); return; }
      if (step === 'roomcart') { renderRoomCartView(); return; }
      renderCartView();
    }
    // render initial
    renderTab();
    // delegate tab switching
    body.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.matches('[data-tab]')) {
        step = t.getAttribute('data-tab');
        openCartModal(step);
      }
    });
  } else {
    if (step === 'checkout') renderCheckoutView(); else renderCartView();
  }
  modal.setAttribute('aria-hidden', 'false');

  // bind interactions
  body.onclick = (e) => {
    const t = e.target;
    if (!t) return;
    if (t.matches('[data-cart-inc]')) {
      const cid = t.getAttribute('data-cid');
      if (cid && Array.isArray(state.cartV2) && state.cartV2.length) {
        const it = state.cartV2.find(x => (x.id || `${x.productId}|${x.size||''}|${x.forUser?.id||''}`) === cid);
        if (it) it.qty = (it.qty||1) + 1;
        state.cartCount = state.cartV2.reduce((s,l)=>s+(l.qty||1),0);
      } else {
        const id = Number(t.getAttribute('data-id'));
        state.cart.push(id);
        state.cartCount = state.cart.length;
      }
      document.getElementById('cartCount').textContent = String(state.cartCount);
      saveState();
      openCartModal('cart');
    }
    if (t.matches('[data-cart-dec]')) {
      const cid = t.getAttribute('data-cid');
      if (cid && Array.isArray(state.cartV2) && state.cartV2.length) {
        const it = state.cartV2.find(x => (x.id || `${x.productId}|${x.size||''}|${x.forUser?.id||''}`) === cid);
        if (it) it.qty = Math.max(1, (it.qty||1) - 1);
        state.cartCount = state.cartV2.reduce((s,l)=>s+(l.qty||1),0);
      } else {
        const id = Number(t.getAttribute('data-id'));
        const idx = state.cart.findIndex(x => x === id);
        if (idx >= 0) state.cart.splice(idx, 1);
        state.cartCount = state.cart.length;
      }
      document.getElementById('cartCount').textContent = String(state.cartCount);
      saveState();
      openCartModal('cart');
    }
    if (t.matches('[data-cart-remove]')) {
      const cid = t.getAttribute('data-cid');
      if (cid && Array.isArray(state.cartV2) && state.cartV2.length) {
        state.cartV2 = state.cartV2.filter(x => (x.id || `${x.productId}|${x.size||''}|${x.forUser?.id||''}`) !== cid);
        state.cartCount = state.cartV2.reduce((s,l)=>s+(l.qty||1),0);
      } else {
        const id = Number(t.getAttribute('data-id'));
        state.cart = state.cart.filter(x => x !== id);
        state.cartCount = state.cart.length;
      }
      document.getElementById('cartCount').textContent = String(state.cartCount);
      saveState();
      openCartModal('cart');
    }
    if (t.matches('[data-checkout]')) {
      openCartModal('checkout');
    }
    if (t.matches('[data-back-to-cart]')) {
      openCartModal('cart');
    }
    // Room cart interactions
    if (t.matches('[data-room-inc]')) {
      const id = Number(t.getAttribute('data-id'));
      const by = t.getAttribute('data-addedby') || state.user.id;
      roomCartUpdateItem(id, by, { qty: +1 });
      openCartModal('roomcart');
    }
    if (t.matches('[data-room-dec]')) {
      const id = Number(t.getAttribute('data-id'));
      const by = t.getAttribute('data-addedby') || state.user.id;
      roomCartUpdateItem(id, by, { qty: -1 });
      openCartModal('roomcart');
    }
    if (t.matches('[data-room-remove]')) {
      const id = Number(t.getAttribute('data-id'));
      const by = t.getAttribute('data-addedby') || state.user.id;
      roomCartRemoveItem(id, by);
      openCartModal('roomcart');
    }
  };

  const form = () => body.querySelector('#checkoutForm');
  setTimeout(() => {
    const f = form();
    if (f) {
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        // simulate order placement
        const orderId = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        // clear cart
        state.cart = [];
        state.cartV2 = [];
        state.cartCount = 0;
        document.getElementById('cartCount').textContent = '0';
        saveState();
        body.innerHTML = `
          <div style="display:grid; gap:12px; width:100%">
            <h3>Order Placed</h3>
            <p>Thank you! Your order <strong>${orderId}</strong> has been placed successfully.</p>
            <button class="btn-primary" data-close-cart>Done</button>
          </div>`;
      });
    }
    // Split controls, size inputs, export
    try {
      const methodSel = document.getElementById('roomSplitMethod');
      if (methodSel) methodSel.addEventListener('change', (ev) => {
        const v = ev.target.value;
        state.roomCart.split.method = v;
        roomCartBroadcast({ type: 'roomcart:split', split: state.roomCart.split });
        openCartModal('roomcart');
      });
      document.querySelectorAll('[data-custom-share]')?.forEach(inp => {
        inp.addEventListener('change', (ev) => {
          const uid = ev.target.getAttribute('data-uid');
          const val = Number(ev.target.value || 0);
          if (!state.roomCart.split.custom) state.roomCart.split.custom = {};
          state.roomCart.split.custom[uid] = val;
          roomCartBroadcast({ type: 'roomcart:split', split: state.roomCart.split });
          openCartModal('roomcart');
        });
      });
      document.querySelectorAll('[data-room-size]')?.forEach(inp => {
        inp.addEventListener('change', (ev) => {
          const pid = Number(ev.target.getAttribute('data-id'));
          const by = ev.target.getAttribute('data-addedby') || state.user.id;
          const size = String(ev.target.value||'');
          roomCartUpdateItem(pid, by, { size, absolute: true });
        });
      });
      const exportBtn = document.getElementById('roomExportRecap');
      if (exportBtn) exportBtn.addEventListener('click', async () => {
        const txt = exportRoomRecap(state.roomCart);
        try { await navigator.clipboard.writeText(txt); toast('Recap copied'); } catch {}
        // also trigger a download
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `room-cart-${state.room.id}.txt`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      });
    } catch {}
  }, 0);
}

function setupCartUI() {
  const openBtn = document.getElementById('openCart');
  const cartModal = document.getElementById('cartModal');
  if (openBtn) openBtn.addEventListener('click', () => openCartModal('cart'));
  if (cartModal) cartModal.addEventListener('click', (e) => { const t = e.target; if (t && t.hasAttribute('data-close-cart')) cartModal.setAttribute('aria-hidden','true'); });
}

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
        ${state.room && state.room.id ? `<button class="btn-outline" data-add-to-roomcart data-id="${p.id}">Add to Room Cart</button>` : ''}
      </div>
    </article>
  `).join('');
}

function saveState() {
  localStorage.setItem('myntra_theme', state.theme);
  localStorage.setItem('myntra_wishlist', JSON.stringify(Array.from(state.wishlist)));
  localStorage.setItem('myntra_cart', JSON.stringify(state.cart));
  try { localStorage.setItem('myntra_cart_v2', JSON.stringify(state.cartV2 || [])); } catch {}
  localStorage.setItem('myntra_user', JSON.stringify(state.user));
  localStorage.setItem('myntra_friends', JSON.stringify(state.friends));
  localStorage.setItem('myntra_wishlists_v2', JSON.stringify(state.wishlists));
  localStorage.setItem('myntra_wishlist_invites', JSON.stringify(state.incomingListInvites));
  localStorage.setItem('myntra_friendRequests', JSON.stringify(state.friendRequests));
  localStorage.setItem('myntra_incoming_requests', JSON.stringify(state.incomingRequests));
  try { localStorage.setItem('myntra_roomcart', JSON.stringify(state.roomCart || {})); } catch {}
  try { localStorage.setItem('myntra_user_labels', JSON.stringify(state.userLabels || {})); } catch {}
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
    try {
      const cartV2 = JSON.parse(localStorage.getItem('myntra_cart_v2') || '[]');
      if (Array.isArray(cartV2) && cartV2.length) state.cartV2 = cartV2;
      // migrate legacy to v2 once
      if ((!state.cartV2 || !state.cartV2.length) && Array.isArray(cart) && cart.length) {
        state.cartV2 = cart.map(pid => ({ id: 'c-'+Math.random().toString(36).slice(2,9), productId: pid, size: '', qty: 1, forUser: { id: state.user.id, name: state.user.name, email: state.user.email } }));
        state.cart = [];
      }
      // normalize forUser labels so raw IDs never show
      try {
        state.cartV2 = (state.cartV2 || []).map(it => {
          const u = it.forUser || { id: state.user.id, name: state.user.name, email: state.user.email };
          const nm = String(u.name || '');
          const looksLikeUid = /^u_[a-z0-9]+$/i.test(nm);
          const friendly = (!nm || looksLikeUid) ? (u.email || resolveUserLabel(u.id)) : nm;
          return Object.assign({}, it, { forUser: { id: u.id, name: friendly, email: u.email || '' } });
        });
      } catch {}
    } catch {}
    state.wishlistCount = state.wishlist.size;
    state.cartCount = state.cart.length;
    const user = JSON.parse(localStorage.getItem('myntra_user') || 'null');
    if (user && user.id) state.user = user;
    const friends = JSON.parse(localStorage.getItem('myntra_friends') || '[]');
    state.friends = Array.isArray(friends) ? friends : [];
    // profiles feature removed
    const lists = JSON.parse(localStorage.getItem('myntra_wishlists_v2') || '[]');
    state.wishlists = Array.isArray(lists) ? lists : [];
    // Backfill ownerMeta / membersMeta for all lists so names render nicely
    try {
      state.wishlists = state.wishlists.map(l => {
        const list = Object.assign({}, l);
        // ownerMeta
        if (!list.ownerMeta && list.ownerId) {
          if (list.ownerId === state.user.id) {
            list.ownerMeta = { id: state.user.id, name: state.user.name, email: state.user.email };
          } else {
            const fr = state.friends.find(f => f.id === list.ownerId) || (state.contacts||[]).find(c => c.id === list.ownerId);
            list.ownerMeta = fr ? { id: fr.id, name: fr.name, email: fr.email } : { id: list.ownerId, name: '', email: '' };
          }
        }
        // membersMeta
        const membersIds = Array.isArray(list.members) ? list.members : [];
        const meta = Array.isArray(list.membersMeta) ? list.membersMeta.slice() : [];
        membersIds.forEach(mid => {
          if (!meta.some(m => m.id === mid)) {
            if (mid === state.user.id) meta.push({ id: state.user.id, name: state.user.name, email: state.user.email });
            else {
              const fr = state.friends.find(f => f.id === mid) || (state.contacts||[]).find(c => c.id === mid);
              meta.push({ id: mid, name: fr ? (fr.name || fr.email || '') : '', email: fr ? (fr.email || '') : '' });
            }
          }
        });
        list.membersMeta = meta;
        return list;
      });
    } catch {}
    const wlInvites = JSON.parse(localStorage.getItem('myntra_wishlist_invites') || '[]');
    state.incomingListInvites = Array.isArray(wlInvites) ? wlInvites : [];
    try { state.userLabels = JSON.parse(localStorage.getItem('myntra_user_labels') || '{}') || {}; } catch { state.userLabels = {}; }
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
    try {
      const rc = JSON.parse(localStorage.getItem('myntra_roomcart') || 'null');
      if (rc && typeof rc === 'object') state.roomCart = rc;
    } catch {}
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
      openAddToBagPrompt(id, { askAssignee: false });
    }
    if (target && target.matches('[data-add-to-wishlist]')) {
      const id = Number(target.getAttribute('data-id'));
      openPickerModal(id);
    }
    if (target && target.matches('[data-add-to-roomcart]')) {
      const id = Number(target.getAttribute('data-id'));
      addToRoomCart(id, '', 1);
      toast('Added to room cart');
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
        ${state.room && state.room.id ? `<button class="btn-outline" data-add-to-roomcart data-id="${p.id}">Add to Room Cart</button>` : ''}
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
  // Ensure ownerMeta and membersMeta present with names/emails
  try {
    if (!list.ownerMeta && list.ownerId) {
      const fr = state.friends.find(f => f.id === list.ownerId);
      list.ownerMeta = fr ? { id: fr.id, name: fr.name, email: fr.email } : { id: list.ownerId, name: '', email: '' };
    }
    const membersIds = Array.isArray(list.members) ? list.members : [];
    list.membersMeta = Array.isArray(list.membersMeta) ? list.membersMeta : [];
    membersIds.forEach(mid => {
      if (!list.membersMeta.some(m => m.id === mid)) {
        const fr = state.friends.find(f => f.id === mid) || (state.contacts||[]).find(c => c.id === mid) || null;
        list.membersMeta.push({ id: mid, name: fr ? (fr.name || fr.email || '') : '', email: fr ? (fr.email || '') : '' });
      }
    });
  } catch {}
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
  // De-duplicate incoming shared wishlist invites by (listId, senderId/email)
  const invitesUnique = Array.isArray(state.incomingListInvites)
    ? (() => {
        const seen = new Set();
        return state.incomingListInvites
          // Hide invites where I'm already the owner or a member
          .filter((inv) => {
            try {
              const lid = inv && inv.list && inv.list.id;
              const l = lid && state.wishlists.find(x => x.id === lid);
              const isOwner = l ? (l.ownerId === state.user.id) : (inv && inv.list && inv.list.ownerId === state.user.id);
              const isMember = l ? ((l.members||[]).includes(state.user.id)) : ((inv && inv.list && (inv.list.members||[]).includes(state.user.id)));
              return !(isOwner || isMember);
            } catch { return true; }
          })
          // Deduplicate by (listId, senderId/email)
          .filter((inv) => {
            const listId = inv && inv.list && inv.list.id ? inv.list.id : inv && inv.token;
            const fromKey = inv && inv.from ? (inv.from.id || inv.from.email || '') : '';
            const key = String(listId) + '|' + String(fromKey);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      })()
    : [];
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
    ${invitesUnique && invitesUnique.length ? `
      <div style="margin-top:16px;">
        <label>Shared wishlist invites</label>
        <div class="picker-list">
          ${invitesUnique.map(inv => `
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
    if (t && t.matches('[data-add-to-bag-fromlist]')) {
      const pid = Number(t.getAttribute('data-pid'));
      const listId = t.getAttribute('data-list');
      openAddToBagPrompt(pid, { askAssignee: true, fromListId: listId });
    }
    if (t && t.matches('[data-add-to-roomcart-fromlist]')) {
      const pid = Number(t.getAttribute('data-pid'));
      addToRoomCart(pid, '', 1);
      toast('Added to room cart');
    }
    if (t && t.matches('[data-accept-list-invite]')) {
      const token = t.getAttribute('data-token');
      const inv = state.incomingListInvites.find(i => i.token === token);
      if (!inv) return;
      // Add/merge list locally
      const l = Object.assign({}, inv.list);
      l.members = l.members || [];
      // persist owner metadata if available
      if (inv.from && inv.from.id) {
        l.ownerId = inv.from.id || l.ownerId;
        l.ownerMeta = { id: inv.from.id, name: inv.from.name || '', email: inv.from.email || '' };
        // Ensure sender exists in friends so we can resolve names
        if (!state.friends.some(f => f.id === inv.from.id)) {
          state.friends.push({ id: inv.from.id, name: inv.from.name || inv.from.email || 'Member', email: inv.from.email || '' });
        }
      }
      if (!l.members.includes(state.user.id) && state.user.id !== l.ownerId) {
        l.members.push(state.user.id);
      }
      // Ensure membersMeta exists and contains a proper entry for me and existing members
      l.membersMeta = Array.isArray(l.membersMeta) ? l.membersMeta : [];
      const ensureMeta = (uid, name, email) => {
        if (!uid) return;
        if (!l.membersMeta.some(m => m.id === uid)) {
          // Try best-known labels
          const fr = state.friends.find(f => f.id === uid) || (state.contacts||[]).find(c => c.id === uid);
          l.membersMeta.push({ id: uid, name: name || (fr ? (fr.name || fr.email) : '' ) || resolveUserLabel(uid), email: email || (fr ? fr.email : '') || '' });
        }
      };
      // Add self meta
      ensureMeta(state.user.id, state.user.name, state.user.email);
      // Add owner as member meta too (so it appears in assignee list even if not in members array)
      if (l.ownerMeta && l.ownerMeta.id) ensureMeta(l.ownerMeta.id, l.ownerMeta.name, l.ownerMeta.email);
      // Add existing member metas
      (l.members||[]).forEach(mid => { ensureMeta(mid, '', ''); });
      upsertWishlist(l);
      // Remove ALL invites for this list (not just the clicked token)
      state.incomingListInvites = state.incomingListInvites.filter(i => {
        try { return (i && i.list && i.list.id) !== l.id; } catch { return true; }
      });
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
      const inv = state.incomingListInvites.find(i => i.token === token);
      if (inv && inv.list && inv.list.id) {
        // Remove ALL invites for this list
        const listId = inv.list.id;
        state.incomingListInvites = state.incomingListInvites.filter(i => {
          try { return (i && i.list && i.list.id) !== listId; } catch { return true; }
        });
      } else {
        // Fallback: remove by token
        state.incomingListInvites = state.incomingListInvites.filter(i => i.token !== token);
      }
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
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button class="btn-outline" data-add-to-bag-fromlist data-list="${listId}" data-pid="${it.productId}">Add to Bag</button>
            ${state.room && state.room.id ? `<button class="btn-outline" data-add-to-roomcart-fromlist data-list="${listId}" data-pid="${it.productId}">Add to Room Cart</button>` : ''}
            <button class="btn-outline" data-remove-item data-list="${listId}" data-pid="${it.productId}">Remove</button>
          </div>
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
    const list = { id: generateId('wl'), name, ownerId: state.user.id, ownerMeta: { id: state.user.id, name: state.user.name, email: state.user.email }, members: [], membersMeta: [], items: [] };
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

        // Room Cart events
        if (msg.type && msg.type.startsWith('roomcart:')) {
          const roomId = msg.roomId;
          if (!roomId || !state.room || state.room.id !== roomId) {
            // ignore events for other rooms
          } else {
            state.roomCart = state.roomCart && state.roomCart.roomId === roomId ? state.roomCart : { roomId, items: [], split: { method: 'equal', custom: {} }, participants: {} };
            const rc = state.roomCart;
            rc.participants = rc.participants || {};
            if (msg.type === 'roomcart:add' && msg.item) {
              const it = msg.item;
              // merge by productId + addedBy + size
              const existing = (rc.items||[]).find(x => x.productId === it.productId && x.addedBy === it.addedBy && String(x.size||'') === String(it.size||''));
              if (existing) { existing.qty = Math.max(1, (existing.qty||1) + (it.qty||1)); } else { (rc.items = rc.items||[]).push({ productId: it.productId, size: it.size||'', qty: Math.max(1, it.qty||1), addedBy: it.addedBy, addedByName: it.addedByName }); }
              if (it.addedBy) rc.participants[it.addedBy] = rc.participants[it.addedBy] || { id: it.addedBy, name: it.addedByName || 'Member', email: '' };
              saveState();
            }
            if (msg.type === 'roomcart:update' && (typeof msg.productId !== 'undefined') && msg.addedBy) {
              const it = (rc.items||[]).find(x => x.productId === msg.productId && x.addedBy === msg.addedBy);
              if (it && msg.changes) {
                if (typeof msg.changes.size !== 'undefined') it.size = msg.changes.size;
                if (typeof msg.changes.qty !== 'undefined') it.qty = Math.max(1, Number(msg.changes.qty));
                saveState();
              }
            }
            if (msg.type === 'roomcart:remove' && (typeof msg.productId !== 'undefined') && msg.addedBy) {
              rc.items = (rc.items||[]).filter(x => !(x.productId === msg.productId && x.addedBy === msg.addedBy));
              saveState();
            }
            if (msg.type === 'roomcart:snapshot' && msg.snapshot && msg.snapshot.roomId === roomId) {
              // trust snapshot
              state.roomCart = msg.snapshot;
              saveState();
            }
            if (msg.type === 'roomcart:requestSync') {
              // someone requested, send our snapshot if we have any
              if (state.roomCart && state.roomCart.roomId === roomId && (state.roomCart.items||[]).length) {
                roomCartSendSnapshot();
              }
            }
            if (msg.type === 'roomcart:split' && msg.split) {
              rc.split = msg.split;
              saveState();
            }
            // If cart modal open on room cart, rerender
            const cartModal = document.getElementById('cartModal');
            if (cartModal && cartModal.getAttribute('aria-hidden') === 'false') {
              openCartModal('roomcart');
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

// -------- Auth Gate (Login / Sign up) --------
function setupAuthGate() {
  const gate = document.getElementById('authGate');
  const form = document.getElementById('authForm');
  const btnLogin = document.getElementById('authLogin');
  const inName = document.getElementById('authName');
  const inEmail = document.getElementById('authEmail');
  const header = document.querySelector('header.header');
  const main = document.querySelector('main');
  const footer = document.querySelector('footer.footer');
  const mynaBtn = document.getElementById('mynaToggle');
  if (!gate || !form || !btnLogin || !inEmail) return;

  function hideApp(hide) {
    const display = hide ? 'none' : '';
    if (header) header.style.display = display;
    if (main) main.style.display = display;
    if (footer) footer.style.display = display;
    if (mynaBtn) mynaBtn.hidden = hide ? true : false;
  }

  function userFromStorage() {
    try { return JSON.parse(localStorage.getItem('myntra_user') || 'null'); } catch { return null; }
  }
  function persistUser(u) {
    localStorage.setItem('myntra_user', JSON.stringify(u));
    state.user = Object.assign(state.user || {}, u);
    saveState();
  }
  function makeId(email) {
    const base = btoa(unescape(encodeURIComponent(String(email).toLowerCase()))).replace(/[^a-z0-9]/gi,'').slice(0,12);
    return 'u_' + (base || Math.random().toString(36).slice(2, 10));
  }

  const existing = userFromStorage();
  if (existing && existing.email) {
    // Restore session
    state.user = Object.assign(state.user || {}, existing);
    gate.hidden = true;
    hideApp(false);
    return;
  }

  // No session: show auth gate and hide rest of app
  gate.hidden = false;
  hideApp(true);

  btnLogin.addEventListener('click', (e) => {
    e.preventDefault();
    const email = (inEmail.value || '').trim();
    if (!email) { inEmail.focus(); return; }
    const name = (inName.value || '').trim() || email.split('@')[0];
    const user = { id: makeId(email), email, name };
    persistUser(user);
    gate.hidden = true;
    hideApp(false);
    document.getElementById('profileLabel').textContent = user.name || 'Profile';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (inEmail.value || '').trim();
    const name = (inName.value || '').trim();
    if (!email || !name) { (name ? inEmail : inName).focus(); return; }
    const user = { id: makeId(email), email, name };
    persistUser(user);
    gate.hidden = true;
    hideApp(false);
    document.getElementById('profileLabel').textContent = user.name || 'Profile';
  });
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
  // Initialize room cart context
  try {
    if (!state.roomCart || state.roomCart.roomId !== roomId) {
      state.roomCart = { roomId, items: [], split: { method: 'equal', custom: {} }, participants: {} };
      saveState();
    } else {
      // ensure roomId is set
      state.roomCart.roomId = roomId;
    }
  } catch {}
  // Ask peers for latest snapshot
  try { roomCartBroadcast({ type: 'roomcart:requestSync' }); } catch {}
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
  setupCartUI();
  setupSearch();
  setupCarousel();
  setupModal();
  setupRoomUX();
  setYear();
  // Auth gate runs first; will set/ensure user session
  setupAuthGate();
  // If a previous session existed, profile is ensured by setupAuthGate
  setupProfileButton();
  document.getElementById('profileLabel').textContent = state.user.name || 'Profile';
  setupWishlistModals();
  handleJoinLink();
  setupRealtime();
  connectRelay();
  setupMynaChat();
});


