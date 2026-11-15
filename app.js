const API_URL = 'https://script.google.com/macros/s/AKfycbwicrtU-7j9iw9YXfj2xVpPXt0k8p6VVDY67IJVmkmmHCXfIuIMhIKQwU8d5u5XVyZe/exec'; // <-- حط رابط الـ Web App هنا
let products = [];
let activeFilter = 'All', searchTerm = '';
let cart = JSON.parse(localStorage.getItem('mavero-cart') || '[]');
const $ = s => document.querySelector(s);
const grid = $('#productGrid'), drawer = $('#cartDrawer'), overlay = $('#overlay'), modal = $('#productModal');

const money = n => 'EGP ' + Number(n).toLocaleString('en-US');

const colorMap = {
  'brown': '#4A3B32', 'chocolate': '#3B2820', 'beige': '#D8C4B6',
  'cream': '#F5EFE6', 'black': '#1A1A1A', 'white': '#FFFFFF',
  'tan': '#C19A6B', 'camel': '#C19A6B', 'olive': '#556B2F',
  'navy': '#1B263B', 'burgundy': '#6D1A36', 'grey': '#808080', 'gray': '#808080'
};
const getColorHex = name => colorMap[name.toLowerCase()] || name;

async function fetchProductsFromSheet() {
  try {
    const res = await fetch(API_URL);
    products = await res.json();
    renderProducts();
  } catch (err) {
    console.error('Error loading products:', err);
    grid.innerHTML = '<p>تعذر تحميل المنتجات.</p>';
  }
}

function renderProducts(){
  let list = products.filter(p => (activeFilter === 'All' || p.category === activeFilter) && (`${p.name} ${p.category}`.toLowerCase().includes(searchTerm)));
  const sort = $('#sortSelect').value;
  if(sort === 'low') list.sort((a,b) => a.price - b.price);
  if(sort === 'high') list.sort((a,b) => b.price - a.price);
  
  grid.innerHTML = list.length ? list.map(p => {
    const hasVariants = p.variants && p.variants.length > 0;
    const defaultImg = hasVariants ? p.variants[0].image : p.image;
    const defaultColor = hasVariants ? p.variants[0].color : '';

    const swatchesHTML = hasVariants ? `
      <div class="color-swatches" onclick="event.stopPropagation()">
        ${p.variants.map((v, idx) => `
          <button type="button" class="swatch ${idx === 0 ? 'active' : ''}" 
            style="background-color: ${getColorHex(v.color)}" 
            title="${v.color}"
            data-swatch-img="${v.image}" 
            data-swatch-color="${v.color}">
          </button>
        `).join('')}
      </div>
    ` : '';

    return `
      <article class="product-card" data-id="${p.id}" data-selected-color="${defaultColor}" data-selected-img="${defaultImg}">
        <div class="product-image">
          <img src="${defaultImg}" alt="${p.name}" loading="lazy">
          ${p.tag ? `<span class="product-tag">${p.tag}</span>` : ''}
          <button class="quick-add" data-add="${p.id}">Quick add +</button>
        </div>
        ${swatchesHTML}
        <div class="product-info">
          <div>
            <h3>${p.name}</h3>
            <p>${p.category}</p>
          </div>
          <span class="price">${money(p.price)}</span>
        </div>
      </article>
    `;
  }).join('') : '<p>No products found.</p>';
}

function saveCart(){
  localStorage.setItem('mavero-cart', JSON.stringify(cart));
  renderCart();
}

function addToCart(id, selectedColor = '', selectedImg = ''){
  const p = products.find(x => x.id == id);
  if(!p) return;
  const color = selectedColor || (p.variants?.length ? p.variants[0].color : '');
  const image = selectedImg || (p.variants?.length ? p.variants[0].image : p.image);
  
  const cartKey = color ? `${id}-${color}` : `${id}`;
  const item = cart.find(x => x.cartKey === cartKey);
  
  item ? item.qty++ : cart.push({ cartKey, id, color, image, qty: 1 });
  saveCart();
  toast(color ? `Added (${color}) to your bag` : 'Added to your bag');
}

function renderCart(){
  const count = cart.reduce((s,x) => s + x.qty, 0);
  $('#cartCount').textContent = count;
  $('#drawerCount').textContent = `(${count})`;
  $('#cartEmpty').style.display = count ? 'none' : 'block';
  $('#cartBottom').style.display = count ? 'block' : 'none';
  
  $('#cartItems').innerHTML = cart.map(x => {
    const p = products.find(y => y.id == x.id);
    if (!p) return '';
    return `
      <div class="cart-row">
        <img src="${x.image || p.image}" alt="${p.name}">
        <div>
          <h4>${p.name} ${x.color ? `<span style="font-size:11px; color:#777;">(${x.color})</span>` : ''}</h4>
          <span class="row-price">${money(p.price)}</span>
          <div class="qty-control">
            <button data-qty="${x.cartKey}" data-delta="-1">−</button>
            <span>${x.qty}</span>
            <button data-qty="${x.cartKey}" data-delta="1">+</button>
          </div>
        </div>
        <button class="remove-item" data-remove="${x.cartKey}">×</button>
      </div>
    `;
  }).join('');
  
  const subtotalVal = cart.reduce((s,x) => {
    const p = products.find(y => y.id == x.id);
    return s + (p ? p.price * x.qty : 0);
  }, 0);
  
  $('#subtotal').textContent = money(subtotalVal);
}

function openCart(){ drawer.classList.add('open'); overlay.classList.add('show'); document.body.style.overflow = 'hidden'; }
function closePanels(){ drawer.classList.remove('open'); overlay.classList.remove('show'); modal.classList.remove('show'); document.body.style.overflow = ''; }
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

// نافذة تفاصيل المنتج ومعرض الصور الإضافية (Gallery)
function showProduct(id, initialColor = '', initialImg = ''){
  const p = products.find(x => x.id == id);
  if(!p) return;
  const hasVariants = p.variants && p.variants.length > 0;
  const activeColor = initialColor || (hasVariants ? p.variants[0].color : '');
  const activeImg = initialImg || (hasVariants ? p.variants[0].image : p.image);

  // تجميع كل الصور المتاحة للعرض (الصورة الأساسية + صور المعرض الإضافية)
  const allImages = [p.image, ...(p.gallery || [])];

  const modalSwatches = hasVariants ? `
    <div style="margin: 12px 0;">
      <p style="font-size: 12px; margin-bottom: 6px;">Color: <strong id="modalColorName">${activeColor}</strong></p>
      <div class="color-swatches">
        ${p.variants.map(v => `
          <button type="button" class="swatch ${v.color === activeColor ? 'active' : ''}" 
            style="background-color: ${getColorHex(v.color)}" 
            title="${v.color}"
            data-modal-swatch-img="${v.image}" 
            data-modal-swatch-color="${v.color}">
          </button>
        `).join('')}
      </div>
    </div>
  ` : '';

  // معرض الصور المصغرة (Gallery Thumbnails)
  const galleryHTML = allImages.length > 1 ? `
    <div class="product-gallery-thumbs">
      ${allImages.map((img, idx) => `
        <img src="${img}" alt="Thumbnail ${idx+1}" class="gallery-thumb ${img === activeImg ? 'active' : ''}" data-gallery-img="${img}">
      `).join('')}
    </div>
  ` : '';

  $('#modalContent').innerHTML = `
    <div class="modal-layout" id="activeModalProduct" data-id="${p.id}" data-selected-color="${activeColor}" data-selected-img="${activeImg}">
      <div class="modal-image-container">
        <img id="modalProductImg" src="${activeImg}" alt="${p.name}">
        ${galleryHTML}
      </div>
      <div>
        <p class="eyebrow">${p.category}</p>
        <h2>${p.name}</h2>
        <p>${p.desc || ''}</p>
        ${modalSwatches}
        <div class="modal-price">${money(p.price)}</div>
        <button class="btn btn-dark" id="modalAddBtn">Add to bag <span>→</span></button>
      </div>
    </div>
  `;
  modal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

// التفاعل مع دوائر الألوان ومعرض الصور
grid.addEventListener('click', e => {
  const swatch = e.target.closest('.swatch');
  if(swatch){
    e.stopPropagation();
    const card = swatch.closest('.product-card');
    card.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    
    const newImg = swatch.dataset.swatchImg;
    const newColor = swatch.dataset.swatchColor;
    card.querySelector('.product-image img').src = newImg;
    card.dataset.selectedColor = newColor;
    card.dataset.selectedImg = newImg;
    return;
  }

  const add = e.target.closest('[data-add]');
  if(add){
    e.stopPropagation();
    const card = add.closest('.product-card');
    addToCart(add.dataset.add, card?.dataset.selectedColor, card?.dataset.selectedImg);
    return;
  }

  const card = e.target.closest('.product-card');
  if(card) showProduct(card.dataset.id, card.dataset.selectedColor, card.dataset.selectedImg);
});

document.addEventListener('click', e => {
  // التبديل بين صور المعرض المصغرة داخل المودال
  const thumb = e.target.closest('[data-gallery-img]');
  if(thumb){
    const container = $('#activeModalProduct');
    container.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    const newImg = thumb.dataset.galleryImg;
    $('#modalProductImg').src = newImg;
    container.dataset.selectedImg = newImg;
  }

  const modalSwatch = e.target.closest('[data-modal-swatch-img]');
  if(modalSwatch){
    const container = $('#activeModalProduct');
    container.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    modalSwatch.classList.add('active');
    
    const newImg = modalSwatch.dataset.modalSwatchImg;
    const newColor = modalSwatch.dataset.modalSwatchColor;
    $('#modalProductImg').src = newImg;
    $('#modalColorName').textContent = newColor;
    container.dataset.selectedColor = newColor;
    container.dataset.selectedImg = newImg;
  }

  if(e.target.closest('#modalAddBtn')){
    const container = $('#activeModalProduct');
    addToCart(container.dataset.id, container.dataset.selectedColor, container.dataset.selectedImg);
  }
  
  const qty = e.target.closest('[data-qty]');
  if(qty){
    const key = qty.dataset.qty, item = cart.find(x => x.cartKey === key);
    if(item){
      item.qty += Number(qty.dataset.delta);
      if(item.qty <= 0) cart = cart.filter(x => x.cartKey !== key);
      saveCart();
    }
  }
  
  const remove = e.target.closest('[data-remove]');
  if(remove){
    cart = cart.filter(x => x.cartKey !== remove.dataset.remove);
    saveCart();
  }
});

$('#filterTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if(!b) return;
  activeFilter = b.dataset.filter;
  document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
  renderProducts();
});

document.querySelectorAll('[data-category-link]').forEach(a => a.addEventListener('click', () => {
  activeFilter = a.dataset.categoryLink;
  document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x.dataset.filter === activeFilter));
  renderProducts();
}));

$('#sortSelect').addEventListener('change', renderProducts);
$('#searchToggle').addEventListener('click', () => $('#searchBar').classList.toggle('show'));
$('#searchGo').addEventListener('click', () => {
  searchTerm = $('#searchInput').value.trim().toLowerCase();
  activeFilter = 'All';
  document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x.dataset.filter == 'All'));
  renderProducts();
  $('#shop').scrollIntoView();
});
$('#searchInput').addEventListener('keydown', e => { if(e.key === 'Enter') $('#searchGo').click(); });

$('#cartOpen').addEventListener('click', openCart);
$('#cartClose').addEventListener('click', closePanels);
$('#modalClose').addEventListener('click', closePanels);
overlay.addEventListener('click', closePanels);
$('#continueShopping').addEventListener('click', () => { closePanels(); $('#shop').scrollIntoView(); });

$('#checkoutForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#checkoutBtn');
  btn.disabled = true;
  btn.textContent = 'Sending order...';

  const itemsSummary = cart.map(x => {
    const p = products.find(y => y.id == x.id);
    const colorText = x.color ? ` - [${x.color}]` : '';
    return `${p ? p.name : 'Item'}${colorText} (x${x.qty})`;
  }).join(' | ');

  const totalAmount = cart.reduce((s, x) => {
    const p = products.find(y => y.id == x.id);
    return s + (p ? p.price * x.qty : 0);
  }, 0);

  const payload = {
    name: $('#custName').value.trim(),
    phone: $('#custPhone').value.trim(),
    city: $('#custCity').value.trim(),
    address: $('#custAddress').value.trim(),
    items: itemsSummary,
    total: totalAmount
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    cart = [];
    saveCart();
    e.target.reset();
    closePanels();
    toast('Order placed successfully! We will contact you soon.');
  } catch (err) {
    toast('Something went wrong. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Confirm Order <span>→</span>';
  }
});

$('#menuToggle').addEventListener('click', () => $('#mainNav').classList.toggle('open'));
document.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', () => $('#mainNav').classList.remove('open')));

$('#newsletterForm')?.addEventListener('submit', e => {
  e.preventDefault();
  $('#newsletterMessage').textContent = 'Thanks for your interest in MAVERO!';
  e.target.reset();
});

document.addEventListener('keydown', e => { if(e.key === 'Escape') closePanels(); });
$('#year').textContent = new Date().getFullYear();

fetchProductsFromSheet();
renderCart();