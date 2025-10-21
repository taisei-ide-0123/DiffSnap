# DiffSnap コア機能仕様

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション5

---

## 5. コア機能仕様

### 5.1 画像検出エンジン（Content Script）

#### 5.1.1 検出対象（段階的実装: MVP 5種類 → Phase 2で8種類）

**MVP実装（Week 1-2）:**

| # | 検出対象 | セレクタ/方法 | 優先度 | 備考 |
|---|---------|-------------|--------|------|
| 1 | `<img>` | `document.querySelectorAll('img')` | 高 | src, currentSrc取得 |
| 2 | `<picture>` | `document.querySelectorAll('picture')` | 高 | source要素も走査 |
| 3 | srcset | img.srcset解析 | 高 | 最大解像度選択（下記詳細） |
| 4 | CSS background-image | `getComputedStyle(el).backgroundImage` | 中 | 主要要素のみ走査 |
| 5 | `<canvas>` | `canvas.toDataURL()` | 中 | CORS汚染時スキップ |

**Phase 2追加（Day 46-60）:**

| # | 検出対象 | セレクタ/方法 | 優先度 | 備考 |
|---|---------|-------------|--------|------|
| 6 | SVG `<image>`, `<use>` | `querySelectorAll('svg image, svg use')` | 中 | href, xlink:href |
| 7 | `<video poster>` | `video[poster]` | 低 | poster属性 |
| 8 | CSS content | `getComputedStyle(el, '::before/::after').content` | 低 | url()抽出 |

**理由**: 5種類で主要サイトの85-90%の画像をカバー可能。残り3種は追加的な検出率向上（+5-10%）。

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

#### 5.1.3 srcset解析仕様（詳細化版）

```
srcset解析ロジック（優先度ルール明確化）:

入力例1: "image-320w.jpg 320w, image-640w.jpg 640w, image-1280w.jpg 1280w"
入力例2: "image.jpg 1x, image@2x.jpg 2x, image@3x.jpg 3x"
入力例3: "image-640w.jpg 640w, image@2x.jpg 2x"（混在ケース）

処理アルゴリズム:
1. カンマ区切りで分割 → 各候補エントリ
2. 各エントリを空白で分割 → [URL, descriptor]
3. descriptor分類:
   - "Xw" 形式 → 幅ディスクリプタ（ピクセル幅）
   - "Xx" 形式 → 密度ディスクリプタ（デバイスピクセル比）
   - なし → 1x とみなす

4. 優先度ルール:
   a. 幅ディスクリプタ優先（より正確な解像度指定）
   b. 同一形式内で最大値選択
   c. 混在時: 幅ディスクリプタ最大 > 密度ディスクリプタ最大

5. 具体的選択ロジック:
   - 幅ディスクリプタあり → max(widths) のURL
   - 幅なし、密度のみ → max(densities) のURL
   - 混在 → 幅ディスクリプタの max(widths) のURL

6. 特殊ケース:
   - viewport幅の考慮: MVP では考慮せず、常に最大選択
   - メディアクエリ: <picture><source media="..."> は別途処理

出力例1: "image-1280w.jpg" (1280w が最大)
出力例2: "image@3x.jpg" (3x が最大)
出力例3: "image-640w.jpg" (幅ディスクリプタ優先)
```

#### 5.1.4 CSS background-image抽出（最適化版）

```
CSS背景抽出ロジック（パフォーマンス最適化）:

問題: 全要素走査は大規模DOMで遅延（数千要素で1秒超）

最適化戦略:
1. 主要セレクタに限定（MVP）:
   - セクション要素: section, article, div[class*="hero"], div[class*="banner"]
   - カード要素: div[class*="card"], div[class*="item"]
   - 背景コンテナ: div[class*="background"], div[class*="cover"]
   - 最大走査: 500要素まで

2. 各要素に対して:
   style = getComputedStyle(el).backgroundImage

3. 値が 'none' ならスキップ

4. 正規表現で url() を抽出:
   /url\(['"]?([^'"()]+)['"]?\)/g

5. 複数背景対応（カンマ区切り）:
   background-image: url(bg1.jpg), url(bg2.jpg)
   → 両方抽出

6. 各URLを正規化して候補追加

7. Phase 2拡張:
   - 全要素走査オプション（設定で有効化）
   - IntersectionObserver で可視要素のみ
   - Web Worker での並列処理

注意事項:
- ::before/::after の content: url() は検出困難（getComputedStyle制限）
- Phase 2で優先度を上げて対応
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

#### 5.2.2 無限スクロール検出（状態マシン明確化）

```
無限スクロール判定（優先度ルール）:

状態マシン定義:

State: SCROLLING
初期化:
  scrollCount = 0
  noChangeCount = 0
  previousHeight = document.documentElement.scrollHeight

各スクロールイテレーション:
1. window.scrollTo(0, scrollHeight)
2. await delay(500ms)
3. currentHeight = document.documentElement.scrollHeight

4. 判定ロジック（優先度順）:

   a. タイムアウト判定（最優先）:
      if (elapsed > timeout): → State: TIMEOUT_REACHED
        通知: "時間制限に達しました"
        → スクロール終了

   b. 最下部到達判定:
      if (currentHeight === previousHeight):
        noChangeCount++
        if (noChangeCount >= 3): → State: BOTTOM_REACHED
          → スクロール終了（成功）
      else:
        noChangeCount = 0  // リセット

   c. 最大深度判定:
      scrollCount++
      if (scrollCount >= maxDepth): → State: MAX_DEPTH_REACHED
        if (currentHeight !== previousHeight):
          // まだ変化している = 無限スクロール
          通知: "20画面スクロール完了。続行しますか?"
          → ユーザー選択待ち
        else:
          → スクロール終了（成功）

   d. 継続:
      previousHeight = currentHeight
      → 次のイテレーションへ

5. 終了処理:
   - window.scrollTo(0, 0) でトップ復帰
   - 画像再検出実行
   - 検出完了通知

ユーザー選択肢（MAX_DEPTH_REACHED時）:
- "Continue +20" → maxDepth += 20, State: SCROLLING に戻る
- "Stop and Download" → スクロール終了、現在の検出結果で処理
- "Cancel" → 処理中断

エッジケース:
- スクロール中に新規コンテンツ読込が遅延（500ms超）→ timeout調整可能
- JavaScript無効ページ → スクロール1回で終了
- 固定高さページ → noChangeCount=3 で即座終了
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

#### 5.3.2 レコードID生成（改善版: 衝突リスク削減）

```
makeRecordId(url: string): string

目的: 差分台帳の一意キー生成
形式: "${origin}${pathname}:${queryHash}"

重大な改善点:
- queryHash長: 16桁 → 32桁（衝突リスク 2^-64 → 2^-128）
- 重要パラメータ抽出: ドメイン別設定で精度向上

queryHash生成（改善版）:

1. 重要パラメータ抽出:
   significantParams = extractSignificantParams(query, hostname)

   // ドメイン別の重要パラメータ定義
   SIGNIFICANT_PARAMS = {
     'amazon.com': ['dp', 'asin'],           // 商品ID
     'ebay.com': ['item'],                   // 商品ID
     'youtube.com': ['v'],                   // 動画ID
     'twitter.com': ['status'],              // ツイートID
     'default': ['id', 'pid', 'product_id', 'sku', 'item_id']
   }

   ロジック:
   a. hostname に対応するパラメータリストを取得
   b. クエリから該当パラメータのみ抽出
   c. 該当なしの場合: 全パラメータを使用（後方互換）

2. パラメータ正規化:
   - キーでソート
   - 値をエンコード正規化
   - 連結: "key1=value1&key2=value2"

3. SHA-256ハッシュ化:
   hash = SHA-256(normalizedQuery)
   queryHash = hash.slice(0, 32)  // 32桁（16進数128ビット）

4. recordID構築:
   return `${origin}${pathname}:${queryHash}`

理論的衝突確率:
- 16桁: 2^-64 ≈ 5.4×10^-20 (1京分の5)
- 32桁: 2^-128 ≈ 2.9×10^-39 (実質ゼロ)

実用的考慮:
- クエリエントロピー低下を重要パラメータ抽出で補完
- 例: /product?id=123&utm_*=... → id=123 のみ使用
- 追跡パラメータ（utm_*, fbclid等）を除外

例:

入力1: 'https://amazon.com/dp/B08XYZ?tag=abc&ref=xyz'
重要パラメータ: dp=B08XYZ
queryHash: SHA-256("dp=B08XYZ").slice(0, 32)
→ 'https://amazon.com/dp:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'

入力2: 'https://example.com/product?id=456&sort=price&page=2'
重要パラメータ: id=456（defaultルール）
queryHash: SHA-256("id=456").slice(0, 32)
→ 'https://example.com/product:f1e2d3c4b5a69788...'

入力3（重要パラメータなし）: 'https://blog.com/post?date=2025-01-21'
重要パラメータ: なし → 全パラメータ使用
queryHash: SHA-256("date=2025-01-21").slice(0, 32)
→ 'https://blog.com/post:9a8b7c6d5e4f3a2b...'

Phase 2拡張:
- ユーザーカスタムルール（Settings UI）
- 機械学習による自動パラメータ重要度推定
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

### 5.5 Service Worker Keep-Alive戦略（MV3重要対策、強化版）

#### 5.5.0 MV3 Service Worker制約への対応

```
問題:
MV3 Service Workerは30秒間無操作で自動休止
→ 長時間処理（100枚fetch 10-15秒）で休止リスク
→ IndexedDB接続切断、進捗状態喪失
→ ユーザーがPopupを閉じると Keep-Alive ポート切断

対策: Alarms API + チェックポイント機構（堅牢化）

1. Alarms API による自律的 Keep-Alive（推奨実装）:

   問題点（旧仕様）:
   - chrome.runtime.connect() はUI依存
   - Popup閉じる → ポート切断 → Keep-Alive失効
   - Content Script アンロード → 同様の問題

   改善策:
   Service Worker自身がAlarms APIで定期的に自己起動

   実装:
   // Background Service Worker起動時
   chrome.alarms.create('keep-alive', {
     periodInMinutes: 0.5  // 30秒ごと
   });

   chrome.alarms.onAlarm.addListener(async (alarm) => {
     if (alarm.name === 'keep-alive') {
       // 処理中かチェック
       const { activeProcessing } = await chrome.storage.session.get(['activeProcessing']);

       if (activeProcessing) {
         console.log('Keep-alive: processing continues');
         // このコード実行自体がService Workerを起動 → 30秒カウンタリセット

         // 追加: 処理再開ロジック（後述のチェックポイントから）
         await resumeProcessingIfNeeded();
       }
     }
   });

   メリット:
   - UI非依存（Popup閉じても継続）
   - タブ遷移やContent Scriptアンロードに強い
   - 信頼性高い（Chrome公式推奨パターン）

2. チェックポイント機構（処理の冪等化）:

   問題: Service Worker休止時に処理中断
   対策: 5枚ごとにチェックポイント保存、再開可能に

   データ構造:
   interface ProcessingCheckpoint {
     tabId: number;
     url: string;
     candidates: ImageCandidate[];      // 全候補
     completedIndices: number[];        // 完了済みindex配列
     failedCandidates: FailedImage[];   // 失敗リスト
     lastCheckpointAt: number;          // 最終保存時刻
     phase: 'fetching' | 'zipping';     // 処理フェーズ
   }

   チェックポイント保存:
   async function saveCheckpoint(checkpoint: ProcessingCheckpoint) {
     await chrome.storage.session.set({
       [`checkpoint_${checkpoint.tabId}`]: checkpoint
     });
   }

   処理再開ロジック:
   async function resumeProcessingIfNeeded() {
     const keys = await chrome.storage.session.getKeys();
     const checkpointKeys = keys.filter(k => k.startsWith('checkpoint_'));

     for (const key of checkpointKeys) {
       const checkpoint = await chrome.storage.session.get(key);
       const elapsed = Date.now() - checkpoint.lastCheckpointAt;

       if (elapsed < 60000) {  // 1分以内なら再開
         await resumeFromCheckpoint(checkpoint);
       } else {
         // 古いチェックポイントは削除
         await chrome.storage.session.remove(key);
       }
     }
   }

   async function resumeFromCheckpoint(checkpoint: ProcessingCheckpoint) {
     const { candidates, completedIndices } = checkpoint;
     const remaining = candidates.filter((_, i) =>
       !completedIndices.includes(i)
     );

     console.log(`Resuming: ${remaining.length} images remaining`);

     for (let i = 0; i < remaining.length; i++) {
       const result = await fetchImage(remaining[i]);

       // 5枚ごとにチェックポイント更新
       if (i % 5 === 0) {
         checkpoint.completedIndices.push(i);
         checkpoint.lastCheckpointAt = Date.now();
         await saveCheckpoint(checkpoint);
       }
     }
   }

3. 処理分割戦略（100枚超の場合）:

   - 25枚ごとにチャンクへ分割
   - 各チャンク完了後にチェックポイント保存
   - 休止発生時も最大25枚のロスのみ
   - Alarms onAlarm で自動再開

4. UI非依存の進捗通知:

   問題: Popup閉じた状態でも進捗表示したい
   対策: chrome.action.setBadgeText() 使用

   実装:
   async function updateBadge(completed: number, total: number) {
     const percentage = Math.floor((completed / total) * 100);
     await chrome.action.setBadgeText({ text: `${percentage}%` });
     await chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
   }

   完了時:
   await chrome.action.setBadgeText({ text: '✓' });
   await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });

5. フォールバック戦略:

   Alarms API失敗時（理論上発生しない）:
   - chrome.runtime.connect() の併用
   - 両方で Keep-Alive を試みる
   - どちらか一方が動作すればOK

6. テスト戦略:

   - DevTools で Service Worker を手動停止
   - 再起動後にチェックポイントから復帰確認
   - 100枚処理中に強制停止→再開テスト

Phase 2検討:
- Offscreen Document API（DOM永続環境、より安定）
- Web Worker への処理移譲（独立スレッド）
```

### 5.6 並列制御（Parallel Controller）

#### 5.6.1 制御仕様（ドメイン判定詳細化）

```
並列制御パラメータ:

グローバル制限: 最大8並列
ドメイン別制限: 最大2並列/ドメイン

理由:
- グローバル: ブラウザのメモリ制約
- ドメイン別: レート制限回避、サーバー負荷分散

ドメイン抽出ロジック（改善版: CDN対応強化）:

問題認識:
- 同一サービスのCDNサブドメインが複数存在
- 例: images-na.ssl-images-amazon.com, m.media-amazon.com
- 現状: 別ドメイン扱い → 並列制限が効かない

改善策1: CDNマッピング（推奨、Pro Phase以降）

const CDN_MAPPINGS = {
  // Amazon CDN
  'ssl-images-amazon.com': 'amazon.com',
  'images-na.ssl-images-amazon.com': 'amazon.com',
  'images-fe.ssl-images-amazon.com': 'amazon.com',
  'm.media-amazon.com': 'amazon.com',

  // Cloudflare CDN
  'cdn.cloudflare.net': (url) => extractOriginFromReferer(url),

  // Cloudfront
  'cloudfront.net': 'cloudfront.net',  // サブドメイン保持

  // その他主要CDN（Phase 2で50-100パターン追加）
  'akamaized.net': 'akamaized.net',
  'fastly.net': 'fastly.net',
  // ...
};

function extractDomain(url: string): string {
  const hostname = new URL(url).hostname;

  // 1. CDNマッピング確認（部分一致）
  for (const [pattern, origin] of Object.entries(CDN_MAPPINGS)) {
    if (hostname.includes(pattern)) {
      return typeof origin === 'function' ? origin(url) : origin;
    }
  }

  // 2. eTLD+1フォールバック
  return extractETLDPlusOne(hostname);
}

function extractETLDPlusOne(hostname: string): string {
  // 簡易実装（Public Suffix List完全版はライブラリ使用）
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');  // example.com
  }
  return hostname;
}

改善策2: シンプル実装（MVP Phase 1推奨）

トレードオフ:
- CDN判定を諦め、サブドメイン単位で制限
- 並列効率は低下するが実装シンプル
- 大半のサイトで問題なし

function extractDomain(url: string): string {
  return new URL(url).hostname;  // そのまま使用
}

メリット:
- 実装容易（1行）
- CDNマッピングメンテナンス不要
- 誤判定リスクゼロ

デメリット:
- 並列効率やや低下
- 例: cdn1.example.com と cdn2.example.com で別カウント

実装方針:
- MVP Phase 1: シンプル実装（hostname そのまま）
- Pro Phase以降: CDNマッピング追加（主要50パターン）
- ユーザーフィードバックで優先度判断

3. ドメインカウンタ管理:
   domainCounts = Map<string, number>
   - fetch開始時: counts.get(domain)++
   - fetch完了時: counts.get(domain)--

実装方式:
- Promiseベースのキュー管理
- ドメイン別カウンタ（Map使用）
- スロット空き待機（async/await, 50ms polling）

並列制御アルゴリズム:
async function fetchWithConcurrencyControl(candidate):
  domain = extractDomain(candidate.url)

  // グローバル制限チェック
  while (globalActiveCount >= 8):
    await sleep(50)

  // ドメイン別制限チェック
  while (domainCounts.get(domain) >= 2):
    await sleep(50)

  // スロット確保
  globalActiveCount++
  domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)

  try:
    result = await fetchImage(candidate)
    return result
  finally:
    // スロット解放
    globalActiveCount--
    domainCounts.set(domain, domainCounts.get(domain) - 1)
```

#### 5.6.2 fetch仕様

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

### 5.7 差分エンジン（Pro機能）

#### 5.7.1 差分計算アルゴリズム

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

#### 5.7.2 台帳クリーンアップ

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

### 5.8 ZIP生成

#### 5.8.1 ZIP仕様

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

#### 5.8.2 ダウンロード実行

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

### 5.9 ファイル名生成

#### 5.9.1 テンプレート変数

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

#### 5.9.2 プリセットテンプレート

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

#### 5.9.3 サニタイズルール

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

#### 5.9.4 衝突回避

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

### 5.10 コンテキスト抽出仕様（新規追加）

#### 5.10.1 周辺コンテキスト抽出ロジック

```
目的: 画像の周辺テキストを50文字以内で抽出し、検索・識別に活用

抽出アルゴリズム:

1. 優先度付き情報源:
   a. aria-label 属性（最優先、アクセシビリティ情報）
   b. title 属性
   c. alt 属性（既に別フィールドだが、なければこちら）
   d. figcaption 要素（<figure>の子要素として）
   e. 祖先要素のテキストノード（3階層まで）

2. 祖先要素走査:
   element = img要素
   for (let i = 0; i < 3; i++):
     element = element.parentElement
     if (!element): break

     // テキストノード収集
     textNodes = Array.from(element.childNodes)
       .filter(node => node.nodeType === Node.TEXT_NODE)
       .map(node => node.textContent.trim())
       .filter(text => text.length > 0)

     if (textNodes.length > 0):
       context = textNodes.join(' ')
       break

3. テキスト正規化:
   - HTML除去（既にテキストノードなので不要）
   - 連続空白を単一スペースに統一
   - 改行を削除
   - 制御文字除去

4. 長さ制限:
   - マルチバイト文字考慮: String.prototype.length 使用
   - 50文字超過の場合: substring(0, 50) + "..."
   - 日本語等は文字数でカウント（バイト数ではない）

5. 空の場合のフォールバック:
   - 画像のURL最終セグメント（ファイル名部分）
   - 例: "https://example.com/images/product-photo.jpg"
   → context: "product-photo.jpg"

出力例:
- aria-label="Product showcase" → "Product showcase"
- <figure><img><figcaption>Beautiful sunset</figcaption></figure>
  → "Beautiful sunset"
- <div class="card"><img><p>Limited offer</p></div>
  → "Limited offer"
```

### 5.11 ライセンス検証（Pro機能）

#### 5.11.1 検証フロー（キャッシュ戦略追加）

```
checkTier(): Promise<'free' | 'pro'>

処理（キャッシュ戦略追加）:

1. キャッシュ確認:
   - chrome.storage.local から lastVerification 取得
   - { tier, expiresAt, verifiedAt } 構造
   - if (now - verifiedAt < 24時間 AND now < expiresAt):
       → キャッシュされた tier を返却（API呼び出しスキップ）

2. chrome.storage.sync から licenseKey 取得
   - キーが存在しない → 'free' 返却（キャッシュ更新）

3. キーが存在する場合、API検証実行:
   - APIエンドポイントにPOST
   - { key: licenseKey } を送信
   - タイムアウト: 5秒

4. API成功時:
   - レスポンス: { tier, expiresAt, email }
   - キャッシュ更新: chrome.storage.local.set({ lastVerification: { tier, expiresAt, verifiedAt: now } })
   - グレース期間チェック:
     - graceEndTime = expiresAt + 72時間
     - now > graceEndTime → 'free' 返却
     - それ以外 → tier 返却

5. APIエラー時（ネットワーク障害等）:
   - キャッシュが存在 AND now < expiresAt:
     → キャッシュされた tier を返却（一時障害耐性）
   - キャッシュなし or 期限切れ:
     → 'free' 返却（フェイルセーフ）

6. 24時間ごとに自動再検証（バックグラウンド）:
   - chrome.alarms.create('license-check', { periodInMinutes: 1440 })
   - 期限切れ検出時にユーザー通知

APIエンドポイント:
POST https://api.diffsnap.io/v1/verify
Content-Type: application/json
Body: { "key": "license-key-string" }
Timeout: 5000ms

レスポンス:
{
  "tier": "pro",
  "expiresAt": 1704067200000,  // Unix timestamp
  "email": "user@example.com"
}

エラーレスポンス:
{
  "error": "INVALID_KEY" | "EXPIRED" | "REVOKED"
}
```

#### 5.11.2 Free制限チェック

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

#### 5.11.3 アップグレード導線

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

