# DiffSnap 非機能要件

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション8

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

#### 8.2.1 最適化方針（メモリ管理詳細化）

```
最適化項目:

1. メモリ管理（保守的戦略、誤差を見込む）:

   a. Blob即座破棄:
      - fetch完了後、ハッシュ計算完了したら即座破棄
      - URL.revokeObjectURL() を 60秒後に呼び出し
      - WeakMap でBlob参照追跡

   b. メモリプール管理（改善版: 誤差対策）:

      問題認識:
      - performance.memory.usedJSHeapSize はJSオブジェクトのみ計測
      - Blobはネイティブメモリ（C++層）で実際の消費量不明
      - 推定誤差 30-50%（実測より過小評価）

      保守的リミット設定:
      - ソフトリミット: 256MB → 150MB（50%安全マージン）
      - ハードリミット: 256MB → 200MB（確実な安全圏）
      - 理由: 誤差を見込んで早めに警告・制限

      メモリ推定式（改善版）:
      function estimateMemoryUsage(): number {
        let estimate = 0;

        // 1. JSヒープメモリ（正確）
        if (performance.memory) {
          estimate += performance.memory.usedJSHeapSize;
        }

        // 2. Blobメモリ（推定、2倍の安全係数）
        const blobSize = Array.from(activeBlobs.values())
          .reduce((sum, blob) => sum + blob.size, 0);
        estimate += blobSize * 2;  // 2倍で過大評価し安全側へ

        // 3. その他固定オーバーヘッド
        estimate += 50 * 1024 * 1024;  // 50MB（React、Zustand等）

        return estimate;
      }

      実測データ収集（開発モード）:
      - 10枚、50枚、100枚処理時の実メモリをログ
      - タスクマネージャの値と推定値を比較
      - 誤差パターンを分析し係数調整

   c. 処理分割（大量画像対策、実用的アプローチ）:

      代替案: メモリ推定を諦め、処理量で制限（シンプル・確実）

      const MAX_CONCURRENT_IMAGES = 50;  // 同時処理上限
      const MAX_SINGLE_IMAGE_SIZE = 20MB; // 個別上限

      チャンク処理:
      for (let i = 0; i < candidates.length; i += MAX_CONCURRENT_IMAGES) {
        const chunk = candidates.slice(i, i + MAX_CONCURRENT_IMAGES);
        await processChunk(chunk);
        // 強制GC待機
        await sleep(100);
      }

      メリット:
      - メモリ推定不要（計測誤差の影響なし）
      - シンプルで確実
      - 50枚 × 平均2MB = 100MB程度（安全圏）

   d. メモリ圧迫時の動的調整（推定使用時）:
      - 推定値 > 150MB → 並列数 8 → 4 に削減
      - 推定値 > 170MB → 並列数 4 → 2 に削減
      - 推定値 > 190MB → 処理一時停止、ユーザー通知

   e. 大容量画像対策:
      - 個別Blob > 10MB で警告ログ
      - 個別Blob > 20MB でスキップ（ZIP容量・メモリ考慮）
      - 累積ZIP > 800MB で「残り画像は個別DL推奨」通知

   f. 推奨実装方針（MVP Phase 1）:
      - メモリ推定は参考値として使用
      - 主制御: 処理量制限（MAX_CONCURRENT_IMAGES）
      - Phase 2: 実測データで推定式チューニング

2. ネットワーク最適化:
   - 並列制御（8並列、メモリ圧迫時は動的削減）
   - ドメイン別レート制限（2/domain）
   - タイムアウト設定（30秒）
   - リトライ戦略: 3回まで、指数バックオフ（2s, 4s, 8s）

3. UI応答性:
   - 長時間処理のWebWorker化（Phase 2検討）
   - プログレッシブレンダリング（10枚ごとにUI更新）
   - 仮想スクロール（100枚以上でreact-window使用）

4. IndexedDB最適化:
   - インデックス活用（domain, lastScanAt）
   - トランザクションバッチ化（100件ごと）
   - 定期クリーンアップ（起動時 + 週1回）
   - 圧縮検討（Phase 2: LZ4圧縮でストレージ50%削減）

5. パフォーマンス計測:
   - performance.mark/measure 使用
   - 各フェーズの処理時間計測
   - メモリスナップショット（開発モード）
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

### 8.4 パフォーマンスプロファイリング（新規追加）

```
開発時の計測ポイント:

1. Chrome DevTools Performance:
   - 記録開始: 収集開始ボタンクリック
   - 記録終了: ZIP完了
   - 確認項目:
     - Long Task（50ms超のブロッキング処理）
     - FPS低下（60fps未満の箇所）
     - メモリリーク（Heap Snapshot比較）

2. Performance API使用:

   コード挿入箇所:
   performance.mark('detection-start')
   // 画像検出処理
   performance.mark('detection-end')
   performance.measure('detection', 'detection-start', 'detection-end')

   計測フェーズ:
   - detection: Content Scriptでの画像検出
   - fetch-all: 全画像の並列fetch
   - hash-computation: SHA-256ハッシュ計算
   - diff-check: 差分台帳との比較（Pro）
   - zip-creation: ZIP生成
   - total: 開始→完了まで

3. メモリプロファイリング:

   開発モードで有効化:
   if (process.env.NODE_ENV === 'development'):
     setInterval(() => {
       const memory = performance.memory
       console.log({
         used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
         total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
         limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
       })
     }, 1000)

4. ビルドサイズ目標:

   最終dist/サイズ:
   - manifest.json: <5KB
   - background.js: <150KB（gzip後）
   - content.js: <100KB（gzip後）
   - popup.html + React: <300KB（gzip後）
   - 合計: <500KB（未圧縮時 <1.5MB）

   最適化施策:
   - Tree shaking有効化
   - React Production Build
   - Code splitting（Popup/Settings別バンドル）
   - Lucide Reactアイコンの選択的インポート

5. E2Eパフォーマンステスト:

   Playwright計測:
   const startTime = Date.now()
   await page.click('[data-testid="download-all"]')
   await page.waitForSelector('[data-testid="download-complete"]')
   const duration = Date.now() - startTime
   expect(duration).toBeLessThan(10000) // P50 目標

6. 継続的監視:

   CI/CDでの自動計測:
   - pnpm build 時にバンドルサイズレポート生成
   - 前回ビルドとの差分表示
   - 10%以上増加でwarning
```

### 8.5 ブラウザAPI依存リスク（新規追加）

```
Chrome独自API使用箇所と将来の移植性:

1. chrome.storage:
   使用箇所: 設定保存、差分台帳（IndexedDB）、セッション状態
   Firefox互換: browser.storage（ほぼ同一API）
   Safari互換: 未対応（代替: localStorage + IndexedDB）

   対策: 薄いラッパー層
   interface StorageAdapter {
     get(key: string): Promise<any>
     set(key: string, value: any): Promise<void>
   }

2. chrome.downloads:
   使用箇所: ZIP保存
   Firefox互換: browser.downloads
   Safari互換: 未対応（代替: <a download>）

   対策: ダウンロード抽象化
   async function downloadFile(blob, filename) {
     if (chrome?.downloads) {
       // Chrome/Firefox
     } else {
       // Safari fallback: <a> trigger
     }
   }

3. chrome.scripting:
   使用箇所: Content Script注入
   Firefox互換: browser.scripting（MV3対応後）
   Safari互換: safari.extension（API差異大）

   対策: 注入ロジックの抽象化（Phase 3）

4. chrome.runtime:
   使用箇所: メッセージング、Keep-Alive
   Firefox互換: browser.runtime
   Safari互換: safari.runtime（部分対応）

   対策: 現状Chrome優先、移植時に抽象化

推奨アプローチ:
- MVP: Chrome専用実装（高速開発）
- Phase 2: Firefox対応準備（抽象化層追加）
- Phase 3: Firefox正式対応（MV3安定後）
- Safari: 需要次第（API差異大きく優先度低）
```

### 8.6 国際化（将来対応）

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

