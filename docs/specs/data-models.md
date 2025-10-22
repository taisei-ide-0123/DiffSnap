# DiffSnap データモデル設計

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション4

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
  queryHash: string             // SHA-256(sortedQueryString)の32桁（128ビット）
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

