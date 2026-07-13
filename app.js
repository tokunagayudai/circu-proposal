/* =========================================================
   サーキュレーション 提案ポータル  app.js
   data.json を読み込み、各セクションを描画する。
   テーマ/事例/カテゴリの追加は data.json を編集するだけ（このファイルは原則さわらない）。
   ※ data.json を fetch するため、file:// で直接開くと動きません。
     GitHub Pages か、ローカルの簡易サーバ（例: python3 -m http.server）で開いてください。
   ========================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
let THEMES_BY_ID = {};
let CASES_BY_ID = {};
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

/* ---------------- 経営テーマ俯瞰マップ ---------------- */
/* 全社を横断する「変革テーマ」と、部門・機能ごとの「機能テーマ」に分けて一覧表示。
   タイルをクリックすると data-category 経由でテーマ詳細（課題・解決策・事例）が開く。 */
const TRANSFORM_CATS = new Set(["newbiz", "dx", "ai", "bpr"]);

function renderAgendaMap(categories) {
  const wrap = $("#agenda-map");
  if (!wrap) return;
  const bands = [
    { key: "transform", label: "全社・変革テーマ", sub: "事業全体を横断して変える", filter: (c) => TRANSFORM_CATS.has(c.id) },
    { key: "function", label: "部門・機能テーマ", sub: "部門・機能ごとに強化する", filter: (c) => !TRANSFORM_CATS.has(c.id) },
  ];
  const tile = (c) => `
    <button class="agenda-tile" data-category="${esc(c.id)}" aria-label="${esc(c.name)} の課題・解決策・事例を見る">
      <span class="at-ic"><i class="ti ${esc(c.icon)}"></i></span>
      <span class="at-body">
        <span class="at-name">${esc(c.name)}</span>
        ${c.tagline ? `<span class="at-tag">${esc(c.tagline)}</span>` : ""}
      </span>
    </button>`;
  wrap.innerHTML = `
    <div class="agenda-top"><i class="ti ti-building-skyscraper"></i>全社経営 / 事業成長</div>
    ${bands.map((b) => {
      const items = (categories || []).filter(b.filter);
      if (!items.length) return "";
      return `
        <div class="agenda-band agenda-${b.key}">
          <div class="agenda-band-head">
            <span class="ab-label">${b.label}</span>
            <span class="ab-sub">${b.sub}</span>
          </div>
          <div class="agenda-tiles">${items.map(tile).join("")}</div>
        </div>`;
    }).join("")}`;
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
    const kw = c.keywords || [];
    return `
      <div class="cat-acc" data-cat="${esc(c.id)}" id="cat-${esc(c.id)}">
        <button class="cat-acc-head" aria-expanded="false">
          <span class="cat-ic"><i class="ti ${esc(c.icon)}"></i></span>
          <span class="cat-meta">
            <span class="cat-name">${esc(c.name)}</span>
            ${c.tagline ? `<span class="cat-tagline">${esc(c.tagline)}</span>` : ""}
            ${kw.length ? `<span class="cat-keywords">${kw.map((k) => `<span class="kw">${esc(k)}</span>`).join("")}</span>` : ""}
          </span>
          <span class="cat-count">${ch.length}課題 / ${relCount}テーマ</span>
          <i class="ti ti-chevron-down chev"></i>
        </button>
        <div class="cat-acc-body" hidden>
          ${ch.length ? `<div class="cat-sub">よくある課題</div>
            <ul class="challenge-list">${ch.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          <button class="btn-detail" data-category="${esc(c.id)}">このテーマの課題・解決策・事例をまとめて見る<i class="ti ti-arrow-right"></i></button>
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
    ${(c.keywords || []).length ? `<div class="cat-keywords modal-keywords">${c.keywords.map((k) => `<span class="kw">${esc(k)}</span>`).join("")}</div>` : ""}
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
        <p class="modal-section-label"><i class="ti ti-briefcase"></i>プロ人材事例<span class="sec-count">${cases.length}件</span></p>
        <div class="procase-hero-list">${heroCasesFor(c, cases).map((p) => procaseHero(p, catId)).join("")}</div>
        <button class="btn-detail" data-viewall-cat="${esc(catId)}">この条件の事例をすべて見る（${cases.length}件）<i class="ti ti-arrow-right"></i></button>
      </div>` : ""}
  `;
  modal().hidden = false;
  document.body.classList.add("no-scroll");
}

/* カテゴリの代表事例（1〜2件）を選ぶ。heroCaseIds 指定を優先し、無ければ該当事例の先頭からフォールバック */
function heroCasesFor(category, casesInCategory) {
  const ids = category.heroCaseIds || [];
  const byId = casesInCategory.filter((p) => ids.includes(p.id));
  const ordered = ids.map((id) => byId.find((p) => p.id === id)).filter(Boolean);
  return ordered.length ? ordered : casesInCategory.slice(0, 2);
}

/* カテゴリ詳細モーダル内の代表事例：フルカードではなくタイトル＋役割のみのコンパクト表示 */
function procaseHero(p, fromCat) {
  return `
    <button class="procase-hero" data-case="${esc(p.id)}" data-from-cat="${esc(fromCat)}">
      <span class="ph-title">${esc(p.title)}</span>
      ${p.role ? `<span class="ph-role"><i class="ti ti-user-star"></i>${esc(p.role)}</span>` : ""}
      <i class="ti ti-chevron-right ph-arrow"></i>
    </button>`;
}

/* プロ人材アサイン体制例（切り口ごとに別々の図で描き分け） */
function renderAssign(items) {
  const grid = $("#assign-grid");
  if (!grid) return;
  const diagram = (a) => {
    switch (a.diagram) {
      case "lanes": return assignLanes(a);
      case "phase-pm": return assignPhasePm(a);
      case "cluster": return assignCluster(a);
      case "staffed": return assignStaffed(a);
      case "flow": return assignFlow(a);
      default: return assignTree(a);
    }
  };
  grid.innerHTML = (items || []).map((a) => `
    <article class="card assign-card">
      <div class="assign-head">
        <span class="assign-key">${esc(a.key)}</span>
        <span class="assign-sub">${esc(a.subtitle)}</span>
      </div>
      <div class="assign-diagram">${diagram(a)}</div>
      ${a.caption ? `<p class="assign-caption">${esc(a.caption)}</p>` : ""}
    </article>
  `).join("");
}

/* Issue型：プロジェクト全体の下に、課題（課単位）ごとの専任リーダーを並列レーンで配置 */
function assignLanes(a) {
  return `
    <div class="lanes">
      <div class="lanes-top">
        <span class="lt-title">${esc(a.hub || "プロジェクト全体")}</span>
        ${a.hubSub ? `<span class="lt-sub">${esc(a.hubSub)}</span>` : ""}
      </div>
      <div class="lanes-bus"></div>
      <div class="lanes-row">
        ${(a.items || []).map((it) => `
          <div class="lane">
            <span class="lane-head">${esc(it.label)}</span>
            <span class="lane-body">${esc(it.detail)}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

/* Role/Domain型：1つのプロジェクトを中心に、役割・領域を放射状に分担し同時推進 */
function assignCluster(a) {
  return `
    <div class="cluster">
      <div class="cluster-core">
        <span class="cc-title">${esc(a.hub || "1つのプロジェクト")}</span>
        ${a.hubSub ? `<span class="cc-sub">${esc(a.hubSub)}</span>` : ""}
      </div>
      <div class="cluster-grid">
        ${(a.items || []).map((it) => `
          <div class="cluster-chip">
            <span class="ch-label">${esc(it.label)}</span>
            <span class="ch-detail">${esc(it.detail)}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

/* Project型：1人のご担当者から複数案件がぶら下がり、各案件に専任プロ人材を配置 */
function assignStaffed(a) {
  return `
    <div class="staffed">
      <div class="staffed-owner">
        <i class="ti ti-user"></i>
        <span class="so-title">${esc(a.hub || "ご担当者さま")}</span>
        ${a.hubSub ? `<span class="so-sub">${esc(a.hubSub)}</span>` : ""}
      </div>
      <div class="staffed-rows">
        ${(a.items || []).map((it) => `
          <div class="staffed-row">
            <span class="sr-project">${esc(it.label)}</span>
            <i class="ti ti-arrow-right sr-arrow"></i>
            <span class="sr-pro"><i class="ti ti-user-star"></i>${esc(it.detail)}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

/* ハブ → 各役割をコネクタ線で接続したツリー型（予備） */
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

/* 上段PMが下段フェーズを束ねる傘型（ジャスト・イン・タイム） */
function assignPhasePm(a) {
  const steps = (a.items || []).map((it, i) => `
    ${i > 0 ? `<i class="ti ti-chevron-right phase-arrow"></i>` : ""}
    <div class="phase-step">
      <span class="ps-label">${esc(it.label)}</span>
      <span class="ps-detail">${esc(it.detail)}</span>
    </div>`).join("");
  return `
    <div class="pm-flow">
      <div class="pm-bar">
        <span class="pm-bar-title">${esc(a.hub || "プロジェクトPM")}</span>
        ${a.hubSub ? `<span class="pm-bar-sub">${esc(a.hubSub)}</span>` : ""}
      </div>
      <div class="pm-bus"></div>
      <div class="phase-flow pm-phases">${steps}</div>
    </div>`;
}

/* 左→右のフロー型（フェーズ進行・予備） */
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
let CASE_LIB = null; // 事例ライブラリの絞り込み操作を外部（カテゴリ詳細モーダル）から呼べるようにする

function renderCases(data) {
  $("#cases-named").innerHTML = (data.casesNamed || []).map((c) => {
    const onerr = c.imageFallback ? ` onerror="this.onerror=null;this.src='${esc(c.imageFallback)}'"` : "";
    return `
    <article class="card case-card">
      <img class="thumb" src="${esc(c.image)}" alt="${esc(c.alt)}" loading="lazy"${onerr}>
      <div class="body">
        ${c.industry ? `<div class="industry">${esc(c.industry)}</div>` : ""}
        <h4>${esc(c.title)}</h4>
        <p class="summary">${esc(c.summary)}</p>
        <div class="source">
          <i class="ti ti-external-link"></i>
          <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.sourceLabel || "出典：自社HP事例ページ")}</a>
        </div>
      </div>
    </article>`;
  }).join("");

  const stat = data.meta && data.meta.projectsStat;
  const statEl = $("#cases-stat");
  if (statEl) statEl.innerHTML = stat ? `<div class="stat-band"><i class="ti ti-chart-bar"></i><span>${esc(stat)}</span></div>` : "";

  setupCaseLibrary(data.categories || [], data.proCases || []);
}

function caseCardHtml(p) {
  const clickable = !!p.id;
  const scale = [p.industry, p.scale].filter(Boolean).join(" / ") || p.scale || "";
  return `
    <article class="card case-card${clickable ? " clickable" : ""}"${clickable ? ` data-case="${esc(p.id)}" role="button" tabindex="0"` : ""}>
      <div class="body">
        <div class="procase-top"><span class="procase-tag">${esc(p.tag)}</span></div>
        <div class="industry">${esc(scale)}</div>
        <h4>${esc(p.title)}</h4>
        <p class="summary">${esc(p.summary)}</p>
        ${p.role ? `<div class="procase-role"><i class="ti ti-user-star"></i>${esc(p.role)}</div>` : ""}
        ${clickable ? `<div class="card-cta">詳細を見る<i class="ti ti-arrow-right"></i></div>` : ""}
      </div>
    </article>`;
}

/* 事例ライブラリ：キーワード検索 ＋ カテゴリ複数選択の絞り込み UI と状態管理 */
function setupCaseLibrary(categories, cases) {
  const toolbar = $("#cases-toolbar");
  const results = $("#cases-anon");
  if (!toolbar || !results) return;

  const countByCat = {};
  categories.forEach((c) => { countByCat[c.id] = cases.filter((p) => (p.categories || []).includes(c.id)).length; });

  const state = { search: "", cats: new Set(parseCaseHash()) };

  toolbar.innerHTML = `
    <div class="case-lib-search">
      <i class="ti ti-search"></i>
      <input type="text" id="case-lib-search-input" placeholder="キーワードで検索（タイトル・要約・業界）" aria-label="事例ライブラリをキーワードで検索">
    </div>
    <div class="case-lib-chips">
      ${categories.map((c) => `
        <button type="button" class="chip case-lib-chip" data-cat="${esc(c.id)}">
          <i class="ti ${esc(c.icon)}"></i>${esc(c.name)}<span class="chip-count">${countByCat[c.id] || 0}</span>
        </button>`).join("")}
    </div>
    <div class="case-lib-status" id="case-lib-status" aria-live="polite"></div>
  `;

  const searchInput = $("#case-lib-search-input", toolbar);
  const statusEl = $("#case-lib-status", toolbar);

  function matches(p) {
    if (state.cats.size && !(p.categories || []).some((c) => state.cats.has(c))) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = [p.title, p.summary, p.industry].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function render() {
    const filtered = cases.filter(matches);
    statusEl.textContent = `${cases.length}件中${filtered.length}件を表示`;
    results.innerHTML = filtered.length ? filtered.map(caseCardHtml).join("")
      : `<p class="empty-note">条件に一致する事例がありません</p>`;
    toolbar.querySelectorAll(".case-lib-chip").forEach((btn) => {
      btn.classList.toggle("active", state.cats.has(btn.dataset.cat));
    });
  }

  function syncHash() {
    if (state.cats.size) {
      history.replaceState(null, "", `#cases?cat=${[...state.cats].map(encodeURIComponent).join(",")}`);
    } else if (/^#cases\?/.test(location.hash)) {
      history.replaceState(null, "", "#cases");
    }
  }

  searchInput.addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    render();
  });
  toolbar.addEventListener("click", (e) => {
    const chip = e.target.closest(".case-lib-chip");
    if (!chip) return;
    const cat = chip.dataset.cat;
    if (state.cats.has(cat)) state.cats.delete(cat); else state.cats.add(cat);
    render();
    syncHash();
  });

  CASE_LIB = {
    filterByCategory(catId) {
      state.cats = new Set([catId]);
      render();
      syncHash();
    },
  };

  render();
}

/* URL の #cases?cat=id1,id2 からカテゴリ絞り込みを読み取る（直接リンク用） */
function parseCaseHash() {
  const m = String(location.hash || "").match(/^#cases\?(.*)$/);
  if (!m) return [];
  const cat = new URLSearchParams(m[1]).get("cat");
  return cat ? cat.split(",").filter(Boolean) : [];
}

/* 「この条件の事例をすべて見る」→ 事例ライブラリまでスクロールし、該当カテゴリで絞り込む */
function goToCaseLibrary(catId) {
  if (CASE_LIB) CASE_LIB.filterByCategory(catId);
  const target = $("#case-library-head");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------- 支援事例 詳細モーダル（匿名） ---------------- */
function openCaseModal(caseId, fromCat) {
  const p = CASES_BY_ID[caseId];
  if (!p) return;
  const profile = [
    ["業界", p.industry], ["規模", p.scale], ["支援期間", p.period], ["支援工数", p.commitment],
  ].filter(([, v]) => v);

  $("#modal-body").innerHTML = `
    ${fromCat ? `<button class="modal-back" data-category="${esc(fromCat)}"><i class="ti ti-arrow-left"></i>テーマに戻る</button>` : ""}
    <div class="modal-eyebrow">Case / 支援事例（匿名）</div>
    <h2 class="modal-title" id="modal-title">${esc(p.title)}</h2>
    ${p.tag ? `<div class="case-tags"><span class="procase-tag">${esc(p.tag)}</span></div>` : ""}
    ${profile.length ? `
      <div class="case-profile">
        ${profile.map(([k, v]) => `<div class="cp-item"><span class="cp-k">${esc(k)}</span><span class="cp-v">${esc(v)}</span></div>`).join("")}
      </div>` : ""}
    ${p.process && p.process.length ? `
      <section class="ds-sec">
        <p class="ds-label"><i class="ti ti-route"></i>支援プロセス</p>
        <div class="case-steps">${p.process.map((s, i) => `${i > 0 ? `<i class="ti ti-chevron-right cs-arrow"></i>` : ""}<span class="cs-step"><span class="cs-n">${i + 1}</span><span class="cs-label">${esc(s)}</span></span>`).join("")}</div>
      </section>` : ""}
    ${(p.challenges && p.challenges.length) || (p.support && p.support.length) ? `
      <div class="case-cols">
        ${p.challenges && p.challenges.length ? `
          <section class="case-col problem">
            <p class="cc-h"><i class="ti ti-alert-triangle"></i>背景・課題</p>
            <ul>${p.challenges.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          </section>` : ""}
        ${p.support && p.support.length ? `
          <section class="case-col support">
            <p class="cc-h"><i class="ti ti-bulb"></i>支援内容（打ち手）</p>
            <ul>${p.support.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          </section>` : ""}
      </div>` : ""}
    ${p.roadmap && p.roadmap.length ? `
      <section class="ds-sec">
        <p class="ds-label"><i class="ti ti-flag"></i>取り組みロードマップ</p>
        <ol class="ms-timeline">
          ${p.roadmap.map((m) => `
            <li class="ms-item">
              <span class="ms-period">${esc(m.period || "")}</span>
              <div class="ms-main">
                <span class="ms-title">${esc(m.title || "")}</span>
                ${m.work ? `<span class="ms-work">${esc(m.work)}</span>` : ""}
                ${m.output ? `<span class="ms-output"><i class="ti ti-file-text"></i>${esc(m.output)}</span>` : ""}
              </div>
            </li>`).join("")}
        </ol>
      </section>` : ""}
    ${p.proRoles && p.proRoles.length ? `
      <section class="ds-sec">
        <p class="ds-label"><i class="ti ti-users"></i>プロ人材の役割</p>
        <div class="pro-profile">
          ${p.proRoles.map((r) => `
            <div class="pp-card">
              <span class="pp-role"><i class="ti ti-user-star"></i>${esc(r.role || "")}</span>
              ${r.mission ? `<span class="pp-mission">${esc(r.mission)}</span>` : ""}
            </div>`).join("")}
        </div>
      </section>` : (p.role ? `
      <div class="case-pro">
        <i class="ti ti-user-star"></i>
        <div><span class="cpro-k">参画したプロ人材</span><span class="cpro-v">${esc(p.role)}</span></div>
      </div>` : "")}
    <p class="modal-doc-note"><i class="ti ti-info-circle"></i>個社が特定されないよう加工した匿名事例です。</p>
  `;
  modal().hidden = false;
  document.body.classList.add("no-scroll");
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

  // マイルストーン（期間・やること・アウトプット）
  const milestones = (d.milestones && d.milestones.length) ? `
    <section class="ds-sec">
      <p class="ds-label"><i class="ti ti-flag"></i>マイルストーン</p>
      <ol class="ms-timeline">
        ${d.milestones.map((m) => `
          <li class="ms-item">
            <span class="ms-period">${esc(m.period || "")}</span>
            <div class="ms-main">
              <span class="ms-title">${esc(m.title || "")}</span>
              ${m.work ? `<span class="ms-work">${esc(m.work)}</span>` : ""}
              ${m.output ? `<span class="ms-output"><i class="ti ti-file-text"></i>${esc(m.output)}</span>` : ""}
            </div>
          </li>`).join("")}
      </ol>
    </section>` : "";

  // 参画するプロ人材像（役割・ミッション）
  const proProfile = (d.proProfile && d.proProfile.length) ? `
    <section class="ds-sec">
      <p class="ds-label"><i class="ti ti-users"></i>参画するプロ人材像</p>
      <div class="pro-profile">
        ${d.proProfile.map((p) => `
          <div class="pp-card">
            <span class="pp-role"><i class="ti ti-user-star"></i>${esc(p.role || "")}</span>
            ${p.mission ? `<span class="pp-mission">${esc(p.mission)}</span>` : ""}
          </div>`).join("")}
      </div>
    </section>` : "";

  // 主な成果物
  const deliverables = (d.deliverables && d.deliverables.length) ? `
    <section class="ds-sec">
      <p class="ds-label"><i class="ti ti-package"></i>主な成果物</p>
      <div class="deliverables">
        ${d.deliverables.map((x) => `<span class="dv-chip">${esc(x)}</span>`).join("")}
      </div>
    </section>` : "";

  $("#modal-body").innerHTML = `
    <div class="modal-eyebrow">Pick Up / 直近ピックアップテーマ</div>
    <h2 class="modal-title" id="modal-title">${esc(t.title)}</h2>
    ${docEmbedHtml(t)}
    ${d.lead ? `<p class="modal-lead">${esc(d.lead)}</p>` : ""}
    ${d.background ? `
      <section class="ds-sec ds-background">
        <p class="ds-label"><i class="ti ti-info-circle"></i>課題の背景</p>
        <p class="ds-text">${esc(d.background)}</p>
      </section>` : ""}
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
    ${d.flow && d.flow.length ? `<section class="ds-sec"><p class="ds-label"><i class="ti ti-route"></i>進め方</p>${renderFlow(d.flow, false)}</section>` : ""}
    ${milestones}
    ${proProfile}
    ${d.points && d.points.length ? `
      <section class="ds-sec">
        <p class="ds-label"><i class="ti ti-check"></i>このテーマのポイント</p>
        <ul class="modal-points">${d.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </section>` : ""}
    ${deliverables}
    ${d.outcome ? `
      <div class="modal-outcome">
        <i class="ti ti-target-arrow"></i><span>${esc(d.outcome)}</span>
      </div>` : ""}
    <div class="modal-actions">
      ${hasDoc
        ? `<a class="btn-secondary" href="${esc(t.doc.url)}" target="_blank" rel="noopener">
             <i class="ti ti-external-link"></i>新しいタブで開く
           </a>`
        : `<span class="empty-note">資料は準備中です。</span>`}
    </div>
    ${hasDoc ? `<p class="modal-doc-note"><i class="ti ti-download"></i>資料はダウンロードして社内でご活用いただけます。</p>` : ""}
  `;
  modal().hidden = false;
  document.body.classList.add("no-scroll");
}

function closeModal() {
  modal().hidden = true;
  document.body.classList.remove("no-scroll");
}

/* 資料URLをそのまま埋め込み表示できる形式に変換（Googleスライド／PDF／同梱HTMLページ） */
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

/* テーマ詳細モーダルの冒頭：資料があればその場で埋め込み表示し、無ければサムネイル画像にフォールバック */
function docEmbedHtml(t) {
  if (!(t.doc && t.doc.url)) return thumbImg(t, "modal-hero");
  const src = buildEmbedUrl(t.doc.url, t.doc.type || "slides");
  return `<div class="modal-hero-embed"><iframe src="${esc(src)}" title="${esc(t.title)} の資料" loading="lazy" allowfullscreen></iframe></div>`;
}

/* ---------------- イベント配線 ---------------- */
function wireEvents() {
  // カードクリック → モーダル
  document.addEventListener("click", (e) => {
    const viewAllBtn = e.target.closest("[data-viewall-cat]");
    if (viewAllBtn) { closeModal(); goToCaseLibrary(viewAllBtn.dataset.viewallCat); return; }
    const caseEl = e.target.closest("[data-case]");
    if (caseEl) { openCaseModal(caseEl.dataset.case, caseEl.dataset.fromCat); return; }
    const catBtn = e.target.closest("[data-category]");
    if (catBtn) { openCategoryModal(catBtn.dataset.category); return; }
    const card = e.target.closest("[data-theme]");
    if (card) { openModal(card.dataset.theme); return; }
    const accHead = e.target.closest(".cat-acc-head");
    if (accHead) {
      const acc = accHead.closest(".cat-acc");
      setAcc(acc, acc.querySelector(".cat-acc-body").hidden);
    }
  });
  // キーボード（Enter/Space）でカードを開く
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-case]")) {
      e.preventDefault();
      openCaseModal(e.target.dataset.case, e.target.dataset.fromCat);
    } else if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-theme]")) {
      e.preventDefault();
      openModal(e.target.dataset.theme);
    }
    if (e.key === "Escape" && !modal().hidden) closeModal();
  });
  // 閉じる
  $("#modal-close").addEventListener("click", closeModal);
  modal().addEventListener("click", (e) => { if (e.target === modal()) closeModal(); });
}

/* ---------------- 起動 ---------------- */
(async function init() {
  try {
    const data = await loadData();
    DATA = data;
    THEMES_BY_ID = Object.fromEntries((data.themes || []).map((t) => [t.id, t]));
    CASES_BY_ID = Object.fromEntries((data.proCases || []).filter((p) => p.id).map((p) => [p.id, p]));
    if (data.meta) {
      const hs = $("#hero-subtitle");
      if (hs && data.meta.subtitle) hs.textContent = data.meta.subtitle;
      const hu = $("#hero-updated");
      if (hu && data.meta.lastUpdated) hu.textContent = `最終更新：${formatDate(data.meta.lastUpdated)}`;
    }
    renderPickup(data.themes || []);
    renderAgendaMap(data.categories || []);
    renderCatalog(data);
    renderAssign(data.assignExamples);
    renderCases(data);
    renderPksha(data.pksha);
    wireEvents();
    if (/^#cases\?/.test(location.hash)) {
      const target = $("#case-library-head");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (err) {
    console.error(err);
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<div class="section"><p class="empty-note">データの読み込みに失敗しました：${esc(err.message)}<br>
       ※このページは GitHub Pages 等のサーバ経由で開いてください（ファイルを直接開くと data.json を読めません）。</p></div>`);
  }
})();
