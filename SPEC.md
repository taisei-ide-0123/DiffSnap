# DiffSnap 技術仕様書 v1.0

**対象**: AIコーディングエージェント  
**更新日**: 2025-01-XX  
**プロジェクト期間**: 90日（MVP: 0-30日、Pro: 31-60日、安定化: 61-90日）

---

## 1. 製品概要

### 1.1 目的
閲覧中ページの画像を最短手数で収集し、再訪時に新規画像のみを抽出する差分監視機能を提供するChrome拡張機能。

### 1.2 コア価値命題
- **初回訪問**: 8種類の画像ソースから全画像を自動検出・収集
- **再訪問**: 差分台帳との比較で新規画像のみを抽出（Pro機能）
- **継続価値**: 検索可能な画像資産台帳を自動構築

### 1.3 性能目標（KPI）
- 100枚処理時間: P50 ≤10秒、P95 ≤15秒（検出→去重→ZIP完了）
- プレビュー初期表示: P50 ≤1秒
- 検出再現率: ≥95%（10サイト回帰テスト）
- 差分適用率: ≥30%/90日（Proユーザー）

### 1.4 事業目標
- Free→Pro転換率: ≥5%/30日
- 月実行回数中央値: ≥4回
- 90日継続率: ≥40%（Pro）

---

## 2. 技術制約

### 2.1 必須要件
- Manifest V3準拠
- 権限最小化原則（activeTab + 実行時host要求）
- 閲覧中ページのみ収集（バックグラウンド巡回禁止）
- ローカル処理優先（クラウド依存最小）
- MV3 Service Worker制約に対応（DOM API不可、永続化なし）

### 2.2 ブラウザ互換性
- Chrome 120+（主要ターゲット）
- Edge 120+（Chromiumベース、検証のみ）
- Brave（検証のみ）

### 2.3 ストレージ制約
- chrome.storage.sync: 10KB上限（設定データ）
- chrome.storage.session: 10MB上限（実行時状態）
- IndexedDB: 無制限（差分台帳、定期クリーンアップ実装）

---

## 3. アーキテクチャ設計

### 3.1 技術スタック

| レイヤー | 技術選定 | 理由 |
|---------|---------|------|
| ビルドツール | Vite 5.x | MV3対応、高速HMR、TypeScript統合 |
| 言語 | TypeScript 5.3+ | 型安全性、IDE支援 |
| UIフレームワーク | React 18 | 宣言的UI、拡張エコシステム |
| 状態管理 | Zustand 4.x | 軽量、Reactとの統合容易 |
| スタイリング | Tailwind CSS 3.x | ユーティリティファースト、ビルド時最適化 |
| アイコン | Lucide React | 軽量、ツリーシェイク対応 |
| IndexedDB | idb 8.x | Promise化、型安全 |
| ZIP生成 | JSZip 3.10 | 安定性、ブラウザ互換性 |
| ハッシュ | Web Crypto API | ネイティブ、高速 |
| テスト（単体） | Vitest | Vite統合、高速 |
| テスト（E2E） | Playwright | Chrome拡張対応 |
| Lint/Format | ESLint 9.x, Prettier | コード品質統一 |

### 3.2 モジュール構成

```
アーキテクチャレイヤー:

┌─────────────────────────────────────────────────┐
│ UI Layer (React)                                │
│ - Popup (プレビュー、進捗、差分表示)              │
│ - Settings (設定、テンプレート編集)              │
│ - Zustandストア (状態管理)                       │
└─────────────────────────────────────────────────┘
                    ↕ メッセージング
┌─────────────────────────────────────────────────┐
│ Background Layer (Service Worker)               │
│ - メッセージルーター                              │
│ - 収集オーケストレーター                          │
│ - 差分エンジン (IndexedDB管理)                   │
│ - ZIP生成                                        │
│ - ライセンス検証                                  │
└─────────────────────────────────────────────────┘
                    ↕ メッセージング
┌─────────────────────────────────────────────────┐
│ Content Layer (ページ側実行)                    │
│ - 画像検出エンジン (8種類対応)                   │
│ - 遅延読込トリガー (自動スクロール)              │
│ - メッセージブリッジ                              │
└─────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────┐
│ Shared Libraries                                │
│ - URL正規化・recordID生成                        │
│ - SHA-256ハッシュ                                │
│ - ファイル名テンプレート評価                      │
│ - 型定義                                         │
└─────────────────────────────────────────────────┘
```

### 3.3 通信フロー

```
ユーザー操作フロー:

1. ページ訪問
   → Content Script注入
   → 画像検出開始

2. ポップアップ開始
   → Popup表示
   → プレビュー描画 (1秒以内)

3. ダウンロード開始
   → Background: 並列fetch開始
   → ハッシュ計算・去重
   → (Proのみ) 差分台帳比較
   → ZIP生成
   → ダウンロードトリガー

4. 完了通知
   → UI更新
   → (失敗あれば) 再試行提案
```

---

## 4. データモデル設計

### 4.1 IndexedDB: DiffSnapDB

**データベース名**: `DiffSnapDB`  
**バージョン**: 1  
**ObjectStore**: `records`

#### レコード構造

```
DiffRecord {
  id: string                    // makeRecordId(url)の戻り値
                                // 形式: "${origin}${pathname}:${queryHash}"
  url: string                   // 完全URL（クエリ含む）
  origin: string                // https://example.com
  pathname: string              // /products/item
  queryHash: string             // SHA-256(sortedQueryString)の16桁
  domain: string                // example.com
  lastScanAt: number            // Date.now() タイムスタンプ
  images: ImageSnapshot[]       // 検出済み画像の配列
}

ImageSnapshot {
  hash: string                  // SHA-256（Blobコンテンツ）
  url: string                   // 取得に使用したURL（クエリ保持）
  width: number                 // 画像の自然幅
  height: number                // 画像の自然高
  alt?: string                  // altテキスト
  context?: string              // 周辺テキスト（50文字）
  firstSeenAt: number           // 初回検出時刻
}
```

#### インデックス

| インデックス名 | キー | 用途 |
|--------------|------|------|
| domain | domain | ドメイン別検索 |
| lastScanAt | lastScanAt | 古いレコード削除（90日以上） |

### 4.2 chrome.storage.sync: 設定データ

**ストレージキー**: `config`  
**サイズ制限**: 8KB（10KB上限の80%安全マージン）

```
UserConfig {
  tier: 'free' | 'pro'
  licenseKey?: string           // Pro購入時のライセンスキー
  namingTemplate: string        // デフォルト: "{date}-{domain}-{w}x{h}-{index}"
  domainProfiles: DomainProfile[]
  monthlyCount: number          // Free制限用カウンタ
  monthlyResetAt: number        // 次回リセット日時（Unixタイムスタンプ）
}

DomainProfile {
  domain: string                // "example.com"
  includePattern?: string       // 正規表現文字列（空なら全許可）
  excludePattern?: string       // 正規表現文字列（空なら除外なし）
  minWidth?: number             // 最小幅ピクセル（未指定なら0）
}
```

#### デフォルト値

```
DEFAULT_CONFIG = {
  tier: 'free',
  namingTemplate: '{date}-{domain}-{w}x{h}-{index}',
  domainProfiles: [],
  monthlyCount: 0,
  monthlyResetAt: now + 30日
}
```

### 4.3 chrome.storage.session: 実行時状態

**ストレージキー**: `runState_${tabId}`  
**揮発性**: タブクローズ時に自動削除

```
RunState {
  tabId: number
  status: 'idle' | 'detecting' | 'fetching' | 'zipping' | 'complete' | 'error'
  total: number                 // 検出画像総数
  completed: number             // fetch完了数
  failed: FailedImage[]         // 失敗リスト
  zipSize: number               // 累積ZIPサイズ（バイト）
}

FailedImage {
  url: string
  reason: 'CORS' | 'HTTP_ERROR' | 'TIMEOUT' | 'UNKNOWN'
}
```

### 4.4 内部通信メッセージ型

#### Content → Background

```
IMAGES_DETECTED {
  type: 'IMAGES_DETECTED'
  candidates: ImageCandidate[]
}

SCROLL_COMPLETE {
  type: 'SCROLL_COMPLETE'
}

SCROLL_TIMEOUT {
  type: 'SCROLL_TIMEOUT'
}

ImageCandidate {
  url: string                   // 正規化済みURL
  element: {
    tag: string                 // 'img' | 'canvas' | 'svg' | 'video' | 'div'
    alt?: string
    context?: string
  }
  dimensions: {
    width: number
    height: number
  }
}
```

#### Background → Popup

```
STATE_UPDATE {
  type: 'STATE_UPDATE'
  state: RunState
}

DIFF_RESULT {
  type: 'DIFF_RESULT'
  new: ImageSnapshot[]
  existing: ImageSnapshot[]
  isFirstVisit: boolean
}

ZIP_READY {
  type: 'ZIP_READY'
  downloadId: number
}
```

#### Popup → Background

```
START_COLLECTION {
  type: 'START_COLLECTION'
  tabId: number
  options: CollectionOptions
}

RETRY_FAILED {
  type: 'RETRY_FAILED'
  urls: string[]
}

CHECK_DIFF {
  type: 'CHECK_DIFF'
  url: string
}

CollectionOptions {
  enableScroll: boolean         // 自動スクロール有効化
  maxScrollDepth: number        // デフォルト20画面
  scrollTimeout: number         // デフォルト15000ms
}
```

---

## 5. コア機能仕様

### 5.1 画像検出エンジン（Content Script）

#### 5.1.1 検出対象（8種類）

| # | 検出対象 | セレクタ/方法 | 優先度 | 備考 |
|---|---------|-------------|--------|------|
| 1 | `<img>` | `document.querySelectorAll('img')` | 高 | src, currentSrc取得 |
| 2 | `<picture>` | `document.querySelectorAll('picture')` | 高 | source要素も走査 |
| 3 | srcset | img.srcset解析 | 高 | 最大解像度選択 |
| 4 | CSS background-image | `getComputedStyle(el).backgroundImage` | 中 | 全要素走査 |
| 5 | `<canvas>` | `canvas.toDataURL()` | 中 | CORS汚染時スキップ |
| 6 | SVG `<image>`, `<use>` | `querySelectorAll('svg image, svg use')` | 中 | href, xlink:href |
| 7 | `<video poster>` | `video[poster]` | 低 | poster属性 |
| 8 | CSS content | `getComputedStyle(el, '::before/::after').content` | 低 | url()抽出 |

#### 5.1.2 検出アルゴリズム

```
検出フロー:

1. DOM走査
   - 各種セレクタで要素抽出
   - URL正規化（相対→絶対）
   - 重複除外（Map使用、URLをキー）

2. メタデータ抽出
   - 要素タグ名
   - alt属性
   - 周辺コンテキスト（50文字）
   - 表示サイズ（naturalWidth/Height優先）

3. フィルタリング
   - data URLサイズチェック（10MB上限）
   - 無効URL除外
   - 不可視要素除外（オプション）

4. 結果送信
   - Background へ ImageCandidate[] 送信
```

#### 5.1.3 srcset解析仕様

```
srcset解析ロジック:

入力: "image-320w.jpg 320w, image-640w.jpg 640w, image-1280w.jpg 1280w"

処理:
1. カンマ区切りで分割
2. 各エントリを空白で分割 → [URL, descriptor]
3. descriptorが"Xw"の場合、X を幅として抽出
4. 幅の降順ソート
5. 最大解像度のURLを返す

出力: "image-1280w.jpg"
```

#### 5.1.4 CSS background-image抽出

```
CSS背景抽出ロジック:

1. 全要素に対して getComputedStyle(el).backgroundImage 取得
2. 値が 'none' ならスキップ
3. 正規表現で url() を抽出:
   /url\(['"]?([^'"()]+)['"]?\)/g
4. 複数背景対応（カンマ区切り）
5. 各URLを正規化して候補追加
```

### 5.2 遅延読込対応（自動スクロール）

#### 5.2.1 スクロール制御

```
自動スクロール仕様:

パラメータ:
- maxDepth: 20画面（デフォルト）
- scrollDelay: 500ms（スクロール後待機）
- timeout: 15000ms（合計制限）

アルゴリズム:
1. 現在のscrollHeight記録
2. window.scrollTo(0, scrollHeight) で最下部へ
3. scrollDelay分待機（新規コンテンツ読込）
4. 新しいscrollHeightと比較
   - 変化なし → 最下部到達、終了
   - 変化あり → depth++、継続
5. depth >= maxDepth または timeout超過で強制終了
6. スクロール完了後、画像再検出
7. window.scrollTo(0, 0) でトップ復帰
```

#### 5.2.2 無限スクロール検出

```
無限スクロール判定:

条件:
- 連続3回のスクロールでheight変化なし → 真の最下部
- 10回以上のスクロールでまだ変化 → 無限スクロールと判定

ユーザー通知:
- 上限到達時: 「20画面スクロール完了。続行しますか?」
- 手動継続オプション提供
```

### 5.3 URL正規化とレコードID生成

#### 5.3.1 URL正規化

```
normalizeUrl(rawUrl: string, baseUrl: string): string

目的: 相対URLを絶対URLに変換
ルール:
1. data URLはそのまま返す
2. new URL(rawUrl, baseUrl) で解決
3. クエリパラメータは保持（去重はハッシュで行う）
4. フラグメント（#）は削除
5. 無効URLは空文字列を返す

例:
normalizeUrl('../image.jpg', 'https://example.com/page/view')
→ 'https://example.com/image.jpg'

normalizeUrl('image.jpg?v=2', 'https://example.com/')
→ 'https://example.com/image.jpg?v=2'
```

#### 5.3.2 レコードID生成

```
makeRecordId(url: string): string

目的: 差分台帳の一意キー生成
形式: "${origin}${pathname}:${queryHash}"

queryHash生成:
1. URLSearchParamsでクエリパース
2. エントリを key でソート
3. 正規化された文字列を生成
4. SHA-256ハッシュの最初の16文字を使用

例:
makeRecordId('https://example.com/page?a=1&b=2')
→ 'https://example.com/page:abc123def4567890'

makeRecordId('https://example.com/page?b=2&a=1')
→ 'https://example.com/page:abc123def4567890' (同一)

makeRecordId('https://example.com/page?a=2&b=1')
→ 'https://example.com/page:fed098cba7654321' (異なる)
```

### 5.4 ハッシュ計算（SHA-256）

#### 5.4.1 コンテンツハッシュ

```
sha256(data: BufferSource | string): Promise<string>

入力:
- BufferSource: Blob, ArrayBuffer, TypedArray
- string: テキスト（UTF-8エンコード）

出力:
- 64文字の16進数文字列

用途:
- 画像コンテンツの去重
- クエリ文字列のハッシュ化

実装:
- crypto.subtle.digest('SHA-256', buffer)
- ネイティブAPI使用（高速）
```

#### 5.4.2 Blobハッシュ

```
hashBlob(blob: Blob): Promise<string>

処理:
1. blob.arrayBuffer() でバイナリ取得
2. sha256(buffer) を呼び出し
3. ハッシュ文字列を返す

用途:
- fetchした画像の去重判定
- 差分台帳への保存時
```

### 5.5 並列制御（Parallel Controller）

#### 5.5.1 制御仕様

```
並列制御パラメータ:

グローバル制限: 最大8並列
ドメイン別制限: 最大2並列/ドメイン

理由:
- グローバル: ブラウザのメモリ制約
- ドメイン別: レート制限回避、サーバー負荷分散

実装方式:
- Promiseベースのキュー管理
- ドメイン別カウンタ（Map使用）
- スロット空き待機（ポーリング 50ms）
```

#### 5.5.2 fetch仕様

```
画像fetch仕様:

設定:
- credentials: 'include'  // Cookie継承
- mode: 'cors'            // CORS許可
- timeout: 30000ms        // 30秒タイムアウト

処理フロー:
1. data URLの場合:
   - base64デコード
   - Blob生成
   - ハッシュ計算

2. 通常URLの場合:
   - fetch実行
   - response.ok チェック
   - blob取得
   - ハッシュ計算

3. エラーハンドリング:
   - AbortError → 'TIMEOUT'
   - CORS失敗 → 'CORS'
   - HTTP 4xx/5xx → 'HTTP_ERROR'
   - その他 → 'UNKNOWN'

4. 結果返却:
   - 成功: {candidate, blob, hash, contentType}
   - 失敗: {candidate, error}
```

### 5.6 差分エンジン

#### 5.6.1 差分計算アルゴリズム

```
computeDiff(url: string, currentImages: ImageSnapshot[]): Promise<DiffResult>

処理フロー:

1. レコードID生成
   recordId = makeRecordId(url)

2. IndexedDBから既存レコード取得
   record = db.get('records', recordId)

3. 初回訪問の場合:
   - 全画像を新規として台帳保存
   - return { new: currentImages, existing: [], isFirstVisit: true }

4. 再訪問の場合:
   - 既存ハッシュセット構築: Set(record.images.map(i => i.hash))
   - 新規画像抽出: currentImages.filter(i => !existingHashes.has(i.hash))
   - 既存画像抽出: currentImages.filter(i => existingHashes.has(i.hash))
   
5. 台帳更新:
   - 新規画像があれば追加: [...record.images, ...newImages]
   - なければ lastScanAt のみ更新

6. 結果返却:
   return { new, existing, isFirstVisit: false }
```

#### 5.6.2 台帳クリーンアップ

```
cleanupOldRecords(): Promise<number>

目的: 90日以上未参照のレコード削除
実行タイミング: Background起動時 + 毎日1回

処理:
1. threshold = now - 90日
2. lastScanAt インデックスでカーソル走査
3. record.lastScanAt < threshold なら削除
4. 削除件数を返却

注意:
- トランザクション内で実行
- 一度に1000件以上削除する場合は分割実行
```

### 5.7 ZIP生成

#### 5.7.1 ZIP仕様

```
ZIP生成パラメータ:

ライブラリ: JSZip 3.10
圧縮: DEFLATE, level 6
サイズ上限: 1GB（1024 * 1024 * 1024 bytes）

処理フロー:
1. 新規ZIPインスタンス作成
2. 各ファイルを追加:
   - ファイル名衝突チェック（deconflict）
   - 累積サイズチェック（1GB超過でエラー）
   - zip.file(name, blob)
3. generateAsync({ type: 'blob', compression: 'DEFLATE' })
4. Blob返却

エラー処理:
- ZIP_SIZE_LIMIT_EXCEEDED: 1GB超過
- 提案: 個別ダウンロードへフォールバック
```

#### 5.7.2 ダウンロード実行

```
download(blob: Blob, filename: string): Promise<void>

処理:
1. URL.createObjectURL(blob) でBlob URL生成
2. chrome.downloads.download({ url, filename, saveAs: true })
3. 60秒後に URL.revokeObjectURL(url) でメモリ解放

エラー処理:
- ダウンロード失敗時はユーザーに通知
- 再試行オプション提供
```

### 5.8 ファイル名生成

#### 5.8.1 テンプレート変数

| 変数 | 説明 | フォーマット | 例 |
|------|------|------------|-----|
| {date} | 日付 | YYYY-MM-DD | 2025-01-15 |
| {time} | 時刻 | HH-MM-SS | 14-30-45 |
| {domain} | ホスト名 | hostname | example.com |
| {path} | パス | スラッシュ→ハイフン | products-item |
| {w} | 幅 | ピクセル数 | 800 |
| {h} | 高さ | ピクセル数 | 600 |
| {alt} | altテキスト | サニタイズ済み50文字 | Product-Image |
| {index} | 連番 | 3桁ゼロ埋め | 001, 002... |

#### 5.8.2 プリセットテンプレート

```
プリセット5種:

1. default (デフォルト)
   {date}-{domain}-{w}x{h}-{index}
   例: 2025-01-15-example.com-800x600-001.jpg

2. simple (シンプル)
   {domain}-{index}
   例: example.com-001.jpg

3. detailed (詳細)
   {date}-{time}-{domain}-{path}-{w}x{h}-{index}
   例: 2025-01-15-14-30-45-example.com-products-item-800x600-001.jpg

4. dimension (サイズ優先)
   {w}x{h}-{domain}-{index}
   例: 800x600-example.com-001.jpg

5. alt (alt優先)
   {alt}-{w}x{h}-{index}
   例: Product-Image-800x600-001.jpg
```

#### 5.8.3 サニタイズルール

```
ファイル名サニタイズ:

禁止文字の置換:
- < > : " / \ | ? * → すべて "-" に置換
- 制御文字 (0x00-0x1F) → "-" に置換
- 連続空白 → 単一ハイフン
- 長さ制限: 50文字（拡張子除く）

拡張子推測:
1. data URLの場合: MIMEタイプから判定
2. 通常URLの場合: パスから拡張子抽出
3. 判定不可の場合: .jpg をデフォルト
```

#### 5.8.4 衝突回避

```
deconflict(name: string, existing: Set<string>): string

ロジック:
1. existing に name が存在しなければそのまま返す
2. 存在する場合:
   - base と ext に分割（最後の . で）
   - counter = 1 から開始
   - "${base}-${counter}.${ext}" を生成
   - existing にない名前が見つかるまで counter++
3. 衝突しない名前を返す

例:
existing = ['image.jpg', 'image-1.jpg']
deconflict('image.jpg', existing) → 'image-2.jpg'
```

### 5.9 ライセンス検証（Pro機能）

#### 5.9.1 検証フロー

```
checkTier(): Promise<'free' | 'pro'>

処理:
1. chrome.storage.sync から licenseKey 取得
2. キーが存在しない → 'free' 返却
3. キーが存在する場合:
   - APIエンドポイントにPOST
   - { key: licenseKey } を送信
   - レスポンス: { tier, expiresAt }
4. グレース期間チェック:
   - graceEndTime = expiresAt + 72時間
   - now > graceEndTime → 'free' 返却
   - それ以外 → tier 返却
5. エラー時: 'free' 返却（フェイルセーフ）

APIエンドポイント:
POST https://api.diffsnap.io/v1/verify
Content-Type: application/json
Body: { "key": "license-key-string" }

レスポンス:
{
  "tier": "pro",
  "expiresAt": 1704067200000,  // Unix timestamp
  "email": "user@example.com"
}
```

#### 5.9.2 Free制限チェック

```
checkFreeLimit(imageCount: number): Promise<boolean>

制限: 月500枚

処理:
1. chrome.storage.sync から monthlyCount, monthlyResetAt 取得
2. now > monthlyResetAt の場合:
   - monthlyCount = 0 にリセット
   - monthlyResetAt = now + 30日 に更新
3. newCount = monthlyCount + imageCount 計算
4. newCount > 500 の場合:
   - false 返却（制限超過）
5. それ以外:
   - monthlyCount = newCount に更新
   - true 返却
```

#### 5.9.3 アップグレード導線

```
アップグレード表示タイミング:

1. 差分検出時（Free Tier）
   - 新規画像が見つかった場合
   - 「Pro機能」バッジ表示
   - 「新規X枚のみダウンロード可能」訴求

2. 500枚到達時
   - モーダル表示
   - 「今月の上限に到達しました」
   - スキップ可能、次回も表示

3. 初回実行時（任意）
   - 14日間Proトライアル提案
   - 「差分機能を試してみませんか?」
```

---

## 6. UI/UX仕様

### 6.1 Popup UI（拡張ポップアップ）

#### 6.1.1 レイアウト仕様

```
サイズ: 幅384px × 高さ600px

構成:
┌─────────────────────────────┐
│ Header                       │
│ - ロゴ + タイトル             │
│ - 検出画像数表示              │
│ - (Pro) Tier バッジ          │
├─────────────────────────────┤
│ Main Content (動的)          │
│                              │
│ [idle] プレビューグリッド     │
│ [processing] 進捗バー         │
│ [complete] 差分表示           │
│                              │
│ (スクロール可能)              │
├─────────────────────────────┤
│ Footer                       │
│ - アクションボタン            │
│ - 設定リンク                  │
└─────────────────────────────┘
```

#### 6.1.2 状態遷移

```
状態マシン:

idle (初期状態)
  → ユーザー: "Download All" クリック
  → detecting

detecting (画像検出中)
  → 自動: 検出完了
  → fetching

fetching (画像取得中)
  → 自動: 全fetch完了
  → zipping

zipping (ZIP生成中)
  → 自動: ZIP完了
  → complete

complete (完了)
  → ユーザー: "Close" or 再実行
  → idle

error (エラー)
  → ユーザー: "Retry" or "Close"
  → idle or fetching
```

#### 6.1.3 プレビューグリッド

```
グリッド仕様:

レイアウト: 3列 × N行
アスペクト比: 1:1 (正方形)
最大表示: 100枚（それ以上は仮想スクロール）
遅延読込: IntersectionObserver使用

各カード:
- サムネイル画像（object-fit: cover）
- オーバーレイ情報（hover時）:
  - サイズ表示（WxH）
  - altテキスト（存在する場合）
- (Pro) 新規バッジ（差分検出時）
```

#### 6.1.4 進捗表示

```
進捗UI要素:

1. プログレスバー
   - 幅: 100%
   - 高さ: 8px
   - 色: Blue (#3B82F6)
   - アニメーション: スムーズ遷移（transition: 0.3s）

2. テキスト情報
   - ステータス: "Detecting images..." / "Fetching..." / "Creating ZIP..."
   - カウンタ: "42 / 100"
   - パーセンテージ: "42%"

3. 失敗リスト（エラー時のみ）
   - 最大高さ: 128px（スクロール可能）
   - 各エラー: URL（50文字） + 理由
   - 再試行ボタン
```

#### 6.1.5 差分表示（Pro機能）

```
差分UI:

Free Tier:
- 新規画像数を表示
- 「Proにアップグレード」バナー
- 全画像ダウンロード（差分抽出なし）

Pro Tier:
- 2列表示:
  - 左: 新規画像（緑枠、NEWバッジ）
  - 右: 既存画像（グレーアウト、EXISTINGラベル）
- 統計情報:
  - "X new images found"
  - "Y existing images"
- アクション:
  - 「Download New Only」（新規のみ）
  - 「Download All」（全画像）
```

### 6.2 Settings UI（設定ページ）

#### 6.2.1 設定項目

```
設定セクション:

1. Account（アカウント）
   - Tier表示: Free or Pro
   - License Key入力欄（Pro）
   - "Upgrade to Pro" ボタン（Free）

2. Naming Template（命名テンプレート）
   - プリセット選択（5種類）
   - カスタムテンプレート入力
   - プレビュー表示（リアルタイム）
   - 変数リファレンス

3. Domain Profiles（ドメインプロファイル）
   - プロファイルリスト
   - 追加/編集/削除ボタン
   - 各プロファイル:
     - Domain
     - Include Pattern (正規表現)
     - Exclude Pattern (正規表現)
     - Min Width (ピクセル)

4. Advanced（詳細設定）
   - 自動スクロール有効/無効
   - 最大スクロール深度
   - タイムアウト設定
   - データクリーンアップ（手動実行）
```

#### 6.2.2 テンプレートプレビュー

```
プレビュー機能:

入力: テンプレート文字列
出力: サンプルファイル名（3例）

サンプルデータ:
- date: 今日の日付
- domain: example.com
- w: 800, h: 600
- alt: Sample Image
- index: 001, 002, 003

リアルタイム更新:
- 入力のたびにデバウンス（300ms）
- 無効な変数は赤字表示
```

#### 6.2.3 ドメインプロファイル編集

```
プロファイル編集UI:

モーダルダイアログ:
┌────────────────────────────┐
│ Edit Domain Profile         │
├────────────────────────────┤
│ Domain: [example.com      ] │
│                             │
│ Include Pattern (regex):    │
│ [/products/.*              ]│
│                             │
│ Exclude Pattern (regex):    │
│ [.*thumbnail.*             ]│
│                             │
│ Min Width (px):             │
│ [800                       ]│
│                             │
│ [Test Pattern] [Cancel] [Save]│
└────────────────────────────┘

正規表現テスト機能:
- サンプルURL入力
- マッチ/非マッチを即座表示
```

### 6.3 アクセシビリティ

```
アクセシビリティ要件:

1. キーボード操作
   - Tab順序: 論理的な順序
   - Enter/Space: ボタン実行
   - Esc: モーダルクローズ

2. スクリーンリーダー
   - aria-label: すべての画像・ボタン
   - aria-live: 進捗状態の変化
   - role属性: 意味的マークアップ

3. コントラスト
   - テキスト: WCAG AA準拠（4.5:1以上）
   - インタラクティブ要素: 3:1以上

4. フォーカス表示
   - outline: 明確な視覚的フィードバック
   - focus-visible: キーボード操作時のみ表示
```

---

## 7. テスト要件

### 7.1 単体テスト（Vitest）

#### 7.1.1 テスト対象モジュール

```
必須カバレッジ: 80%以上

テスト対象:
1. lib/url-utils.ts
   - normalizeUrl: 相対URL解決、data URL、無効URL
   - makeRecordId: 一貫性、クエリ順序独立性
   - hashQueryString: 同一パラメータセット

2. lib/hasher.ts
   - sha256: 文字列、バイナリ
   - hashBlob: Blob入力

3. lib/filename.ts
   - makeFilename: 全変数評価、サニタイズ
   - deconflict: 衝突回避ロジック
   - PRESET_TEMPLATES: 各プリセット

4. content/detector.ts
   - detectImages: モックDOM使用
   - extractSrcset: 解像度ソート
   - 各検出関数の個別テスト

5. background/diff-engine.ts
   - computeDiff: 初回/再訪、新規/既存分離
   - cleanupOldRecords: 削除件数
```

#### 7.1.2 モックとフィクスチャ

```
モック対象:

1. chrome API
   - chrome.storage.sync.get/set
   - chrome.storage.session.get/set
   - chrome.runtime.sendMessage
   - chrome.downloads.download

2. IndexedDB
   - idb ライブラリのモック
   - インメモリDB使用

3. DOM（detector用）
   - JSDOM使用
   - サンプルHTML作成

フィクスチャデータ:
- tests/fixtures/sample-pages/ に配置
- Amazon, Unsplash等の簡易HTML
```

### 7.2 E2Eテスト（Playwright）

#### 7.2.1 テストサイト（10種類）

| # | サイト種別 | URL | 検証内容 | 期待枚数 |
|---|----------|-----|---------|---------|
| 1 | EC | amazon.com/dp/XXX | 商品画像、srcset | ≥30 |
| 2 | ギャラリー | unsplash.com/s/photos/nature | 無限スクロール | ≥50 |
| 3 | SPA | twitter.com/user | 動的DOM更新 | ≥20 |
| 4 | ドキュメント | notion.so/page | 埋込画像、Canvas | ≥15 |
| 5 | ニュース | cnn.com/article | CSS background | ≥20 |
| 6 | Wiki | wikipedia.org/article | SVG、多言語alt | ≥10 |
| 7 | デザイン | dribbble.com/shots | 高DPI画像 | ≥25 |
| 8 | 動画 | youtube.com/watch | poster抽出 | ≥5 |
| 9 | 管理画面 | dashboard.stripe.com | 認証Cookie | ≥8 |
| 10 | CSP厳格 | github.com/repo | フォールバック | ≥10 |

#### 7.2.2 テストシナリオ

```
基本収集シナリオ:

1. ページ訪問
2. 拡張ポップアップ開く
3. プレビュー表示確認（1秒以内）
4. 画像枚数確認（期待値以上）
5. "Download All" クリック
6. 進捗バー表示確認
7. ダウンロード完了確認（15秒以内）
8. ZIPファイル名検証

差分検出シナリオ（Pro）:

1. Proライセンス設定
2. 初回訪問→全画像ダウンロード
3. ページ変更（新規画像追加）
4. 再訪問
5. 差分UI表示確認
6. 新規バッジ確認
7. "Download New Only" クリック
8. 新規画像のみZIP確認

エラーハンドリングシナリオ:

1. CORS失敗時の表示
2. タイムアウト時の再試行
3. 1GB超過時のエラー
4. 個別ダウンロード提案
```

### 7.3 パフォーマンステスト

#### 7.3.1 ベンチマーク

```
パフォーマンステスト項目:

1. 100枚処理時間
   - 反復: 50回
   - 計測: 検出開始→ZIP完了
   - 目標: P50 ≤10秒、P95 ≤15秒

2. プレビュー表示時間
   - 反復: 50回
   - 計測: ポップアップ開く→画像表示
   - 目標: P50 ≤1秒

3. メモリ使用量
   - 1000枚処理時のピークメモリ
   - 目標: <500MB
   - リーク検査: 処理前後の差分 <10MB

4. 差分計算時間（Pro）
   - 1000件台帳との比較
   - 目標: <500ms
```

#### 7.3.2 負荷テスト

```
負荷テストケース:

1. 大量画像
   - 1000枚/ページ
   - クラッシュしないこと
   - 分割ZIP自動移行（未実装なら1GB制限）

2. 巨大画像
   - 各10MB × 10枚
   - メモリ圧迫テスト
   - タイムアウト適切動作

3. 低速ネットワーク
   - 4G シミュレート
   - タイムアウト設定有効性
   - 進捗表示の滑らかさ

4. 複数タブ同時実行
   - 3タブで同時収集
   - グローバル並列制限（8）遵守
   - データ競合なし
```

### 7.4 回帰テスト

```
回帰テスト自動化:

実行タイミング:
- 全PR作成時
- mainブランチマージ時
- 毎日1回（nightly）

テストスイート:
1. 単体テスト全実行（5分）
2. E2E 10サイト（20分）
3. パフォーマンステスト（15分）

合格基準:
- 単体テスト: 100%パス
- E2E: 95%以上検出率
- パフォーマンス: P95目標達成

失敗時:
- Slackへ通知
- ビルドブロック
- 詳細ログ保存
```

---

## 8. 非機能要件

### 8.1 セキュリティ

#### 8.1.1 権限最小化

```
権限設計:

必須権限（manifest.json）:
- storage: 設定・台帳保存
- downloads: ZIP保存
- scripting: コンテンツスクリプト注入
- activeTab: 現在のタブへのアクセス

逐次要求（実行時）:
- host_permissions: 対象URLのみ
- chrome.permissions.request() 使用
- ユーザー承認後に実行

禁止事項:
- <all_urls> の常時権限要求
- バックグラウンドでのページアクセス
- 閲覧履歴の収集
```

#### 8.1.2 データ保護

```
データ保護方針:

ローカル優先:
- 台帳: IndexedDB（ローカル）
- 設定: chrome.storage.sync（暗号化済み）
- 画像: 一時メモリ→即座破棄

外部送信（最小限）:
- ライセンス検証のみ
- HTTPS必須
- ユーザーデータ送信なし

プライバシー:
- 収集画像はローカルのみ
- URLの外部送信なし
- 匿名テレメトリ（オプトアウト可）
```

#### 8.1.3 CSP対応

```
Content Security Policy対応:

CSP厳格サイト（GitHub等）:
- inline script実行不可
- eval()禁止

対応策:
1. コンテンツスクリプトで実行
2. chrome.scripting.executeScript使用
3. フォールバック: DevToolsパネル経由（保留）

現状の制限:
- CSP厳格サイトで一部画像取得不可
- ユーザーへ明示通知
- 個別ダウンロード提案
```

### 8.2 パフォーマンス

#### 8.2.1 最適化方針

```
最適化項目:

1. メモリ管理
   - Blob即座破棄（URL.revokeObjectURL）
   - ストリーム処理（可能な限り）
   - 大量画像時の分割処理

2. ネットワーク
   - 並列制御（8並列）
   - ドメイン別レート制限（2/domain）
   - タイムアウト設定（30秒）

3. UI応答性
   - 長時間処理のWebWorker化（将来）
   - プログレッシブレンダリング
   - 仮想スクロール（100枚以上）

4. IndexedDB
   - インデックス活用
   - トランザクションバッチ化
   - 定期クリーンアップ
```

#### 8.2.2 リソース制限

```
リソース制限値:

メモリ:
- 処理中ピーク: <500MB
- アイドル時: <50MB

ストレージ:
- IndexedDB: 無制限（90日自動削除）
- chrome.storage.sync: <8KB

ネットワーク:
- 同時接続: 8（グローバル）
- ドメイン別: 2
- タイムアウト: 30秒/画像

ZIP:
- 最大サイズ: 1GB
- 超過時: エラー通知
```

### 8.3 エラーハンドリング

#### 8.3.1 エラー分類

```
エラーカテゴリ:

1. ネットワークエラー
   - CORS: 「一部画像にアクセスできません」
   - Timeout: 「接続タイムアウト。再試行しますか?」
   - HTTP 4xx/5xx: 「画像が見つかりません」

2. リソースエラー
   - ZIP 1GB超過: 「サイズ上限。個別ダウンロードしますか?」
   - メモリ不足: 「処理を中断しました」

3. 権限エラー
   - host_permission拒否: 「権限が必要です」
   - downloads拒否: 「ダウンロード権限が必要です」

4. データエラー
   - IndexedDB失敗: 「台帳保存に失敗」
   - 差分計算失敗: 「差分検出をスキップ」
```

#### 8.3.2 リカバリ戦略

```
リカバリ方針:

自動リトライ:
- ネットワークエラー: 3回まで自動再試行
- IndexedDB一時失敗: 即座再試行
- 失敗後の指数バックオフ

ユーザー選択:
- CORS失敗: 個別ダウンロード提案
- タイムアウト: 「続行」or「中断」
- ZIP超過: 「分割」or「キャンセル」

フェイルセーフ:
- 部分的成功を許容
- 失敗URLをリスト表示
- 成功分のみZIP生成
- 台帳更新は常に実行
```

### 8.4 国際化（将来対応）

```
国際化準備:

優先言語:
- 英語（en）: デフォルト
- 日本語（ja）: Phase 2

対応範囲:
- UI文言
- エラーメッセージ
- 設定項目ラベル

非対応:
- ドキュメント（英語のみ）
- サポート（英語のみ）

実装方式:
- chrome.i18n API
- _locales/ ディレクトリ
- messages.json
```

---

## 9. デプロイとリリース

### 9.1 ビルドプロセス

```
ビルドステップ:

1. 環境チェック
   - Node.js 20+
   - pnpm 8+

2. 依存関係インストール
   pnpm install --frozen-lockfile

3. Lint & Format
   pnpm lint
   pnpm format --check

4. 単体テスト
   pnpm test

5. TypeScript型チェック
   pnpm tsc --noEmit

6. ビルド
   pnpm build
   - 出力: dist/
   - マニフェスト検証
   - アイコン確認

7. E2Eテスト
   pnpm test:e2e

8. ZIP生成
   pnpm zip
   - 出力: diffsnap-v1.0.0.zip
```

### 9.2 Chrome Web Store公開

#### 9.2.1 ストア情報

```
必須情報:

1. 基本情報
   - 名前: DiffSnap
   - 説明（短）: Collect page images with smart diff tracking (132文字)
   - 説明（詳細）: 1000文字以内
   - カテゴリ: Productivity
   - 言語: English

2. ビジュアル
   - アイコン: 128x128px PNG（透過）
   - スクリーンショット: 1280x800px × 5枚
   - プロモタイル: 440x280px（任意）
   - 動画: YouTube URL（30秒デモ）

3. プライバシー
   - プライバシーポリシーURL
   - 権限の正当性説明
   - データ収集の有無

4. サポート
   - サポートURL
   - ウェブサイトURL
```

#### 9.2.2 審査対策

```
審査通過ポイント:

1. 権限説明
   - 各権限の具体的用途を明記
   - activeTabの必要性
   - storageの使用目的

2. プライバシー
   - データ収集なし を明示
   - ローカル処理を強調
   - 台帳の保存場所説明

3. 機能明確化
   - 「閲覧中ページのみ」を強調
   - クローリング禁止を明記
   - 適法利用の注意喚起

4. テスト
   - デモ用アカウント提供
   - ビデオデモで全機能紹介
   - エッジケースの動作確認
```

### 9.3 バージョニング

```
セマンティックバージョニング:

形式: MAJOR.MINOR.PATCH

ルール:
- MAJOR: 互換性のない変更
- MINOR: 機能追加（後方互換）
- PATCH: バグ修正

例:
- 1.0.0: 初回リリース
- 1.1.0: Pro差分機能追加
- 1.1.1: 差分バグ修正
- 2.0.0: データモデル変更

manifest.json:
- version: "1.0.0"
- version_name: "1.0.0 (Beta)" ← ユーザー表示用
```

### 9.4 ロールバック計画

```
ロールバック手順:

トリガー:
- 重大バグ報告（クラッシュ率>5%）
- データ損失報告
- Chrome審査リジェクト

手順:
1. 新バージョンを非公開化
2. 前バージョンを再公開
3. ユーザーへ通知（ストア説明更新）
4. GitHub で hotfix ブランチ作成
5. 修正→テスト→再リリース

データ互換性:
- マイナーバージョンは後方互換必須
- メジャーバージョンは移行スクリプト提供
```

---

## 10. 監視とメンテナンス

### 10.1 テレメトリ

#### 10.1.1 収集イベント

```
匿名イベント（オプトアウト可）:

実行イベント:
- run_start: 収集開始
- run_end: 収集完了
- run_error: エラー発生

属性:
- imageCount: 画像枚数
- processingTime: 処理時間（ms）
- hasDiff: 差分検出の有無（Pro）
- failedCount: 失敗画像数
- zipSize: ZIPサイズ（MB）
- version: 拡張バージョン

UI イベント:
- upgrade_prompt_shown: アップグレード表示
- upgrade_prompt_clicked: クリック
- settings_opened: 設定画面表示
- template_changed: テンプレート変更

エラーイベント:
- error: { type, message, url? }
```

#### 10.1.2 送信仕様

```
送信エンドポイント:
POST https://api.diffsnap.io/v1/telemetry

ペイロード:
{
  "events": [
    {
      "type": "run_end",
      "timestamp": 1704067200000,
      "attributes": {
        "imageCount": 42,
        "processingTime": 8500,
        "version": "1.0.0"
      }
    }
  ],
  "sessionId": "uuid-v4",  // 匿名セッション
  "extensionId": "chrome-extension-id"
}

プライバシー:
- ユーザーID送信なし
- URL送信なし
- 画像コンテンツ送信なし
- IPアドレス記録なし（サーバ側）
```

### 10.2 エラー監視

```
エラーレポート:

自動送信（ユーザー承認後）:
- エラー種別
- スタックトレース
- 拡張バージョン
- ブラウザバージョン
- 発生時刻

手動レポート:
- 「Report Issue」ボタン
- GitHub Issue自動作成
- 再現手順入力欄
```

### 10.3 アップデート戦略

```
自動更新:
- Chrome Web Store経由
- ユーザー操作不要
- バックグラウンドで実行

更新通知:
- メジャーバージョン: リリースノート表示
- マイナーバージョン: 控えめ通知
- パッチ: 通知なし

データ移行:
- メジャーバージョン時のみ
- バックグラウンドで自動実行
- 失敗時はロールバック
```

---

## 11. 制約と制限事項

### 11.1 技術的制限

```
現在の制限:

1. 検出範囲
   - 閲覧中ページのみ
   - バックグラウンドタブ不可
   - iframe内の画像は部分対応

2. CORS制約
   - 厳格なCSPサイトで一部失敗
   - 認証が必要な画像は取得可能（Cookie継承）
   - data URLは常に取得可能

3. ZIP制限
   - 最大1GB
   - 超過時はエラー
   - 分割ZIPは未実装（Phase 2）

4. パフォーマンス
   - 1000枚超は時間がかかる
   - メモリ500MB超は不安定
   - 低速回線では体感遅延

5. ブラウザ
   - Chrome/Edge/Brave のみ
   - Firefox未対応（MV2）
```

### 11.2 機能制限（意図的）

```
MVP段階での制限:

削除済み機能:
- OCR/全文検索 → Phase 2
- タブ一括処理 → Phase 2
- 後処理（WebP変換等） → Phase 2
- Team/共有機能 → Phase 3以降

理由:
- 90日開発期間の現実性
- MVP検証の焦点明確化
- Pro差別化の核は「差分監視」のみ

将来追加条件:
- MVP黒字化後
- ユーザーフィードバック反映
```

### 11.3 既知の問題

```
既知のバグ/制限:

1. srcset誤検出
   - 1x/2x混在時に重複可能性
   - ハッシュ去重で対処

2. Canvas CORS汚染
   - 外部画像を描画したCanvasはtoDataURL()不可
   - SecurityError発生→スキップ
   - ユーザーへ通知なし（コンソールのみ）

3. 動的読込の検出漏れ
   - IntersectionObserver使用サイトで遅延
   - 自動スクロール後の待機時間（500ms）で対応
   - 一部の高度な遅延読込は未対応

4. CSS background抽出の限界
   - ::before/::after の content: url() 検出は部分的
   - getComputedStyle が返さないケースあり
   - 重要度低（稀なケース）

5. 差分台帳の肥大化
   - 長期利用で数百MB到達可能
   - 90日自動削除で対処
   - 手動クリーンアップ機能提供

6. 命名衝突の稀なケース
   - 同一サイズ・同一秒に大量処理時
   - deconflict で -1, -2... 付与
   - 1000枚超で衝突チェック遅延可能性
```

### 11.4 ブラウザ互換性マトリクス

```
ブラウザ対応表:

| 機能 | Chrome 120+ | Edge 120+ | Brave | Firefox | Safari |
|------|------------|-----------|-------|---------|--------|
| 基本収集 | ✅ | ✅ | ✅ | ❌ MV2 | ❌ 拡張API差異 |
| 差分監視 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 自動スクロール | ✅ | ✅ | ✅ | ❌ | ❌ |
| ZIP生成 | ✅ | ✅ | ✅ | ❌ | ❌ |
| IndexedDB | ✅ | ✅ | ✅ | ❌ | ❌ |

注記:
- Edge: Chromiumベースのため完全互換
- Brave: Chrome拡張互換レイヤー経由で動作
- Firefox: MV3対応後に検討
- Safari: 拡張APIが大幅に異なるため非対応
```

---

## 12. 開発ワークフロー

### 12.1 Git戦略

```
ブランチ戦略（GitHub Flow簡易版）:

main (保護ブランチ)
  ├─ feature/detector-engine
  ├─ feature/diff-engine
  ├─ feature/pro-ui
  └─ hotfix/cors-error-handling

ルール:
1. main は常にデプロイ可能
2. 機能開発は feature/* ブランチ
3. バグ修正は hotfix/* ブランチ
4. PR作成→レビュー→マージ
5. マージ後、feature ブランチ削除

コミットメッセージ:
feat: 新機能追加
fix: バグ修正
docs: ドキュメント変更
test: テスト追加
refactor: リファクタリング
chore: ビルド・設定変更

例:
feat(detector): add SVG image detection
fix(diff): resolve hash collision in query params
test(e2e): add Amazon product page test
```

### 12.2 コードレビュー基準

```
PR承認基準:

必須チェック:
- [ ] CI/CD全通過（lint, test, build）
- [ ] 型エラーなし（tsc --noEmit）
- [ ] 新規コードのテストカバレッジ ≥80%
- [ ] E2E該当機能の追加/更新
- [ ] CHANGELOG.md更新
- [ ] 破壊的変更の場合、移行ガイド追加

コードレビューポイント:
1. ロジックの正確性
2. エラーハンドリング網羅性
3. パフォーマンス影響
4. セキュリティリスク
5. 可読性・保守性
```

### 12.3 CI/CD パイプライン

```
GitHub Actions ワークフロー:

on: [push, pull_request]

jobs:
  lint:
    - pnpm install
    - pnpm lint
    - pnpm format --check

  typecheck:
    - pnpm tsc --noEmit

  test:
    - pnpm test
    - カバレッジレポート生成
    - 80%未満で警告

  build:
    - pnpm build
    - dist/ の整合性チェック
    - マニフェスト検証

  e2e:
    - Playwright インストール
    - pnpm test:e2e
    - スクリーンショット保存（失敗時）

  package:
    - runs-on: main ブランチのみ
    - pnpm zip
    - artifact アップロード

デプロイ（手動トリガー）:
  - Chrome Web Store API経由
  - zip アップロード
  - 審査提出
```

### 12.4 ローカル開発環境

```
開発セットアップ:

1. リポジトリクローン
   git clone git@github.com:taisei-ide-0123/DiffSnap.git
   cd diffsnap

2. 依存関係インストール
   pnpm install

3. 開発ビルド起動
   pnpm dev
   - ホットリロード有効
   - ソースマップ生成

4. Chrome拡張読み込み
   - chrome://extensions/
   - 「デベロッパーモード」有効化
   - 「パッケージ化されていない拡張機能を読み込む」
   - dist/ ディレクトリ選択

5. 変更監視
   - Vite が変更検知
   - 自動リビルド
   - 拡張の「再読み込み」ボタンクリック

デバッグ:
- Background: chrome://extensions/ → 「service worker」リンク
- Popup: 右クリック→「検証」
- Content: 通常のDevTools
```

---

## 13. ドキュメンテーション

### 13.1 必須ドキュメント

```
ドキュメント構成:

1. README.md
   - プロジェクト概要
   - インストール手順
   - 開発セットアップ
   - ビルド手順
   - 貢献ガイドライン

2. ARCHITECTURE.md
   - システム構成図
   - データフロー
   - モジュール依存関係
   - 設計判断の記録

3. API.md
   - 内部API仕様
   - メッセージング仕様
   - データモデル詳細

4. CHANGELOG.md
   - バージョン別変更履歴
   - 破壊的変更の明記
   - 移行ガイド

5. PRIVACY.md
   - プライバシーポリシー
   - データ収集の詳細
   - ユーザー権利

6. LICENSE
   - MITライセンス推奨
```

### 13.2 ユーザー向けドキュメント

```
ユーザーガイド:

1. クイックスタート（3分）
   - インストール
   - 初回実行
   - 基本操作

2. 機能ガイド
   - 画像検出の仕組み
   - 差分監視の使い方（Pro）
   - 命名テンプレート設定
   - ドメインプロファイル

3. FAQ
   - 「なぜ一部画像が取得できない？」
   - 「差分が検出されない」
   - 「ZIPが1GBを超えた」
   - 「Proへのアップグレード方法」

4. トラブルシューティング
   - CORS エラー対処
   - タイムアウト対処
   - メモリ不足対処

5. ビデオチュートリアル
   - YouTube 30秒デモ
   - 差分機能デモ（Pro）
```

### 13.3 開発者向けドキュメント

```
開発ドキュメント:

1. CONTRIBUTING.md
   - コントリビューション方法
   - コーディング規約
   - PR提出手順

2. TESTING.md
   - テスト実行方法
   - 新規テスト追加ガイド
   - E2E環境セットアップ

3. DEPLOYMENT.md
   - リリースプロセス
   - Chrome Web Store公開手順
   - ロールバック手順

4. ADR (Architecture Decision Records)
   - 重要な設計判断の記録
   - 例: 「なぜJSZipを選んだか」
   - 例: 「なぜOCRを削除したか」
```

---

## 14. リスク管理

### 14.1 技術リスク

```
リスクマトリクス:

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| Chrome審査リジェクト | 中 | 高 | 権限説明強化、審査前テスト |
| CORS制約で検出率<95% | 中 | 中 | フォールバック実装、明示通知 |
| IndexedDB肥大化 | 中 | 中 | 90日自動削除、手動削除機能 |
| 並列制御バグでクラッシュ | 低 | 高 | 負荷テスト、上限厳守 |
| ZIP 1GB超過が頻発 | 低 | 中 | エラー通知、個別DL提案 |
| 差分台帳の衝突 | 低 | 低 | SHA-256で実質ゼロ |
| MV3 API変更 | 低 | 高 | Chrome beta監視、早期対応 |
```

### 14.2 事業リスク

```
事業リスクと対策:

1. Free→Pro転換率<5%
   - リスク: 収益化失敗
   - 対策: 14日トライアル、UI改善
   - 監視: 週次ダッシュボード

2. 競合の出現
   - リスク: 差別化喪失
   - 対策: 差分監視の特許検討（保留）
   - 先行者優位の確立

3. Chrome Web Store規約変更
   - リスク: 突然の削除
   - 対策: 規約監視、代替配布経路（自社サイト）

4. ユーザー増加でインフラコスト急増
   - リスク: 採算割れ
   - 対策: ライセンス検証のみ（軽量）
   - スケーラビリティ設計

5. サポート負荷
   - リスク: 対応不能
   - 対策: FAQ充実、コミュニティフォーラム
```

### 14.3 法務リスク

```
法務リスクと対策:

1. 著作権侵害の助長
   - リスク: 訴訟
   - 対策: 注意喚起の常設表示
   - 免責事項明記

2. 利用規約違反（サイト側）
   - リスク: サイトからの苦情
   - 対策: robots.txt尊重（未実装だが方針明記）
   - 「閲覧中ページのみ」制限

3. プライバシー侵害
   - リスク: GDPR等違反
   - 対策: データ収集最小化
   - プライバシーポリシー整備

4. 商標問題
   - リスク: 名称衝突
   - 対策: 事前商標検索（USPTO）
   - 必要に応じて改名
```

---

## 15. 成功基準

### 15.1 MVP成功指標（Day 30）

```
定量指標:

技術:
- [ ] 10サイト回帰テスト 95%以上検出率
- [ ] 100枚処理 P50 ≤10秒
- [ ] プレビュー表示 P50 ≤1秒
- [ ] クラッシュ率 <1%

公開:
- [ ] Chrome Web Store審査通過
- [ ] 初回公開完了
- [ ] ストア評価 ≥4.0 (10レビュー以上)

ユーザー:
- [ ] DAU 50+
- [ ] 週実行回数中央値 ≥3
- [ ] NPS収集開始（サンプル20+）
```

### 15.2 Pro成功指標（Day 60）

```
定量指標:

技術:
- [ ] 差分検出精度 100%（新規/既存分離）
- [ ] 差分計算時間 <500ms（1000件台帳）
- [ ] Pro機能クラッシュ率 <0.5%

事業:
- [ ] Pro契約 10件/週
- [ ] Free→Pro転換率 ≥5%
- [ ] 差分機能使用率 ≥30%（Pro）
- [ ] チャーン率 <15%（Pro、月次）

ユーザー:
- [ ] DAU 200+
- [ ] Pro DAU 20+
- [ ] NPS ≥40
```

### 15.3 安定化成功指標（Day 90）

```
定量指標:

技術:
- [ ] 全E2Eテスト自動化
- [ ] カバレッジ ≥80%
- [ ] クラッシュ率 <0.5%
- [ ] P95処理時間 ≤15秒維持

事業:
- [ ] MRR $2,000+
- [ ] Pro継続率 ≥85%（30日）
- [ ] WAU 1,000+
- [ ] ストア評価 ≥4.3 (50+ レビュー)

運用:
- [ ] 監視ダッシュボード稼働
- [ ] 週次メトリクスレビュー実施
- [ ] ドキュメント完備
- [ ] リリースプロセス確立
```

---

## 16. 次フェーズ計画（Day 91以降）

### 16.1 Phase 2: Pro拡張機能（Day 91-150）

```
追加機能候補:

1. OCR/全文検索
   - Tesseract.js統合
   - 遅延索引
   - 検索UI

2. タブ一括処理
   - 現在ウィンドウ全タブ
   - 並列実行管理
   - 統合レポート

3. 後処理パイプライン
   - WebP/AVIF変換
   - 圧縮率指定
   - EXIF操作

4. 高度なフィルタ
   - 類似画像除外（pHash）
   - 顔検出（TensorFlow.js）
   - PII自動マスク

条件:
- MVP黒字化
- Proユーザー100+
- NPS ≥50
```

### 16.2 Phase 3: Team機能（Day 151-240）

```
Team機能:

1. 共有コレクション
   - Firebase Realtime DB
   - リアルタイム同期
   - チーム招待

2. クラウド連携
   - S3書き出し
   - Google Drive統合
   - Webhook（Figma/Notion）

3. 権限管理
   - ロール設定（Admin/Member/Viewer）
   - 監査ログ
   - アクセス制御

4. Enterprise機能
   - SSO (SAML/OAuth)
   - データ所在地選択
   - DLP統合

条件:
- Pro MRR $10k+
- Team需要検証（50+リクエスト）
- バックエンド開発リソース確保
```

### 16.3 拡張可能性

```
将来的な拡張方向:

水平展開:
- Firefox対応（MV3対応後）
- Safari対応（API差異解消後）
- Edgeネイティブ配布

垂直展開:
- ビデオダウンロード（別製品）
- PDFエクスポート
- データセット作成支援

API化:
- 外部ツール連携
- ヘッドレス実行
- CI/CD統合
```

---

## 17. 付録

### 17.1 用語集

```
主要用語:

ImageCandidate
  検出された画像の候補オブジェクト。URLと要素メタデータを含む。

ImageSnapshot
  差分台帳に保存される画像の記録。ハッシュとメタデータ。

DiffRecord
  特定URLに対する訪問履歴と画像スナップショットの集合。

recordId
  差分台帳のレコードを一意に識別するキー。origin+pathname+queryHashから生成。

queryHash
  クエリパラメータをソート後にハッシュ化した16桁の文字列。

去重 (Deduplication)
  重複する画像をSHA-256ハッシュで検出し、1つに統合する処理。

並列制御 (Parallel Control)
  グローバル8並列、ドメイン別2並列の制限を管理する仕組み。

衝突回避 (Deconflict)
  同名ファイルに連番を付与して一意性を確保する処理。

グレース期間
  ライセンス期限後72時間のPro機能継続期間。
```

### 17.2 参考資料

```
技術ドキュメント:

Chrome Extensions:
- https://developer.chrome.com/docs/extensions/mv3/
- Manifest V3 migration guide
- chrome.* API reference

Web APIs:
- https://developer.mozilla.org/en-US/docs/Web/API
- Web Crypto API
- IndexedDB API
- Blob API

ライブラリ:
- JSZip: https://stuk.github.io/jszip/
- idb: https://github.com/jakearchibald/idb
- Zustand: https://github.com/pmndrs/zustand
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/

ベストプラクティス:
- Chrome Extension Best Practices
- WCAG 2.1 Accessibility Guidelines
```

### 17.3 開発チェックリスト

```
Phase 1 (MVP) チェックリスト:

Week 1:
- [ ] プロジェクト雛形作成
- [ ] CI/CD設定
- [ ] detector実装（8種類）
- [ ] url-utils実装
- [ ] 単体テスト（detector, url-utils）

Week 2:
- [ ] lazy-loader実装
- [ ] collector実装（並列制御）
- [ ] popup UI雛形
- [ ] メッセージング実装

Week 3:
- [ ] diff-engine実装
- [ ] zipper実装
- [ ] 進捗UI実装
- [ ] Free制限実装

Week 4:
- [ ] E2E環境構築
- [ ] 10サイトテスト実装
- [ ] パフォーマンステスト
- [ ] ストア素材作成
- [ ] プライバシーポリシー作成

Week 4末:
- [ ] 検出率95%達成
- [ ] P50 ≤10秒達成
- [ ] ストア申請準備完了
```

---

## 18. 仕様変更履歴

```
v1.0 (2025-01-XX)
- 初版作成
- MVP仕様確定
- 90日計画策定

将来の変更:
- 実装過程での調整は CHANGELOG.md に記録
- 仕様変更は本ドキュメントを更新
- バージョン管理: Git タグで追跡
```

---

**この仕様書の使い方（AIコーディングエージェント向け）**

```
実装時の参照順序:

1. セクション3（アーキテクチャ）でモジュール構成を理解
2. セクション4（データモデル）で型定義を確認
3. セクション5（コア機能）で実装詳細を参照
4. セクション6（UI/UX）でUI実装を確認
5. セクション7（テスト）でテスト作成
6. セクション12（ワークフロー）で開発手順を確認

重要原則:
- コード例は含まれていない（意図的）
- アルゴリズムと仕様のみ記述
- 実装判断はエージェントに委任
- 疑問点は GitHub Issues で質問

不明点があれば:
- まずセクション17.1（用語集）を確認
- セクション17.2（参考資料）を参照
- 仕様の矛盾を発見したら即座に報告
```
