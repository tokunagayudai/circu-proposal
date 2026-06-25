/* =========================================================
   サーキュレーション 提案ポータル  app.js
   data.json を読み込み、各セクションを描画する。
   テーマ/事例/カテゴリの追加は data.json を編集するだけ（このファイルは原則さわらない）。
   ※ data.json を fetch するため、file:// で直接開くと動きません。
     GitHub Pages か、ローカルの簡易サーバ（例: python3 -m http.server）で開いてください。
   ========================================================= */

const $ = (sel, root = document) => root.querySelector(sel);

// HTMLエスケープ（データはチーム管理だが念のため）
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatDate(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : iso;
}

async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`data.json の読み込みに失敗しました (${res.status})`);
  return res.json();
}

/* ---------------- セクション1：ピックアップ ---------------- */
function renderPickup(themes) {
  const grid = $("#pickup-grid");
  const items = themes.filter((t) => t.pickup);
  if (!items.length) {
    grid.innerHTML = `<p class="empty-note">ピックアップテーマは未設定です。data.json で pickup:true を設定してください。</p>`;
    return;
  }
  grid.innerHTML = items.map((t) => `
    <article class="card pickup-card" id="theme-${esc(t.id)}">
      <div class="badges">
        ${t.isNew ? `<span class="badge badge-new">NEW</span>` : ""}
        ${t.updated ? `<span class="badge badge-date">更新 ${esc(formatDate(t.updated))}</span>` : ""}
      </div>
      <h3>${esc(t.title)}</h3>
      ${t.angle ? `<div class="angle"><i class="ti ti-arrow-badge-right"></i><span>${esc(t.angle)}</span></div>` : ""}
      <p class="summary">${esc(t.summary)}</p>
      ${t.question ? `<div class="question"><i class="ti ti-message-2-question"></i><span>${esc(t.question)}</span></div>` : ""}
    </article>
  `).join("");
}

/* ---------------- セクション2：カタログ（カテゴリ別） ---------------- */
let CURRENT_FILTER = "all";

function renderCatalog(data) {
  const { categories, themes } = data;

  // フィルタチップ（アンカージャンプ兼フィルタ）
  const bar = $("#filter-bar");
  bar.innerHTML =
    `<button class="chip active" data-cat="all"><i class="ti ti-layout-grid"></i>すべて</button>` +
    categories.map((c) =>
      `<button class="chip" data-cat="${esc(c.id)}"><i class="ti ${esc(c.icon)}"></i>${esc(c.name)}</button>`
    ).join("");

  // カテゴリブロック
  const wrap = $("#catalog-blocks");
  wrap.innerHTML = categories.map((c) => {
    const matched = themes.filter((t) => (t.categories || []).includes(c.id));
    if (!matched.length) return "";
    const cards = matched.map((t) => {
      const tagNames = (t.categories || [])
        .map((id) => (categories.find((cc) => cc.id === id) || {}).name)
        .filter(Boolean);
      return `
        <article class="card catalog-card">
          <h4>${esc(t.title)}</h4>
          ${t.angle ? `<div class="angle">${esc(t.angle)}</div>` : ""}
          <p class="summary">${esc(t.summary)}</p>
          <div class="tags">${tagNames.map((n) => `<span class="tag">${esc(n)}</span>`).join("")}</div>
        </article>`;
    }).join("");
    return `
      <div class="category-block" data-cat="${esc(c.id)}" id="cat-${esc(c.id)}">
        <div class="category-title">
          <i class="ti ${esc(c.icon)}"></i>
          <span>${esc(c.name)}</span>
          <span class="count">${matched.length} テーマ</span>
        </div>
        <div class="catalog-grid">${cards}</div>
      </div>`;
  }).join("");

  // チップの挙動：フィルタ＋該当領域へスクロール
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const cat = btn.dataset.cat;
    CURRENT_FILTER = cat;
    bar.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === btn));
    applyFilter(cat);
    if (cat !== "all") {
      const target = $(`#cat-${CSS.escape(cat)}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function applyFilter(cat) {
  document.querySelectorAll(".category-block").forEach((block) => {
    block.classList.toggle("hidden", cat !== "all" && block.dataset.cat !== cat);
  });
}

/* ---------------- セクション3：解決策の型 ---------------- */
function renderSolutions(items) {
  const grid = $("#solution-grid");
  grid.innerHTML = (items || []).map((s) => `
    <article class="card solution-card">
      <div class="icon-circle"><i class="ti ${esc(s.icon)}"></i></div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.desc)}</p>
      ${(s.points && s.points.length)
        ? `<ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    </article>
  `).join("");
}

/* ---------------- セクション4：事例 ---------------- */
function renderCases(data) {
  const named = data.casesNamed || [];
  const anon = data.casesAnonymous || [];

  $("#cases-named").innerHTML = named.map((c) => `
    <article class="card case-card">
      <img class="thumb" src="${esc(c.image)}" alt="${esc(c.alt)}" loading="lazy">
      <div class="body">
        ${c.industry ? `<div class="industry">${esc(c.industry)}</div>` : ""}
        <h4>${esc(c.title)}</h4>
        <p class="summary">${esc(c.summary)}</p>
        <div class="source">
          <i class="ti ti-external-link"></i>
          <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.sourceLabel || "出典：自社HP事例ページ")}</a>
        </div>
      </div>
    </article>
  `).join("");

  $("#cases-anon").innerHTML = anon.map((c) => `
    <article class="card case-card">
      <div class="body">
        ${c.industry ? `<div class="industry">${esc(c.industry)}</div>` : ""}
        <h4>${esc(c.title)}</h4>
        <div class="meta">
          ${c.scale ? `<span class="tag">${esc(c.scale)}</span>` : ""}
          ${c.period ? `<span class="tag">${esc(c.period)}</span>` : ""}
        </div>
        <p class="summary">${esc(c.summary)}</p>
        ${c.sourceNote ? `<div class="anon-note">${esc(c.sourceNote)}</div>` : ""}
      </div>
    </article>
  `).join("");
}

/* ---------------- セクション5：PKSHA ---------------- */
function renderPksha(items) {
  const grid = $("#pksha-grid");
  grid.innerHTML = (items || []).map((p) => `
    <article class="card pksha-card">
      <i class="ti ${esc(p.icon)} lead"></i>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
    </article>
  `).join("");
}

/* ---------------- 起動 ---------------- */
(async function init() {
  try {
    const data = await loadData();
    if (data.meta) {
      if (data.meta.subtitle) $("#hero-subtitle").textContent = data.meta.subtitle;
      if (data.meta.lastUpdated) $("#hero-updated").textContent = `最終更新：${formatDate(data.meta.lastUpdated)}`;
    }
    renderPickup(data.themes || []);
    renderCatalog(data);
    renderSolutions(data.solutionTypes);
    renderCases(data);
    renderPksha(data.pksha);
  } catch (err) {
    console.error(err);
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<div class="section"><p class="empty-note">データの読み込みに失敗しました：${esc(err.message)}<br>
       ※このページは GitHub Pages 等のサーバ経由で開いてください（ファイルを直接開くと data.json を読めません）。</p></div>`);
  }
})();
