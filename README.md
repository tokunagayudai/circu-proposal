# circu-proposal-portal — 顧客向け 提案ポータル

株式会社サーキュレーション エンタープライズ部の、**顧客向け提案ポータル**です。
レビューMTG・商談で、顧客と画面を一緒に眺めながら使う道具として、テーマ・解決策・事例を提示します。

- **公開方法**：GitHub Pages（情シス確認済み・OK）
- **トップ**：`index.html`（セクション1〜5を1ページに、上部ナビで遷移）
- **データ**：`data.json`（テーマ・事例・カテゴリを一元管理）

---

## ⚠️ 情報管理ルール（最重要・厳守）

情シス確認済みの条件：**SF直接連携NG・顧客情報の流出NG。こちらで加工して情報が漏れないようにすればOK。**
これを厳守してください。

1. **SF（Salesforce）を直接連携させない。** 顧客情報・案件データのライブ連携は一切しない。
2. **顧客の社外秘情報を載せない。** 掲載は加工済み・公開可能なものに限る。
3. **公開URL（誰でもアクセス可）である前提。** 追加コンテンツも「顧客に見られて困らないか」を必ず確認してから載せる。
4. **社内向け情報を混在させない。** 社内戦略ポータル（circu-Enterprise-portal）の戦略・体制・個人分析・メンバー個人名・内部用語・戦略の内部ロジックは**一切載せない**。

> このリポジトリは **顧客提示専用**です。社内向けと絶対に混在させないでください。

---

## ディレクトリ構成

```
circu-proposal-portal/
├─ index.html      … トップページ（静的なガワ＋セクションナビ）
├─ styles.css      … デザイン（社内戦略ポータルと同じデザイン言語）
├─ app.js          … data.json を読み込んで各セクションを描画
├─ data.json       … ★テーマ・事例・カテゴリの一元管理（編集はここ）
├─ images/         … 事例キャプチャ等（alt属性必須）
└─ README.md
```

掲載コンテンツ（セクション）：

1. **直近ピックアップテーマ**（旬・推し）… `data.json` の `pickup:true` のテーマを表示
2. **部署 / テーマ別 活用カタログ**（網羅）… `data.json` の `categories` でカテゴリ別に表示
3. **解決策の型**（プロジェクト設計／体制図／使い方／テーマ・切り口）
4. **事例**（社名あり＝自社HP出典／匿名＝匿名化済みスライド）
5. **PKSHAグループ ケイパビリティ**（任意）

---

## 編集方法（追加は「データ1件」だけ）

`data.json` を編集すれば、`index.html` / `app.js` は触らずにコンテンツを増減できます。

### テーマを追加する（セクション1・2 共通）

**テーマは1箇所（`themes` 配列）で定義**します。
`pickup` フラグでセクション1（旬）に、`categories` でセクション2（網羅）に**自動で両方表示**されるため、二重管理は不要です。

`themes` に1件追加するだけ：

```json
{
  "id": "unique-id",                       // 重複しない英数字
  "title": "テーマ名",
  "angle": "切り口（短く）",
  "summary": "一言説明",
  "question": "顧客に投げる問い（例：社内でこういうこと起きてませんか？）",
  "categories": ["dx", "ai"],              // categories の id を複数指定可
  "pickup": true,                          // true でセクション1に表示
  "isNew": true,                           // true で NEW バッジ
  "updated": "2026-06-25"                  // 更新日（YYYY-MM-DD）
}
```

- **セクション1に出したい** → `pickup: true`。枚数は**3〜6枚**に絞る（旬さが伝わるように）。
- **セクション2にだけ出す** → `pickup: false` ＋ `categories` を指定。
- `isNew` / `updated` で「直近多い」感を演出。

### カテゴリを追加する（セクション2）

`categories` 配列に1件追加。**並び順がそのまま表示順・フィルタ順**になります。

```json
{ "id": "newcat", "name": "新カテゴリ名", "icon": "ti-xxx" }
```

`icon` は [Tabler Icons](https://tabler.io/icons) のクラス名（例 `ti-users`）。

### 解決策の型（セクション3）

`solutionTypes` 配列を編集（通常は4つ）。`points` は箇条書き。

### PKSHA（セクション5）

`pksha` 配列を編集。不要なら空配列 `[]` にすればセクションは空になります。

---

## 事例（セクション4）の扱い — 特に注意

### 社名あり事例（`casesNamed`）

- 出典は**自社HP事例ページのみ**：<https://circu.co.jp/pro-sharing/cases/>
- **掲載範囲はHP公開範囲に厳密に留め、HPにない情報を足さない。**
- キャプチャ画像は `images/` に格納し、**`alt` 属性を必ずつける**。
- 各キャプチャに**「出典：自社HP事例ページ」へのリンクを併記**（最新はHPで確認できるように。`sourceUrl` に設定済み）。

```json
{
  "title": "事例タイトル（HP掲載どおり）",
  "industry": "業界",
  "image": "images/case-xxxx.png",
  "alt": "自社HP事例ページのキャプチャ（事例タイトル）",
  "summary": "HP公開範囲の概要のみ",
  "sourceUrl": "https://circu.co.jp/pro-sharing/cases/",
  "sourceLabel": "出典：自社HP事例ページ"
}
```

> 現在 `images/case-sample-1〜3.svg` は**プレースホルダー**です。
> 実際のHPキャプチャ（PNG/JPG）を `images/` に置き、`data.json` の `image` をそのファイル名に差し替えてください。

### 匿名事例（`casesAnonymous`）

- 出典は**匿名化済みスライド**：[Googleスライド](https://docs.google.com/presentation/d/1v-PJuqFPB5HrDoIDDn4-7HmiI_5Jmqq3rWSdl4h8BxQ/edit)
- **掲載前に必ず「業界・規模・時期の組み合わせで個社が特定されないか」を確認。**
  特定リスクがある場合は粒度を粗くする（業界を大分類に／時期を年・四半期にぼかす 等）。

---

## 運用上の注意

- **キャプチャの貼り直し**：社名あり事例のキャプチャは、元HP更新時に齟齬が出ます。**定期的な貼り直しを前提**にしてください（最新はリンク先HPで確認できる導線になっています）。
- **追加は容易な構造**：新規テーマ・事例・カテゴリは `data.json` に1件追加するだけで増やせます。`index.html` / `app.js` は原則さわりません。
- **公開URL前提**：追加コンテンツは「顧客に見られて困らないか」を必ず確認してから載せること。

---

## ローカルでの確認方法

`app.js` は `data.json` を `fetch` するため、**ファイルを直接ブラウザで開く（file://）と動きません。**
簡易サーバ経由で開いてください：

```bash
cd circu-proposal-portal
python3 -m http.server 8000
# → ブラウザで http://localhost:8000/ を開く
```

GitHub Pages 上では通常どおり動作します。

---

## GitHub Pages 公開設定

このリポジトリの **Settings → Pages** で以下を設定：

- **Source**：`Deploy from a branch`
- **Branch**：`main`（または公開対象ブランチ） / フォルダ `/ (root)`

数分後、`https://<org-or-user>.github.io/circu-proposal-portal/` で公開されます。

> ルートに `index.html` を置いているため、追加のビルドは不要です。
> Jekyll の処理を無効化するため `.nojekyll` を同梱しています。

---

## デザイン（トンマナ）

社内戦略ポータルと同じデザイン言語に統一しています（`styles.css` の CSS変数）。

- フォント：**M PLUS Rounded 1c** ＋ **JetBrains Mono**
- アイコン：**Tabler Icons**（CDN: `@tabler/icons-webfont`）
- 背景：`linear-gradient(160deg,#e8f6ff,#d8eefb)`
- カード：白カード＋上端グラデバー（`#5599be → #0079c0`）
- CSS変数：`--blue:#0079c0` / `--blue-d:#003d5e` / `--blue-mid:#5599be` / `--blue-l:#e8f6ff` / `--moss:#0a6e8c` / `--orange:#ed7d31` / `--ink:#1a2a38`

顧客の前で投影する前提のため、文字大きめ・1画面1テーマ・スムーズなナビゲーション・レスポンシブ対応にしています。
**社内用語・内部情報・個人名・戦略の内部ロジックは一切出していません。**
