const state = {
  wishlistCount: 0,
  cartCount: 0,
  currentSlide: 0,
  autoAdvanceMs: 5000,
  theme: 'light',
  wishlist: new Set(),
  cart: [],
  filters: { category: 'all', minDiscount: 0, sortBy: 'popular' },
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
  document.getElementById('wishlistCount').textContent = String(state.wishlistCount);
  document.getElementById('cartCount').textContent = String(state.cartCount);
  setupTheme();
  renderTrending();
  setupControls();
  setupCartWishlist();
  setupSearch();
  setupCarousel();
  setupModal();
  setYear();
});


