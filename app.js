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
/* 顧客が“自分の部署・役割”で探せるよう、組織ドメイン別に再編（誰の課題か軸） */
const AGENDA_GROUPS = [
  { key: "g1", label: "経営・成長戦略", sub: "経営層・経営企画｜攻めの全社テーマ",
    ids: ["midterm", "manda", "newbiz", "global", "esg"] },
  { key: "g2", label: "営業・マーケ・顧客・ブランド", sub: "事業部／マーケ・営業・CMO",
    ids: ["marketing", "sales", "retail", "cs", "branding", "pr"] },
  { key: "g3", label: "生産・購買・業務改革", sub: "製造・調達・オペレーション",
    ids: ["manufactur", "scm", "bpr"] },
  { key: "g4", label: "IT・DX・データ・セキュリティ", sub: "情シス・DX・CTO／CDO",
    ids: ["dx", "ai", "dev", "cloud", "datagov", "security"] },
  { key: "g5", label: "管理・ガバナンス（コーポレート）", sub: "人事・財務・法務・IR｜守りの基盤",
    ids: ["hr", "finance", "legal", "governance", "ir"] },
];

function renderAgendaMap(categories) {
  const wrap = $("#agenda-map");
  if (!wrap) return;
  const byId = {};
  (categories || []).forEach((c) => { byId[c.id] = c; });
  const used = new Set();
  const tile = (c) => `
    <button class="agenda-tile" data-category="${esc(c.id)}" aria-label="${esc(c.name)} の課題・解決策・事例を見る">
      <span class="at-ic"><i class="ti ${esc(c.icon)}"></i></span>
      <span class="at-body">
        <span class="at-name">${esc(c.name)}</span>
        ${c.tagline ? `<span class="at-tag">${esc(c.tagline)}</span>` : ""}
        ${(c.keywords || []).length ? `<span class="at-kws">${c.keywords.map((k) => `<span class="at-kw">${esc(k)}</span>`).join("")}</span>` : ""}
      </span>
    </button>`;
  const bands = AGENDA_GROUPS.map((b) => {
    const items = b.ids.map((id) => byId[id]).filter(Boolean);
    items.forEach((c) => used.add(c.id));
    return { ...b, items };
  });
  // 未分類カテゴリは末尾に「その他」でフォールバック表示（取りこぼし防止）
  const rest = (categories || []).filter((c) => !used.has(c.id));
  if (rest.length) bands.push({ key: "g6", label: "その他のテーマ", sub: "", items: rest });

  wrap.innerHTML = `
    <div class="agenda-top"><i class="ti ti-building-skyscraper"></i>全社経営 / 事業成長</div>
    ${bands.map((b) => {
      if (!b.items.length) return "";
      return `
        <div class="agenda-band agenda-${b.key}">
          <div class="agenda-band-head">
            <span class="ab-label">${b.label}</span>
            ${b.sub ? `<span class="ab-sub">${b.sub}</span>` : ""}
          </div>
          <div class="agenda-tiles">${b.items.map(tile).join("")}</div>
        </div>`;
    }).join("")}`;
}

/* ---------------- セクション2：テーマ検索（俯瞰マップのタイルを絞り込み） ---------------- */
function renderCatalog(data) {
  const input = $("#theme-search-input");
  if (!input) return;
  const idx = {};
  (data.categories || []).forEach((c) => {
    const cCases = (data.proCases || []).filter((p) => (p.categories || []).includes(c.id));
    idx[c.id] = [c.name, c.tagline, ...(c.keywords || []), ...(c.challenges || []),
      ...cCases.flatMap((p) => [p.title, p.summary, p.tag, p.industry])]
      .filter(Boolean).join(" ").toLowerCase();
  });
  const empty = $("#theme-empty");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll(".agenda-tile").forEach((t) => {
      const match = !q || (idx[t.dataset.category] || "").includes(q);
      t.classList.toggle("hidden", !match);
      if (match) visible++;
    });
    document.querySelectorAll(".agenda-band").forEach((b) => {
      b.classList.toggle("hidden", !b.querySelector(".agenda-tile:not(.hidden)"));
    });
    if (empty) empty.hidden = visible > 0;
  });
}

/* テーマ詳細ハブ：タブ（課題 / 解決策・プロ人材 / 支援事例）を切り替えて深掘り */
function openCategoryModal(catId) {
  const c = (DATA.categories || []).find((x) => x.id === catId);
  if (!c) return;
  const themes = (DATA.themes || []).filter((t) => (t.categories || []).includes(catId));
  const cases = (DATA.proCases || []).filter((p) => (p.categories || []).includes(catId));
  const ch = c.challenges || [];

  // タブ1：課題
  const challengesPanel = ch.length
    ? `<ul class="modal-points">${ch.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
    : `<p class="hub-note">ヒアリングの上で、課題を一緒に整理します。</p>`;

  // タブ2：解決策・プロ人材（参考プロ人材）
  const talents = c.proTalents || [];
  const talentBlock = talents.length ? `
    <p class="modal-section-label"><i class="ti ti-user-star"></i>参考プロ人材（匿名・例）</p>
    <div class="talent-list">
      ${talents.map((p) => `
        <div class="talent-item">
          <button class="talent-head" type="button" aria-expanded="false">
            <span class="talent-title"><i class="ti ti-user-star"></i>${esc(p.title)}</span>
            <i class="ti ti-chevron-down talent-chev"></i>
          </button>
          <div class="talent-body" hidden>
            <div class="talent-career"><span class="tc-lbl">経歴</span><span>${esc(p.career)}</span></div>
            <p class="talent-sum">${esc(p.summary)}</p>
          </div>
        </div>`).join("")}
    </div>` : "";
  const solutionPanel = talentBlock
    ? talentBlock
    : `<p class="hub-note">ご状況に合わせて最適なプロ人材を編成し、解決策を設計します。まずはご相談ください。</p>`;

  // タブ3：支援事例
  const casesPanel = cases.length
    ? `<div class="procase-hero-list">${cases.map((p) => procaseHero(p, catId)).join("")}</div>`
    : `<p class="hub-note">この切り口の匿名事例は準備中です。近い領域の事例をご案内できますので、お気軽にご相談ください。</p>`;

  $("#modal-body").innerHTML = `
    <div class="modal-eyebrow">Theme / 経営テーマ</div>
    <h2 class="modal-title" id="modal-title"><i class="ti ${esc(c.icon)}"></i> ${esc(c.name)}</h2>
    ${c.tagline ? `<p class="modal-lead">${esc(c.tagline)}</p>` : ""}
    ${(c.keywords || []).length ? `<div class="cat-keywords modal-keywords">${c.keywords.map((k) => `<span class="kw">${esc(k)}</span>`).join("")}</div>` : ""}
    <div class="hub-tabs" role="tablist">
      <button class="hub-tab active" data-tab="challenges"><i class="ti ti-alert-triangle"></i>課題</button>
      <button class="hub-tab" data-tab="solution"><i class="ti ti-bulb"></i>解決策・プロ人材</button>
      <button class="hub-tab" data-tab="cases"><i class="ti ti-briefcase"></i>支援事例${cases.length ? `<span class="tab-count">${cases.length}</span>` : ""}</button>
    </div>
    <div class="hub-panel" data-panel="challenges">${challengesPanel}</div>
    <div class="hub-panel" data-panel="solution" hidden>${solutionPanel}</div>
    <div class="hub-panel" data-panel="cases" hidden>${casesPanel}</div>
  `;
  modal().hidden = false;
  document.body.classList.add("no-scroll");
}

/* テーマハブ内の事例：タイトル＋役割のコンパクト表示（押すと詳細＋テーマに戻る） */
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
  grid.innerHTML = (items || []).map((a) => {
    const has = !!a.case;
    return `
    <article class="card assign-card${has ? " clickable" : ""}"${has ? ` data-assign="${esc(a.key)}" role="button" tabindex="0" aria-label="${esc(a.key)}型の匿名事例を開く"` : ""}>
      <div class="assign-head">
        <span class="assign-key">${esc(a.key)}</span>
        <span class="assign-sub">${esc(a.subtitle)}</span>
      </div>
      <div class="assign-diagram">${diagram(a)}</div>
      ${a.caption ? `<p class="assign-caption">${esc(a.caption)}</p>` : ""}
      ${has ? `<div class="card-cta assign-cta">アサイン体制事例を見る<i class="ti ti-arrow-right"></i></div>` : ""}
    </article>`;
  }).join("");
}

/* アサイン体制の匿名事例モーダル（Layer / プロファイル / KPI / 体制図 / 背景・取り組み） */
function openAssignCase(key) {
  const a = (DATA.assignExamples || []).find((x) => x.key === key);
  if (!a || !a.case) return;
  const cs = a.case;
  const profile = [["業界", cs.industry], ["部門", cs.dept]].filter(([, v]) => v);

  $("#modal-body").innerHTML = `
    <div class="modal-eyebrow">Case / アサイン体制の匿名事例</div>
    <h2 class="modal-title" id="modal-title">${cs.layer ? `<span class="case-layer">${esc(cs.layer)}</span>` : ""}${esc(cs.patternTitle || a.subtitle)}</h2>
    ${profile.length ? `
      <div class="case-profile">
        ${profile.map(([k, v]) => `<div class="cp-item"><span class="cp-k">${esc(k)}</span><span class="cp-v">${esc(v)}</span></div>`).join("")}
      </div>` : ""}
    ${cs.headline ? `<div class="case-headline"><i class="ti ti-quote"></i><span>${esc(cs.headline)}</span></div>` : ""}
    <section class="ds-sec">
      <p class="ds-label"><i class="ti ti-sitemap"></i>アサイン体制</p>
      <div class="assign-diagram assign-diagram-lg">${assignCaseDiagram(cs, a)}</div>
      ${a.caption ? `<p class="assign-caption">${esc(a.caption)}</p>` : ""}
    </section>
    ${cs.background ? `
      <section class="ds-sec ds-background">
        <p class="ds-label"><i class="ti ti-info-circle"></i>背景・課題</p>
        <p class="ds-text">${esc(cs.background)}</p>
      </section>` : ""}
    ${cs.approach && cs.approach.length ? `
      <section class="ds-sec">
        <p class="ds-label"><i class="ti ti-route"></i>取り組み</p>
        <ol class="case-approach">${cs.approach.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      </section>` : ""}
    ${cs.structureNotes && cs.structureNotes.length ? `
      <section class="ds-sec">
        <p class="ds-label"><i class="ti ti-users"></i>体制のポイント</p>
        <ul class="modal-points">${cs.structureNotes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </section>` : ""}
  `;
  modal().hidden = false;
  document.body.classList.add("no-scroll");
}

/* 事例モーダル内の体制図：case.diagram（無ければ親の diagram）で描き分け。'org' は専用の体制図 */
function assignCaseDiagram(cs, parent) {
  const kind = cs.diagram || parent.diagram;
  if (kind === "gantt") return assignGantt(cs.lanes, { hub: cs.hub || parent.hub, hubSub: cs.hubSub || parent.hubSub });
  if (kind === "org") return assignOrg(cs.org);
  const a = {
    hub: cs.hub || parent.hub,
    hubSub: cs.hubSub || parent.hubSub,
    items: cs.items || parent.items,
  };
  switch (kind) {
    case "lanes": return assignLanes(a);
    case "phase-pm": return assignPhasePm(a);
    case "cluster": return assignCluster(a);
    case "staffed": return assignStaffed(a);
    case "flow": return assignFlow(a);
    default: return assignTree(a);
  }
}

/* 体制図（org）：顧客の部長＋伴走PM（プロ）をヘッドに、テーマ別プロ→課長→メンバーを縦に並べる */
function assignOrg(org) {
  if (!org) return "";
  const node = (n, extra = "") => `
    <div class="co-node ${n.side === "pro" ? "co-pro" : "co-client"} ${extra}">
      <span class="co-role">${esc(n.role)}</span>
      ${n.tag ? `<span class="co-tag">${esc(n.tag)}</span>` : ""}
    </div>`;
  const legend = `
    <div class="co-legend">
      <span class="co-lg co-lg-client">顧客</span>
      <span class="co-lg co-lg-pro">サーキュレーションのプロ人材</span>
    </div>`;
  const head = (org.head || []).map((n, i) =>
    `${i > 0 ? `<i class="ti ti-arrows-left-right co-hlink"></i>` : ""}${node(n)}`).join("");
  const member = `<div class="co-node co-member"><span class="co-role">メンバー</span></div>`;
  const col = (c) => {
    const parts = [node({ role: c.pro, tag: c.tag, side: "pro" }, "co-pro-sm")];
    if (c.subPro) {
      // PMプロ人材の下を分岐：左＝課長（→メンバー）／右＝サブのプロ人材（PMO 等）
      const left = [node({ role: "課長", side: "client" }, "co-kacho")];
      if (c.member !== false) left.push(member);
      parts.push(`
        <div class="co-split">
          <div class="co-subcol">${left.join("")}</div>
          <div class="co-subcol">${node({ role: c.subPro.role, tag: c.subPro.tag, side: "pro" }, "co-pro-sm")}</div>
        </div>`);
    } else {
      if (c.kacho !== false) parts.push(node({ role: "課長", side: "client" }, "co-kacho"));
      if (c.member !== false) parts.push(member);
    }
    return `<div class="co-col${c.subPro ? " co-col-wide" : ""}">${parts.join("")}</div>`;
  };
  const cols = (org.cols || []).map(col).join("");
  return `
    <div class="case-org">
      ${legend}
      <div class="co-head">${head}</div>
      <div class="co-cols">${cols}</div>
    </div>`;
}

/* ガント型：一連の本流フェーズ（上段）＋ 途中から始まる別軸トラック（下段）を時間軸で揃えて描画 */
function assignGantt(lanes, hub) {
  if (!lanes) return "";
  const n = (lanes.cols || []).length;
  const hubHtml = hub && hub.hub ? `
    <div class="g-hub">
      <span class="g-hub-title"><i class="ti ti-shield-check"></i>${esc(hub.hub)}</span>
      ${hub.hubSub ? `<span class="g-hub-sub">${esc(hub.hubSub)}</span>` : ""}
    </div>` : "";
  const main = (lanes.main || []).map((m, i, arr) => `
    <div class="g-cell g-main${i < arr.length - 1 ? " has-arrow" : ""}" style="grid-row:1;grid-column:${i + 1}">
      <span class="g-step-n">STEP ${i + 1}</span>
      <span class="g-label">${esc(m.label)}</span>
      ${m.detail ? `<span class="g-detail">${esc(m.detail)}</span>` : ""}
    </div>`).join("");
  const tracks = (lanes.tracks || []).map((t, i) => `
    <div class="g-cell g-track" style="grid-row:${i + 2};grid-column:${t.start} / ${(t.end || n) + 1}">
      <span class="g-track-flag"><i class="ti ti-arrow-fork"></i>別軸で並行</span>
      <span class="g-label">${esc(t.label)}</span>
      ${t.detail ? `<span class="g-detail">${esc(t.detail)}</span>` : ""}
    </div>`).join("");
  return `
    <div class="gantt">
      ${hubHtml}
      <div class="g-bus"></div>
      <div class="g-grid" style="grid-template-columns:repeat(${n}, minmax(122px, 1fr))">
        ${main}${tracks}
      </div>
    </div>`;
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
      <div class="cluster-grid" style="grid-template-columns:repeat(${Math.max(1, (a.items || []).length)}, 1fr)">
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

/* ---------------- セクション4：事例（社名あり＋実績スタット） ---------------- */
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
}

/* ---------------- 支援事例 詳細モーダル（匿名） ---------------- */
function openCaseModal(caseId, fromCat) {
  const p = CASES_BY_ID[caseId];
  if (!p) return;
  const profile = [
    ["業界", p.industry], ["支援期間", p.period], ["支援工数", p.commitment],
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
        <p class="ds-label"><i class="ti ti-route"></i>取り組みロードマップ</p>
        <div class="rm-flow">
          ${p.roadmap.map((m, i) => `
            ${i > 0 ? `<i class="ti ti-chevron-right rm-arrow"></i>` : ""}
            <div class="rm-step">
              <span class="rm-period">${esc(m.period || "")}</span>
              <span class="rm-title">${esc(m.title || "")}</span>
              ${m.work ? `<span class="rm-work">${esc(m.work)}</span>` : ""}
              ${m.output ? `<span class="rm-output"><i class="ti ti-file-text"></i>${esc(m.output)}</span>` : ""}
            </div>`).join("")}
        </div>
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

/* テーマハブのタブ切り替え（課題 / 解決策・プロ人材 / 支援事例） */
function switchHubTab(tab) {
  const body = tab.closest(".modal-body");
  if (!body) return;
  body.querySelectorAll(".hub-tab").forEach((t) => t.classList.toggle("active", t === tab));
  body.querySelectorAll(".hub-panel").forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
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
    const tab = e.target.closest(".hub-tab");
    if (tab) { switchHubTab(tab); return; }
    const talentHead = e.target.closest(".talent-head");
    if (talentHead) {
      const item = talentHead.closest(".talent-item");
      const body = item.querySelector(".talent-body");
      const open = talentHead.getAttribute("aria-expanded") === "true";
      talentHead.setAttribute("aria-expanded", String(!open));
      body.hidden = open;
      item.classList.toggle("open", !open);
      return;
    }
    const assignEl = e.target.closest("[data-assign]");
    if (assignEl) { openAssignCase(assignEl.dataset.assign); return; }
    const caseEl = e.target.closest("[data-case]");
    if (caseEl) { openCaseModal(caseEl.dataset.case, caseEl.dataset.fromCat); return; }
    const catBtn = e.target.closest("[data-category]");
    if (catBtn) { openCategoryModal(catBtn.dataset.category); return; }
    const card = e.target.closest("[data-theme]");
    if (card) { openModal(card.dataset.theme); return; }
  });
  // キーボード（Enter/Space）でカードを開く
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-assign]")) {
      e.preventDefault();
      openAssignCase(e.target.dataset.assign);
    } else if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-case]")) {
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
  } catch (err) {
    console.error(err);
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<div class="section"><p class="empty-note">データの読み込みに失敗しました：${esc(err.message)}<br>
       ※このページは GitHub Pages 等のサーバ経由で開いてください（ファイルを直接開くと data.json を読めません）。</p></div>`);
  }
})();
