'use strict';
/**
 * KATALOG: produk dikelola admin lewat Admin Panel dan disimpan di Redis (zs:products).
 * Harga SELALU dihitung ulang di server; browser hanya mengirim id + jumlah.
 */
const { HttpError } = require('./core');
const store = require('./store');

/** Kode promo. percent = persen diskon; only = daftar id produk yang berlaku (null = semua). */
/** Batas akhir promo (WIB). Bisa diganti lewat env PROMO_END, mis. 2026-12-31T23:59:59+07:00. Dipakai SERVER (kode berhenti berlaku) & hitung mundur di web. */
const PROMO_END = Number.isFinite(Date.parse(process.env.PROMO_END || '')) ? Date.parse(process.env.PROMO_END) : Date.parse('2026-11-30T23:59:59+07:00');
const COUPONS = {
  ZAYY20: { percent: 20, label: 'Promo Launch 20%', only: null, until: PROMO_END },
};
const promoInfo = () => ({ code: 'ZAYY20', percent: 20, end: PROMO_END });

/** Produk bawaan — dimasukkan SEKALI saat toko pertama dibuka (setelah itu bebas diubah/dihapus lewat Admin Panel). */
const SERVER_MSG = 'Server kamu sedang disiapkan. Admin akan mengirim IP server & akses panel ke email kamu maksimal 15 menit.';
const DEFAULT_PRODUCTS = [
  { id: 'srv-1gb', name: 'Server Minecraft 1GB', price: 15000, desc: 'Java • Setup mudah • Cocok untuk 1–5 pemain', delivery: SERVER_MSG, needsUsername: false },
  { id: 'srv-2gb', name: 'Server Minecraft 2GB', price: 25000, desc: 'Untuk teman mabar • Plugin ringan • 5–15 pemain', delivery: SERVER_MSG, needsUsername: false },
  { id: 'srv-3gb', name: 'Server Minecraft 3GB', price: 35000, desc: 'Performa lebih lega • Plugin & mod • 15–30 pemain', delivery: SERVER_MSG, needsUsername: false },
  { id: 'bundle-server', name: 'Paket Bundling Server 1GB + 2GB + 3GB', price: 65000, desc: 'Paket hemat: tiga server sekaligus untuk survival, minigame, dan tes plugin.', bundle: ['srv-1gb', 'srv-2gb', 'srv-3gb'],
    delivery: 'Paket kamu berisi 3 server (1GB, 2GB & 3GB). Admin akan mengirim IP & akses panel semuanya ke email kamu maksimal 30 menit.', needsUsername: false },
];
/** Kontak admin untuk produk manual. Bisa diganti lewat env WA_NUMBER / DISCORD_INVITE. */
const CONTACT = { wa: String(process.env.WA_NUMBER || '6282267785229'), discord: process.env.DISCORD_INVITE || 'https://discord.gg/4TC5ugasU' };
const MIN_TOTAL = 1000; // batas minimum nominal transaksi (Rp)
const MAX_QTY = 10;
const DEFAULT_DELIVERY = 'Pesanan kamu sedang diproses admin. Detail akan dikirim ke email kamu secepatnya (maksimal 15 menit). Jika belum ada kabar, hubungi admin dengan menyebut ID pesanan.';

/** @returns {Promise<Object<string,{id,name,price,desc,delivery,needsUsername,img}>>} */
async function getProducts() {
  if (!store.enabled()) return {};
  let list = await store.getJson('zs:products');
  if (!list && !(await store.getJson('zs:seeded'))) {          // toko baru: isi produk bawaan sekali saja
    list = DEFAULT_PRODUCTS.map((x) => ({ ...x }));
    await store.setJson('zs:products', list, 0);
    await store.setJson('zs:seeded', 1, 0);
  }
  list = list || [];
  const st = await store.mget(list.map((p) => `zs:stock:${p.id}`));   // stok per produk (kosong = tanpa batas)
  list.forEach((p, i) => { if (st[i] !== null && st[i] !== undefined) p.stock = Number(st[i]); });
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

function priceCart(rawItems, couponCode, PRODUCTS, checkStock = false) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpError(400, 'Keranjang masih kosong.');
  if (rawItems.length > 30) throw new HttpError(400, 'Terlalu banyak item.');

  const merged = new Map();
  for (const it of rawItems) {
    const id = String(it && it.id || '');
    const qty = Number(it && it.qty);
    if (!PRODUCTS[id]) throw new HttpError(400, 'Ada produk yang sudah tidak tersedia. Muat ulang halaman.');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError(400, `Jumlah per produk maksimal ${MAX_QTY}.`);
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
  }

  const lines = [...merged].map(([id, qty]) => {
    const p = PRODUCTS[id];
    if (checkStock && p.stock != null) {
      if (p.stock <= 0) throw new HttpError(409, `Stok ${p.name} habis.`);
      if (qty > p.stock) throw new HttpError(409, `Stok ${p.name} tersisa ${p.stock}.`);
    }
    return { id, name: p.name, price: p.price, qty, total: p.price * qty, needsUsername: !!p.needsUsername };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  let discount = 0;
  let coupon = null;
  const code = String(couponCode || '').trim().toUpperCase();
  if (code) {
    const c = COUPONS[code];
    if (!c) throw new HttpError(400, 'Kode promo tidak valid.');
    if (c.until && Date.now() > c.until) throw new HttpError(400, 'Kode promo ini sudah berakhir.');
    const eligible = lines.filter((l) => !c.only || c.only.includes(l.id)).reduce((s, l) => s + l.total, 0);
    if (eligible <= 0) throw new HttpError(400, 'Kode promo tidak berlaku untuk produk di keranjang.');
    discount = Math.floor((eligible * c.percent) / 100);
    coupon = { code, label: c.label, percent: c.percent };
  }

  const total = subtotal - discount;
  if (total < MIN_TOTAL) throw new HttpError(400, `Total minimal transaksi Rp ${MIN_TOTAL.toLocaleString('id-ID')}.`);

  return { lines, subtotal, discount, total, coupon, needsUsername: lines.some((l) => l.needsUsername) };
}

module.exports = { CONTACT, promoInfo, DEFAULT_PRODUCTS, getProducts, priceCart, COUPONS, MAX_QTY, DEFAULT_DELIVERY };
