# DiffSnap 技術仕様書 v1.3

**対象**: AIコーディングエージェント
**更新日**: 2025-10-21
**バージョン**: 1.3 (個人開発最適化版)
**プロジェクト期間**: 120-150日（MVP: 0-45日、Pro: 46-90日、安定化: 91-120日、予備: 121-150日）

---

## ドキュメント構成

このSPEC.mdは概要のみを記載しています。詳細仕様は以下を参照：

- **MVP計画**: [`docs/specs/mvp-plan.md`](docs/specs/mvp-plan.md) - 45日間の開発スケジュールと実装戦略
- **データモデル**: [`docs/specs/data-models.md`](docs/specs/data-models.md) - IndexedDB、型定義
- **コア機能**: [`docs/specs/core-features.md`](docs/specs/core-features.md) - 検出、収集、差分、ZIP生成
- **UI/UX**: [`docs/specs/ui-ux.md`](docs/specs/ui-ux.md) - Popup、Settings、プレビュー
- **テスト**: [`docs/specs/testing.md`](docs/specs/testing.md) - 単体テスト、E2E、ベンチマーク
- **非機能要件**: [`docs/specs/non-functional.md`](docs/specs/non-functional.md) - パフォーマンス、セキュリティ
- **デプロイ**: [`docs/specs/deployment.md`](docs/specs/deployment.md) - ビルド、リリースプロセス
- **監視**: [`docs/specs/monitoring.md`](docs/specs/monitoring.md) - メトリクス、テレメトリ
- **ワークフロー**: [`docs/specs/workflows.md`](docs/specs/workflows.md) - Git、コミット規約
- **次フェーズ**: [`docs/specs/future-phases.md`](docs/specs/future-phases.md) - Phase 2/3計画

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

### 1.4 事業目標（調整版: 現実的目標値）
- Free→Pro転換率: ≥2-3%/60日（業界平均、差別化により5%目標）
- 月実行回数中央値: ≥2回（MVP初期）→ ≥4回（安定期）
- 120日継続率: ≥35%（Pro、初期チャーン考慮）

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

### 3.2 コーディング規約

#### モダンJavaScript/TypeScript原則

**関数定義**:
- アロー関数を優先（`const myFunc = () => {}`）
- トップレベルのReactコンポーネントも`export const Component = () => {}`形式
- コールバック、ユーティリティ関数は必ずアロー関数

**非同期処理**:
- `async/await` を優先（Promiseチェーンは避ける）
- `try/catch` で明示的なエラーハンドリング

**分割代入**:
- オブジェクト・配列の分割代入を積極的に使用
- 関数引数も分割代入を活用

**テンプレートリテラル**:
- 文字列結合は`+`ではなくバッククォート`` `${var}` ``を使用

**オプショナルチェーン**:
- `?.` と `??` を活用してnullチェックを簡潔に

**スプレッド構文**:
- 配列・オブジェクトのコピーや結合に`...`を使用

**constの優先**:
- デフォルトは`const`、再代入が必要な場合のみ`let`
- `var`は使用禁止

**セミコロン**:
- セミコロンなし（Prettierで`"semi": false`設定）
- ASI（Automatic Semicolon Insertion）に依存

### 3.3 モジュール構成

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

### 3.4 通信フロー

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

## 4. MVP計画（Day 0-45）

### 4.1 実装範囲

**検出対象（5種類）**: `<img>`, `<picture>`, `srcset`, CSS背景, `<canvas>`
**テストサイト（5サイト）**: Amazon, Unsplash, CNN, Wikipedia, GitHub
**除外機能**: SVG/Data URL/WebGL、OCR、タブ一括、後処理、Team機能

詳細: [`docs/specs/mvp-plan.md`](docs/specs/mvp-plan.md)

### 4.2 週次スケジュール概要

- **Week 1-2**: 基盤・検出エンジン
- **Week 3**: 収集・並列制御
- **Week 4**: UI・基本フロー
- **Week 5**: Pro機能・ZIP
- **Week 6**: テスト・最適化
- **Week 6-7**: リリース準備

### 4.3 完了基準（Day 45）

技術:
- [ ] 5サイト検出率 85-90%
- [ ] 100枚処理 P50 ≤10秒
- [ ] クラッシュ率 <2%

公開:
- [ ] Chrome Web Store審査通過
- [ ] ストア評価 ≥3.5（5レビュー以上）

ユーザー（初月）:
- [ ] DAU 10-30
- [ ] 週実行回数中央値 ≥1-2
- [ ] 初回→2回目実行 ≥40%

---

## 5. 成功基準

### 5.1 Pro成功指標（Day 90）

技術:
- [ ] 8サイト検出率 90-95%
- [ ] 差分検出精度 100%
- [ ] Pro機能クラッシュ率 <1%

事業:
- [ ] Pro契約 30-50件（初回60日）
- [ ] Free→Pro転換率 ≥2-3%
- [ ] チャーン率 <20%（月次）

ユーザー:
- [ ] DAU 100-200
- [ ] Pro DAU 5-15
- [ ] NPS ≥30

### 5.2 安定化成功指標（Day 120）

技術:
- [ ] 10サイト回帰テスト ≥95%
- [ ] クラッシュ率 <0.5%
- [ ] カバレッジ ≥80%

事業:
- [ ] MRR $500-1,000
- [ ] Pro契約 60-100件
- [ ] Pro継続率 ≥70%（30日）
- [ ] ストア評価 ≥4.0（20-30レビュー）

運用:
- [ ] 監視ダッシュボード稼働
- [ ] 週次メトリクスレビュー
- [ ] CI/CD完全自動化

---

## 6. 次フェーズ計画

### Phase 2: Pro拡張機能（Day 91-150）
- OCR/全文検索
- タブ一括処理
- 後処理パイプライン（WebP変換等）
- 高度なフィルタ（pHash、顔検出）

条件: MVP黒字化、Proユーザー100+、NPS ≥50

### Phase 3: Team機能（Day 151-240）
- 共有コレクション
- クラウド連携（S3、Google Drive）
- 権限管理
- Enterprise機能（SSO、DLP）

条件: Pro MRR $10k+、Team需要検証（50+リクエスト）

詳細: [`docs/specs/future-phases.md`](docs/specs/future-phases.md)

---

## 7. 実装時の参照順序

AIコーディングエージェント向け推奨フロー:

1. **このSPEC.md**: 全体像の理解
2. **[`docs/specs/mvp-plan.md`](docs/specs/mvp-plan.md)**: 開発スケジュールと優先度
3. **[`docs/specs/data-models.md`](docs/specs/data-models.md)**: 型定義とデータ構造
4. **[`docs/specs/core-features.md`](docs/specs/core-features.md)**: 機能実装詳細
5. **[`docs/specs/ui-ux.md`](docs/specs/ui-ux.md)**: UI実装
6. **[`docs/specs/testing.md`](docs/specs/testing.md)**: テスト作成
7. **[`docs/specs/workflows.md`](docs/specs/workflows.md)**: 開発手順

### 重要原則
- コード例は含まれていない（意図的）
- アルゴリズムと仕様のみ記述
- 実装判断はエージェントに委任
- 疑問点は GitHub Issues で質問

---

## 8. リスク管理

主要リスク:

| リスク | 確率 | 影響 | 緩和策 |
|-------|------|------|--------|
| スコープクリープ | 高 | 高 | MVP範囲厳守、Phase 2機能は即座に却下 |
| E2Eテスト不安定 | 高 | 中 | モックサイト追加、リトライロジック |
| パフォーマンス未達 | 中 | 高 | 早期ベンチマーク、段階的最適化 |
| ストア審査遅延 | 中 | 中 | 早期提出（Day 40）、並行開発 |

---

## 付録

### 用語集

- **ImageCandidate**: 検出された画像の候補オブジェクト。URLと要素メタデータを含む
- **ImageSnapshot**: 差分台帳に保存される画像の記録。ハッシュとメタデータ
- **DiffRecord**: 特定URLに対する訪問履歴と画像スナップショットの集合
- **recordId**: 差分台帳のレコードを一意に識別するキー（origin+pathname+queryHashから生成）
- **Lazy Loading**: 遅延読込。スクロール時に画像URLが確定するパターン

### 参考資料

Chrome拡張開発:
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)

パフォーマンス:
- [Web Performance Metrics](https://web.dev/metrics/)
- [IndexedDB Best Practices](https://web.dev/indexeddb-best-practices/)

アクセシビリティ:
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
