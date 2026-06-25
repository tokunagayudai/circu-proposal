/* =========================================================
   サーキュレーション 提案ポータル  app.js
   data.json を読み込み、各セクションを描画する。
   テーマ/事例/カテゴリの追加は data.json を編集するだけ（このファイルは原則さわらない）。
   ※ data.json を fetch するため、file:// で直接開くと動きません。
     GitHub Pages か、ローカルの簡易サーバ（例: python3 -m http.server）で開いてください。
   ========================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
let THEMES_BY_ID = {};
let DATA = {};

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

/* サムネイル画像のHTMLを生成。
   thumbnailShot（実スクショ：images/slide-*.png 等）があれば優先表示し、
   ファイルが無い／読み込み失敗時は thumbnail（自動生成SVG）に自動フォールバック。
   → 実スクショは images/ に置くだけで自動的に差し替わる（data.json の編集不要）。 */
function thumbImg(t, cls) {
  const shot = t.thumbnailShot;
  const svg = t.thumbnail;
  const src = shot || svg;
  if (!src) return "";
  const onerr = (shot && svg) ? ` onerror="this.onerror=null;this.src='${esc(svg)}'"` : "";
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(t.title)} のスライドイメージ" loading="lazy"${onerr}>`;
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
    const thumb = thumbImg(t, "pickup-thumb");
    return `
    <article class="card pickup-card${thumb ? " has-thumb" : ""}" ${clickable ? `data-theme="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.title)} の詳細を開く"` : ""}>
      ${thumb}
      <div class="pickup-body">
        <div class="badges">
          ${t.isNew ? `<span class="badge badge-new">NEW</span>` : ""}
          ${t.updated ? `<span class="badge badge-date">更新 ${esc(formatDate(t.updated))}</span>` : ""}
        </div>
        <h3>${esc(t.title)}</h3>
        <p class="lead">${esc(d.lead || t.summary)}</p>
        ${renderFlow(d.flow, true)}
        ${clickable ? `<div class="card-cta">詳細・資料を見る<i class="ti ti-arrow-right"></i></div>` : ""}
      </div>
    </article>`;
  }).join("");
}

/* ---------------- セクション2：カタログ（カテゴリ別アコーディオン） ---------------- */
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
    const relCount = themes.filter((t) => (t.categories || []).includes(c.id)).length;
    const ch = c.challenges || [];
    return `
      <div class="cat-acc" data-cat="${esc(c.id)}" id="cat-${esc(c.id)}">
        <button class="cat-acc-head" aria-expanded="false">
          <span class="cat-ic"><i class="ti ${esc(c.icon)}"></i></span>
          <span class="cat-meta">
            <span class="cat-name">${esc(c.name)}</span>
            ${c.tagline ? `<span class="cat-tagline">${esc(c.tagline)}</span>` : ""}
          </span>
          <span class="cat-count">${ch.length}課題 / ${relCount}テーマ</span>
          <i class="ti ti-chevron-down chev"></i>
        </button>
        <div class="cat-acc-body" hidden>
          ${ch.length ? `<div class="cat-sub">よくある課題</div>
            <ul class="challenge-list">${ch.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          <button class="btn-detail" data-category="${esc(c.id)}">詳細（課題・解決策・プロ人材事例）を見る<i class="ti ti-arrow-right"></i></button>
        </div>
      </div>`;
  }).join("");

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const cat = btn.dataset.cat;
    bar.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === btn));
    document.querySelectorAll(".cat-acc").forEach((acc) => {
      const match = cat === "all" || acc.dataset.cat === cat;
      acc.classList.toggle("hidden", !match);
      if (cat !== "all" && match) setAcc(acc, true);   // 単一カテゴリ選択時は自動で開く
    });
    if (cat !== "all") {
      const target = $(`#cat-${CSS.escape(cat)}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

/* アコーディオンの開閉 */
function setAcc(acc, open) {
  acc.querySelector(".cat-acc-head").setAttribute("aria-expanded", String(open));
  acc.querySelector(".cat-acc-body").hidden = !open;
  acc.classList.toggle("open", open);
}

/* カテゴリ詳細モーダル（課題一覧 / 解決策テーマ / プロ人材事例） */
function openCategoryModal(catId) {
  const c = (DATA.categories || []).find((x) => x.id === catId);
  if (!c) return;
  const themes = (DATA.themes || []).filter((t) => (t.categories || []).includes(catId));
  const cases = (DATA.proCases || []).filter((p) => (p.categories || []).includes(catId));
  const ch = c.challenges || [];

  $("#modal-body").innerHTML = `
    <div class="modal-eyebrow">Catalog / 部署・テーマ別</div>
    <h2 class="modal-title" id="modal-title"><i class="ti ${esc(c.icon)}"></i> ${esc(c.name)}</h2>
    ${c.tagline ? `<p class="modal-lead">${esc(c.tagline)}</p>` : ""}
    ${ch.length ? `
      <div class="cat-modal-sec">
        <p class="modal-section-label"><i class="ti ti-alert-triangle"></i>よくある課題</p>
        <ul class="modal-points">${ch.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>` : ""}
    ${themes.length ? `
      <div class="cat-modal-sec">
        <p class="modal-section-label"><i class="ti ti-bulb"></i>解決策テーマ</p>
        <div class="sol-list">
          ${themes.map((t) => `
            <button class="sol-row" data-theme="${esc(t.id)}">
              <span class="sol-row-main">
                <span class="sol-row-title">${esc(t.title)}</span>
                <span class="sol-row-sum">${esc(t.summary)}</span>
              </span>
              <i class="ti ti-chevron-right"></i>
            </button>`).join("")}
        </div>
      </div>` : ""}
    ${cases.length ? `
      <div class="cat-modal-sec">
        <p class="modal-section-label"><i class="ti ti-briefcase"></i>プロ人材事例</p>
        <div class="procase-list">${cases.map(procaseCard).join("")}</div>
      </div>` : ""}
  `;
  modal().hidden = false;
  document.body.classList.add("no-scroll");
}

function procaseCard(p) {
  return `
    <article class="procase">
      <div class="procase-top">
        <span class="procase-tag">${esc(p.tag)}</span>
        <span class="procase-scale">${esc(p.scale)}</span>
      </div>
      <h4>${esc(p.title)}</h4>
      <p>${esc(p.summary)}</p>
      ${p.role ? `<div class="procase-role"><i class="ti ti-user-star"></i>${esc(p.role)}</div>` : ""}
    </article>`;
}

/* ---------------- セクション3：課題解決の要素（放射図） ---------------- */
function renderElements(ps) {
  const wrap = $("#elements-diagram");
  if (!wrap || !ps) return;
  const els = ps.elements || [];
  const n = els.length;
  if (!n) { wrap.innerHTML = ""; return; }

  const cx = 360, cy = 235, rx = 250, ry = 150;
  let lines = "", nodes = "";
  els.forEach((label, i) => {
    const ang = (-90 + i * (360 / n)) * Math.PI / 180;
    const x = (cx + rx * Math.cos(ang)).toFixed(1);
    const y = (cy + ry * Math.sin(ang)).toFixed(1);
    lines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="el-line"/>`;
    nodes += `<g class="el-node">
      <ellipse cx="${x}" cy="${y}" rx="84" ry="44"></ellipse>
      <text x="${x}" y="${(parseFloat(y) + 5).toFixed(1)}">${esc(label)}</text>
    </g>`;
  });

  wrap.innerHTML = `
    <svg viewBox="0 0 720 470" class="el-svg" role="img" aria-label="${esc(ps.center || "プロジェクト成功要素")}と構成要素">
      ${lines}
      <g class="el-center">
        <ellipse cx="${cx}" cy="${cy}" rx="100" ry="62"></ellipse>
        <text x="${cx}" y="${cy + 6}">${esc(ps.center || "プロジェクト成功要素")}</text>
      </g>
      ${nodes}
    </svg>`;
}

/* プロ人材アサイン体制例（線で繋いだ体制図） */
function renderAssign(items) {
  const grid = $("#assign-grid");
  if (!grid) return;
  grid.innerHTML = (items || []).map((a) => `
    <article class="card assign-card">
      <div class="assign-head">
        <span class="assign-key">${esc(a.key)}</span>
        <span class="assign-sub">${esc(a.subtitle)}</span>
      </div>
      ${a.diagram === "flow" ? assignFlow(a) : assignTree(a)}
    </article>
  `).join("");
}

/* ハブ → 各役割をコネクタ線で接続したツリー型 */
function assignTree(a) {
  return `
    <div class="tree">
      <div class="tree-hub">
        <span class="th-title">${esc(a.hub || "")}</span>
        ${a.hubSub ? `<span class="th-sub">${esc(a.hubSub)}</span>` : ""}
      </div>
      <div class="tree-branch">
        ${(a.items || []).map((it) => `
          <div class="tree-child">
            <span class="tc-label">${esc(it.label)}</span>
            <span class="tc-detail">${esc(it.detail)}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

/* 左→右のフロー型（フェーズ進行） */
function assignFlow(a) {
  return `
    <div class="phase-flow">
      ${(a.items || []).map((it, i) => `
        ${i > 0 ? `<i class="ti ti-chevron-right phase-arrow"></i>` : ""}
        <div class="phase-step">
          <span class="ps-label">${esc(it.label)}</span>
          <span class="ps-detail">${esc(it.detail)}</span>
        </div>`).join("")}
    </div>`;
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

  const stat = data.meta && data.meta.projectsStat;
  $("#cases-anon").innerHTML =
    (stat ? `<div class="stat-band"><i class="ti ti-chart-bar"></i><span>${esc(stat)}</span></div>` : "") +
    (data.proCases || []).map((p) => `
      <article class="card case-card">
        <div class="body">
          <div class="procase-top"><span class="procase-tag">${esc(p.tag)}</span></div>
          <div class="industry">${esc(p.scale)}</div>
          <h4>${esc(p.title)}</h4>
          <p class="summary">${esc(p.summary)}</p>
          ${p.role ? `<div class="procase-role"><i class="ti ti-user-star"></i>${esc(p.role)}</div>` : ""}
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
    ${thumbImg(t, "modal-hero")}
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
    if (docBtn) { openDoc(docBtn.dataset.docUrl, docBtn.dataset.docType, docBtn.dataset.docTitle); return; }
    const catBtn = e.target.closest("[data-category]");
    if (catBtn) { openCategoryModal(catBtn.dataset.category); return; }
    const accHead = e.target.closest(".cat-acc-head");
    if (accHead) {
      const acc = accHead.closest(".cat-acc");
      setAcc(acc, acc.querySelector(".cat-acc-body").hidden);
    }
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
    DATA = data;
    THEMES_BY_ID = Object.fromEntries((data.themes || []).map((t) => [t.id, t]));
    if (data.meta) {
      if (data.meta.subtitle) $("#hero-subtitle").textContent = data.meta.subtitle;
      if (data.meta.lastUpdated) $("#hero-updated").textContent = `最終更新：${formatDate(data.meta.lastUpdated)}`;
    }
    renderPickup(data.themes || []);
    renderCatalog(data);
    renderElements(data.projectSuccess);
    renderAssign(data.assignExamples);
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
