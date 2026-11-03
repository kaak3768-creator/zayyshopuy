/* ZayyStore — efek "Neon Glass": aurora, scroll-progress, reveal, tilt kartu, spotlight kursor, riak tombol, percikan kursor, parallax hero.
   Murni tampilan; aman dimatikan (hapus <script> ini). Mati otomatis bila pengguna memilih "kurangi animasi". */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const d = document;
  const mk = (cls, html) => { const e = d.createElement("div"); e.className = cls; if (html) e.innerHTML = html; return e; };

  /* latar aurora + grid */
  if (!reduce) { d.body.prepend(mk("cl-grid")); d.body.prepend(mk("cl-aurora", "<i></i><i></i><i></i>")); }
  d.querySelector(".cl-grid,.cl-aurora")?.setAttribute("aria-hidden", "true");

  /* progress scroll */
  const bar = mk("cl-progress"); d.body.appendChild(bar);
  let tick = false;
  const onScroll = () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      const h = d.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
      const bg = d.querySelector(".sv-hero-bg");
      if (bg && !reduce && scrollY < 900) bg.style.translate = `0 ${scrollY * .16}px`;
      tick = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* reveal saat masuk layar (juga untuk produk yang dimuat belakangan) */
  const io = "IntersectionObserver" in window && !reduce ? new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: .12, rootMargin: "0px 0px -6% 0px" }) : null;
  const reveal = () => {
    d.querySelectorAll(".sv-head,.sv-card.product-card,.how-card,.newsletter,.sv-foot-grid>div").forEach((el, i) => {
      if (el.dataset.rv) return; el.dataset.rv = "1";
      if (!io) return;
      el.classList.add("cl-rv"); el.style.setProperty("--dl", ((i % 5) * .08).toFixed(2) + "s"); io.observe(el);
    });
  };
  reveal();
  const grid = d.getElementById("productGrid");
  if (grid) new MutationObserver(reveal).observe(grid, { childList: true });

  /* spotlight + tilt kartu (hanya mouse) */
  if (fine && !reduce) {
    d.addEventListener("pointermove", (e) => {
      const c = e.target.closest && e.target.closest(".sv-card.product-card"); if (!c) return;
      const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      c.style.setProperty("--mx", x + "px"); c.style.setProperty("--my", y + "px");
      c.style.setProperty("--ry", ((x / r.width - .5) * 9).toFixed(2) + "deg");
      c.style.setProperty("--rx", ((.5 - y / r.height) * 7).toFixed(2) + "deg");
    });
    d.addEventListener("pointerout", (e) => {
      const c = e.target.closest && e.target.closest(".sv-card.product-card");
      if (c && !c.contains(e.relatedTarget)) { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); }
    });
    /* percikan api mengikuti kursor */
    let last = 0;
    addEventListener("pointermove", (e) => {
      const t = performance.now(); if (t - last < 55) return; last = t;
      const s = mk("cl-spark"); s.style.left = e.clientX - 3 + "px"; s.style.top = e.clientY - 3 + "px";
      s.style.setProperty("--dx", (Math.random() * 40 - 20).toFixed(0) + "px"); s.style.setProperty("--dy", (Math.random() * 36 + 8).toFixed(0) + "px");
      d.body.appendChild(s); setTimeout(() => s.remove(), 820);
    }, { passive: true });
  }

  /* riak klik pada tombol */
  d.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".primary-btn,.login-btn,.sv-cta,.add-cart.sv-buy"); if (!b || reduce) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const rp = mk("cl-ripple"); rp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(rp); setTimeout(() => rp.remove(), 650);
  });
})();
