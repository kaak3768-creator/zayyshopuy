const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => "Rp " + Number(n).toLocaleString("id-ID");
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast = (message) => { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.classList.remove("show"),2800); };
const store = {
  get(k, d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },
};

/* ===================== KERANJANG ===================== */
// item: {id, name, price, qty, needsUsername}  — harga di sini hanya untuk tampilan; server menghitung ulang saat checkout.
let cart = store.get("zs_cart", []).filter(i => i && i.id && i.qty > 0);
let coupon = store.get("zs_coupon", "");
let quote = null; // hasil perhitungan server (diskon dsb.)

const subtotalLocal = () => cart.reduce((s,i)=>s+i.price*i.qty,0);
const saveCart = () => { store.set("zs_cart", cart); store.set("zs_coupon", coupon); };

async function refreshQuote(showErrors=false){
  quote = null;
  if (!cart.length) return renderTotals();
  try{
    const r = await fetch("/api/quote", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({items:cart.map(i=>({id:i.id,qty:i.qty})), coupon})});
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Gagal menghitung");
    quote = j;
  }catch(e){
    if (coupon){ coupon=""; saveCart(); if(showErrors) toast(e.message); }
  }
  renderTotals();
}

function renderTotals(){
  const sub = quote ? quote.subtotal : subtotalLocal();
  const disc = quote ? quote.discount : 0;
  $("#cartSubtotal").textContent = money(sub);
  $("#cartTotal").textContent = money(sub - disc);
  const row = $("#discountRow");
  row.hidden = !(quote && quote.coupon && disc > 0);
  if (!row.hidden){ $("#couponLabel").textContent = `(${quote.coupon.code})`; $("#cartDiscount").textContent = "-" + money(disc); }
  $("#couponInput").value = quote && quote.coupon ? quote.coupon.code : "";
  $("#checkoutBtn").disabled = !cart.length;
}

function renderCart(){
  $("#cartCount").textContent = cart.reduce((sum,item)=>sum+item.qty,0);
  const box = $("#cartItems");
  if(!cart.length){
    box.innerHTML = '<div class="empty-cart">🛒<b>Keranjang masih kosong</b><small>Tambahkan produk yang kamu suka.</small></div>';
  } else {
    box.innerHTML = cart.map((item,i)=>`<div class="cart-row"><div class="cart-product-icon">✦</div><div class="cart-row-info"><b>${esc(item.name)}</b><small>${money(item.price)}</small><div class="qty"><button data-dec="${i}" aria-label="Kurangi">−</button><span>${item.qty}</span><button data-inc="${i}" aria-label="Tambah">＋</button></div></div><div class="cart-line-total">${money(item.price*item.qty)}</div><button class="remove-item" data-remove="${i}" aria-label="Hapus produk">×</button></div>`).join("");
  }
  renderTotals();
}

function changeCart(){ saveCart(); renderCart(); refreshQuote(); }

$("#cartItems").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if (b.dataset.inc !== undefined){ const it=cart[+b.dataset.inc]; if(it.qty<10&&(it.stock==null||it.qty<it.stock)) it.qty++; else toast(it.stock!=null&&it.qty>=it.stock?"Stok tersisa "+it.stock:"Maksimal 10 per produk."); }
  else if (b.dataset.dec !== undefined){ const it=cart[+b.dataset.dec]; it.qty--; if(it.qty<1) cart.splice(+b.dataset.dec,1); }
  else if (b.dataset.remove !== undefined){ cart.splice(+b.dataset.remove,1); }
  else return;
  changeCart();
});

$("#productGrid").addEventListener("click",e=>{
  const btn=e.target.closest(".add-cart"); if(!btn) return;
  const id=btn.dataset.id, name=btn.dataset.name, price=Number(btn.dataset.price);
  const stock=btn.dataset.stock===""||btn.dataset.stock===undefined?null:Number(btn.dataset.stock);
  if(stock===0) return toast("Stok habis");
  const existing=cart.find(i=>i.id===id);
  if(existing){ if(existing.qty>=10) return toast("Maksimal 10 per produk."); if(stock!==null&&existing.qty>=stock) return toast("Stok tersisa "+stock); existing.qty++; }
  else cart.push({id,name,price,qty:1,stock});
  changeCart(); toast(name+" ditambahkan ke keranjang");
  const c=$("#cartOpen"); c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
});

$("#couponForm").addEventListener("submit", async e => {
  e.preventDefault();
  const code = $("#couponInput").value.trim().toUpperCase();
  if(!code) return;
  if(!cart.length) return toast("Tambahkan produk dulu sebelum memakai kode promo.");
  coupon = code; await refreshQuote(true);
  if (quote && quote.coupon) { saveCart(); toast(`Kode ${quote.coupon.code} dipakai — hemat ${money(quote.discount)} 🎉`); }
});
$("#couponRemove").addEventListener("click", () => { coupon=""; saveCart(); refreshQuote(); });

const openCart  = () => $("#cartOverlay").classList.add("open");
const closeCart = () => $("#cartOverlay").classList.remove("open");
$("#cartOpen").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
$("#cartOverlay").addEventListener("click", e => { if(e.target===$("#cartOverlay")) closeCart(); });

$("#checkoutBtn").addEventListener("click", () => {
  if(!cart.length) return toast("Keranjang kamu masih kosong.");
  closeCart();
  window.ZSCheckout.open({ cart: cart.map(i=>({...i})), coupon, quote });
});

/* ===================== FILTER, CARI, UI LAMA ===================== */
$$(".filter").forEach(btn=>btn.addEventListener("click",()=>{
  $$(".filter").forEach(b=>b.classList.remove("active"));btn.classList.add("active");
  const f=btn.dataset.filter;
  $$(".product-card").forEach(card=>card.style.display=(f==="all"||card.dataset.category===f)?"":"none");
}));
$("#loginClose").addEventListener("click",()=>$("#loginModal").classList.remove("open"));
$("#loginModal").addEventListener("click",e=>{if(e.target===$("#loginModal"))$("#loginModal").classList.remove("open")});
$("#mobileMenu").addEventListener("click",()=>$("#nav").classList.toggle("open"));
$$('#nav a').forEach(a=>a.addEventListener('click',()=>$("#nav").classList.remove("open")));
$("#searchToggle").addEventListener("click",()=>{const term=prompt("Cari produk ZayyStore:");if(!term)return;let found=0;$$(".product-card").forEach(card=>{const match=card.innerText.toLowerCase().includes(term.toLowerCase());card.style.display=match?"":"none";if(match)found++;});$$(".filter").forEach(b=>b.classList.remove("active"));$("#produk").scrollIntoView({behavior:"smooth"});toast(found?`Ditemukan ${found} produk.`:"Produk tidak ditemukan.");});
$$(".quick-view").forEach(btn=>btn.addEventListener("click",()=>{const card=btn.closest(".product-card");card.querySelector(".add-cart").click();}));
document.addEventListener("keydown", e => { if(e.key==="Escape"){ closeCart(); $("#loginModal").classList.remove("open"); } });

/* ===================== PRODUK (dikelola admin) ===================== */
async function loadProducts(){
  const grid=$("#productGrid");
  try{
    const r=await fetch("/api/products"); const data=await r.json(); const list=data.products||[];
    window.ZS_LIST=list;window.ZS_PROMO=data.promo||null; document.dispatchEvent(new CustomEvent("zs:promo",{detail:window.ZS_PROMO}));
    grid.innerHTML = list.length ? list.map(p=>`<article class="product-card sv-card"><div class="sv-img g-account">${p.bundle?'<span class="sv-bundle">★ PAKET HEMAT</span>':""}${p.img?`<img class="sv-photo-bg" src="${esc(p.img)}" alt="" aria-hidden="true"><img class="sv-photo" src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">`:'<div class="sv-art"><b>ZAYY<br>STORE</b></div>'}</div><div class="sv-body"><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>${p.bundle?`<ul class="sv-inc">${p.bundle.map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`:""}${p.detail?`<button type="button" class="sv-detail" data-detail="${esc(p.id)}">ℹ️ Lihat detail</button>`:""}<div class="sv-price">${p.bundle&&p.worth>p.price?`<s>${money(p.worth)}</s><em>Hemat ${money(p.worth-p.price)}</em>`:""}<strong>${money(p.price)}</strong></div>${p.stock!=null?`<div class="sv-stock${p.stock===0?" out":""}">${p.stock===0?"Stok habis":"Stok tersisa: "+p.stock}</div>`:""}<button class="add-cart sv-buy${p.stock===0?" soldout":""}" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}" data-stock="${p.stock==null?"":p.stock}" aria-label="Tambah ${esc(p.name)} ke keranjang">${p.stock===0?"Stok Habis":"🛒 Beli Sekarang"}</button></div></article>`).join("")
      : '<div class="empty-cart" style="grid-column:1/-1;padding:40px 0">📦<b>Belum ada produk</b><small>Produk akan muncul setelah admin menambahkannya.</small></div>';
    const ids=new Set(list.map(p=>p.id)), n=cart.length;
    cart=cart.filter(i=>ids.has(i.id)); if(cart.length!==n) changeCart();
  }catch{ grid.innerHTML = location.protocol==="file:" ? '<div class="empty-cart" style="grid-column:1/-1;padding:40px 0">⚠️<b>Produk butuh server</b><small>Halaman ini dibuka langsung dari folder, jadi produk, paket, & banner belum bisa dimuat. Jalankan <code>node scripts/dev.js</code> lalu buka http://localhost:3000, atau upload ke Vercel.</small></div>' : '<div class="empty-cart" style="grid-column:1/-1;padding:40px 0">⚠️<b>Produk gagal dimuat</b><small>Muat ulang halaman.</small></div>'; }
}
loadProducts();

renderCart();
if (cart.length) refreshQuote();

window.toast = toast;
// Setelah pesanan dibuat, keranjang dikosongkan (pesanan tersimpan di "Pesanan Saya").
document.addEventListener("zs:ordercreated", () => { cart = []; coupon = ""; quote = null; saveCart(); renderCart(); });

/* ===================== DETAIL PRODUK ===================== */
(() => {
  const ov = $("#detailOverlay"), close = () => ov.classList.remove("open");
  $("#productGrid").addEventListener("click", e => {
    const b = e.target.closest(".sv-detail"); if (!b) return;
    const p = (window.ZS_LIST || []).find(x => x.id === b.dataset.detail); if (!p) return;
    $("#dtTitle").textContent = p.name;
    $("#dtPrice").textContent = money(p.price) + (p.stock != null ? " • " + (p.stock === 0 ? "Stok habis" : "Stok " + p.stock) : "");
    $("#dtDesc").textContent = p.desc || "";
    $("#dtBody").textContent = p.detail || "";
    $("#dtBuy").dataset.id = p.id;
    ov.classList.add("open");
  });
  $("#dtBuy").addEventListener("click", e => { const btn = document.querySelector(`.add-cart[data-id="${e.currentTarget.dataset.id}"]`); close(); if (btn) btn.click(); });
  $("#dtClose").addEventListener("click", close);
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();
