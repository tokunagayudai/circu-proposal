/* =========================================================
   サーキュレーション 提案ポータル  app.js
   data.json を読み込み、各セクションを描画する。
   テーマ/事例/カテゴリの追加は data.json を編集するだけ（このファイルは原則さわらない）。
   ※ data.json を fetch するため、file:// で直接開くと動きません。
     GitHub Pages か、ローカルの簡易サーバ（例: python3 -m http.server）で開いてください。
   ========================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
let THEMES_BY_ID = {};

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

/* フロー図（3ステップ）を描画。mini=true でカード内の小型表示 */
function renderFlow(steps, mini) {
  if (!steps || !steps.length) return "";
  const cells = steps.map((s, i) => `
    ${i > 0 ? `<i class="ti ti-chevron-right arrow"></i>` : ""}
    <div class="step">
      <span class="num">STEP ${i + 1}</span>
      <span class="label">${esc(s)}</span>
    </div>`).join("");
  return `<div class="flow ${mini ? "flow-mini" : "flow-full"}">${cells}</div>`;
}

/* ---------------- セクション1：ピックアップ ---------------- */
function renderPickup(themes) {
  const grid = $("#pickup-grid");
  const items = themes.filter((t) => t.pickup);
  if (!items.length) {
    grid.innerHTML = `<p class="empty-note">ピックアップテーマは未設定です。data.json で pickup:true を設定してください。</p>`;
    return;
  }
  grid.innerHTML = items.map((t) => {
    const d = t.detail || {};
    const clickable = !!(t.detail || t.doc);
    return `
    <article class="card pickup-card" ${clickable ? `data-theme="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.title)} の詳細を開く"` : ""}>
      <div class="badges">
        ${t.isNew ? `<span class="badge badge-new">NEW</span>` : ""}
        ${t.updated ? `<span class="badge badge-date">更新 ${esc(formatDate(t.updated))}</span>` : ""}
      </div>
      <h3>${esc(t.title)}</h3>
      <p class="lead">${esc(d.lead || t.summary)}</p>
      ${renderFlow(d.flow, true)}
      ${clickable ? `<div class="card-cta">詳細・資料を見る<i class="ti ti-arrow-right"></i></div>` : ""}
    </article>`;
  }).join("");
}

/* ---------------- セクション2：カタログ（カテゴリ別） ---------------- */
function renderCatalog(data) {
  const { categories, themes } = data;

  const bar = $("#filter-bar");
  bar.innerHTML =
    `<button class="chip active" data-cat="all"><i class="ti ti-layout-grid"></i>すべて</button>` +
    categories.map((c) =>
      `<button class="chip" data-cat="${esc(c.id)}"><i class="ti ${esc(c.icon)}"></i>${esc(c.name)}</button>`
    ).join("");

  const wrap = $("#catalog-blocks");
  wrap.innerHTML = categories.map((c) => {
    const matched = themes.filter((t) => (t.categories || []).includes(c.id));
    if (!matched.length) return "";
    const cards = matched.map((t) => {
      const clickable = !!(t.detail || t.doc);
      const tagNames = (t.categories || [])
        .map((id) => (categories.find((cc) => cc.id === id) || {}).name)
        .filter(Boolean);
      return `
        <article class="card catalog-card ${clickable ? "clickable" : ""}"
          ${clickable ? `data-theme="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.title)} の詳細を開く"` : ""}>
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

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const cat = btn.dataset.cat;
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
  $("#solution-grid").innerHTML = (items || []).map((s) => `
    <article class="card solution-card">
      <div class="icon-box"><i class="ti ${esc(s.icon)}"></i></div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.desc)}</p>
      ${(s.points && s.points.length)
        ? `<ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    </article>
  `).join("");
}

/* ---------------- セクション4：事例 ---------------- */
function renderCases(data) {
  $("#cases-named").innerHTML = (data.casesNamed || []).map((c) => `
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

  $("#cases-anon").innerHTML = (data.casesAnonymous || []).map((c) => `
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
  $("#pksha-grid").innerHTML = (items || []).map((p) => `
    <article class="card pksha-card">
      <i class="ti ${esc(p.icon)} lead"></i>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
    </article>
  `).join("");
}

/* ---------------- テーマ詳細モーダル ---------------- */
const modal = () => $("#theme-modal");

function openModal(themeId) {
  const t = THEMES_BY_ID[themeId];
  if (!t) return;
  const d = t.detail || {};
  const hasDoc = t.doc && t.doc.url;

  $("#modal-body").innerHTML = `
    <div class="modal-eyebrow">Pick Up / 直近ピックアップテーマ</div>
    <h2 class="modal-title" id="modal-title">${esc(t.title)}</h2>
    ${d.lead ? `<p class="modal-lead">${esc(d.lead)}</p>` : ""}
    <div class="modal-grid">
      ${d.problem ? `
        <div class="modal-block problem">
          <h4><i class="ti ti-alert-triangle"></i>こんな課題に</h4>
          <p>${esc(d.problem)}</p>
        </div>` : ""}
      ${d.value ? `
        <div class="modal-block value">
          <h4><i class="ti ti-bulb"></i>提供価値</h4>
          <p>${esc(d.value)}</p>
        </div>` : ""}
    </div>
    ${d.flow && d.flow.length ? `<p class="modal-section-label">進め方</p>${renderFlow(d.flow, false)}` : ""}
    ${d.points && d.points.length
      ? `<ul class="modal-points">${d.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    ${d.outcome ? `
      <div class="modal-outcome">
        <i class="ti ti-target-arrow"></i><span>${esc(d.outcome)}</span>
      </div>` : ""}
    <div class="modal-actions">
      ${hasDoc
        ? `<button class="btn-primary" data-doc-url="${esc(t.doc.url)}" data-doc-type="${esc(t.doc.type || "slides")}" data-doc-title="${esc(t.title)}">
             <i class="ti ti-presentation"></i>資料を確認する
           </button>
           <a class="btn-secondary" href="${esc(t.doc.url)}" target="_blank" rel="noopener">
             <i class="ti ti-external-link"></i>新しいタブで開く
           </a>`
        : `<span class="empty-note">資料は準備中です。</span>`}
    </div>
  `;
  modal().hidden = false;
  document.body.classList.add("no-scroll");
}

function closeModal() {
  modal().hidden = true;
  if ($("#doc-viewer").hidden) document.body.classList.remove("no-scroll");
}

/* ---------------- 資料ビューア ---------------- */
function buildEmbedUrl(url, type) {
  if (type === "slides") {
    const m = String(url).match(/presentation\/d\/([^/]+)/);
    if (m) return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`;
  }
  if (type === "pdf") {
    const drive = String(url).match(/\/d\/([^/]+)/);
    if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
    return url;
  }
  return url;
}

function openDoc(url, type, title) {
  $("#doc-frame").src = buildEmbedUrl(url, type);
  $("#doc-open").href = url;
  $("#doc-title").textContent = title || "資料";
  $("#doc-viewer").hidden = false;
  document.body.classList.add("no-scroll");
}

function closeDoc() {
  $("#doc-viewer").hidden = true;
  $("#doc-frame").src = "about:blank";
  if (modal().hidden) document.body.classList.remove("no-scroll");
}

/* ---------------- イベント配線 ---------------- */
function wireEvents() {
  // カードクリック → モーダル
  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-theme]");
    if (card) { openModal(card.dataset.theme); return; }
    const docBtn = e.target.closest("[data-doc-url]");
    if (docBtn) { openDoc(docBtn.dataset.docUrl, docBtn.dataset.docType, docBtn.dataset.docTitle); }
  });
  // キーボード（Enter/Space）でカードを開く
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-theme]")) {
      e.preventDefault();
      openModal(e.target.dataset.theme);
    }
    if (e.key === "Escape") {
      if (!$("#doc-viewer").hidden) closeDoc();
      else if (!modal().hidden) closeModal();
    }
  });
  // 閉じる
  $("#modal-close").addEventListener("click", closeModal);
  modal().addEventListener("click", (e) => { if (e.target === modal()) closeModal(); });
  $("#doc-close").addEventListener("click", closeDoc);
}

/* ---------------- 起動 ---------------- */
(async function init() {
  try {
    const data = await loadData();
    THEMES_BY_ID = Object.fromEntries((data.themes || []).map((t) => [t.id, t]));
    if (data.meta) {
      if (data.meta.subtitle) $("#hero-subtitle").textContent = data.meta.subtitle;
      if (data.meta.lastUpdated) $("#hero-updated").textContent = `最終更新：${formatDate(data.meta.lastUpdated)}`;
    }
    renderPickup(data.themes || []);
    renderCatalog(data);
    renderSolutions(data.solutionTypes);
    renderCases(data);
    renderPksha(data.pksha);
    wireEvents();
  } catch (err) {
    console.error(err);
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<div class="section"><p class="empty-note">データの読み込みに失敗しました：${esc(err.message)}<br>
       ※このページは GitHub Pages 等のサーバ経由で開いてください（ファイルを直接開くと data.json を読めません）。</p></div>`);
  }
})();
