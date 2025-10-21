# DiffSnap テスト要件

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション7

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

#### 7.2.1 テストサイト（段階的拡張: MVP 5サイト → 安定期 10サイト）

**MVP Phase (Day 0-45): コア5サイト**

| # | サイト種別 | URL | 検証内容 | 期待枚数 | 優先度 |
|---|----------|-----|---------|---------|--------|
| 1 | EC | amazon.com/dp/XXX | 商品画像、srcset | ≥30 | 必須 |
| 2 | ギャラリー | unsplash.com/s/photos/nature | 無限スクロール | ≥50 | 必須 |
| 3 | ニュース | cnn.com/article | CSS background | ≥20 | 必須 |
| 4 | Wiki | wikipedia.org/article | SVG、多言語alt | ≥10 | 必須 |
| 5 | CSP厳格 | github.com/repo | フォールバック | ≥10 | 必須 |

**Pro Phase追加 (Day 46-90): +3サイト**

| # | サイト種別 | URL | 検証内容 | 期待枚数 |
|---|----------|-----|---------|---------|
| 6 | SPA | twitter.com/user | 動的DOM更新 | ≥20 |
| 7 | デザイン | dribbble.com/shots | 高DPI画像 | ≥25 |
| 8 | 動画 | youtube.com/watch | poster抽出 | ≥5 |

**安定期追加 (Day 91-120): +2サイト**

| # | サイト種別 | URL | 検証内容 | 期待枚数 |
|---|----------|-----|---------|---------|
| 9 | ドキュメント | notion.so/page | 埋込画像、Canvas | ≥15 |
| 10 | 管理画面 | dashboard.stripe.com | 認証Cookie | ≥8 |

**理由**:
- MVP: 主要ユースケース5種で85-90%カバー
- 早期リリース優先、完璧主義回避
- 段階的拡張で品質維持とスピード両立

**E2Eテスト安定化戦略（改善版）**:

問題認識:
- 外部サイト依存でテスト脆弱
- サイトUI変更でテスト突然失敗（False Negative）
- レート制限やCAPTCHAでCI/CD不安定

改善策:

1. モックサーバー導入（Pro Phase以降推奨）:

   tests/fixtures/mock-sites/
     ├── amazon-product.html      # 実サイトの簡易再現
     ├── unsplash-gallery.html
     ├── cnn-article.html
     ├── wikipedia-article.html
     └── github-repo.html

   // Playwright でローカルサーバー起動
   test('Amazon-like page', async ({ page }) => {
     await page.goto('http://localhost:3000/fixtures/amazon-product.html');
     // 拡張機能テスト実行
   });

   メリット:
   - 外部依存ゼロ（高速・安定）
   - サイト変更の影響なし
   - CI/CDで確実に実行可能

   デメリット:
   - 実サイトとの乖離リスク
   - メンテナンス必要（年1-2回）

2. テスト階層化（MVP Phase 1推奨）:

   // CI/CD: モックサイト（高速・安定、ブロッキング）
   test.describe('Mock Sites (CI)', () => {
     test('Amazon-like structure', ...);
   });

   // 手動QA: 実サイト（リリース前のみ）
   test.describe('Real Sites (Manual)', () => {
     test.skip('Amazon.com actual', ...);  // CI ではスキップ
   });

   // ナイトリー: 実サイト（失敗許容、通知のみ）
   test.describe('Real Sites (Nightly)', () => {
     test('Amazon.com monitoring', ...);
   });

3. Snapshot テスト併用:

   // 初回実行時にページHTML保存
   const html = await page.content();
   fs.writeFileSync('snapshots/amazon-20250121.html', html);

   // 以降はスナップショットでテスト
   // 月1回、実サイトでスナップショット更新

4. 実装方針:

   MVP Phase 1:
   - 実サイトテスト（5サイト）
   - CI/CDは許容的（失敗してもwarning）
   - 手動QA重視

   Pro Phase:
   - モックサーバー構築
   - CI/CDはモックのみ（ブロッキング）
   - 実サイトはナイトリーへ移行

   安定期:
   - スナップショット自動更新
   - 実サイト変化検知で通知

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

