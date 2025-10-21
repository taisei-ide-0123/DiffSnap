# DiffSnap ドキュメント

このディレクトリには、DiffSnapプロジェクトの技術仕様書が格納されています。

---

## ドキュメント構成

### メインドキュメント

**[`../SPEC.md`](../SPEC.md)** - 技術仕様書（概要版）
- 製品概要とコア価値命題
- 技術制約とアーキテクチャ
- MVP計画概要と成功基準
- 実装時の参照順序

### 詳細仕様（`specs/`）

#### MVP関連

1. **[`specs/mvp-plan.md`](specs/mvp-plan.md)** - MVP計画（Day 0-45）
   - 実装範囲と除外機能
   - 週次スケジュール（Week 1-7）
   - 完了基準とマイルストーン
   - 段階的実装戦略
   - リスクと緩和策

#### 技術仕様

2. **[`specs/data-models.md`](specs/data-models.md)** - データモデル設計
   - IndexedDB構造（DiffSnapDB）
   - chrome.storage設計
   - TypeScript型定義
   - データフロー

3. **[`specs/core-features.md`](specs/core-features.md)** - コア機能仕様
   - 画像検出エンジン（8種類）
   - 収集・並列制御
   - 差分エンジン
   - ZIP生成
   - ファイル名テンプレート

4. **[`specs/ui-ux.md`](specs/ui-ux.md)** - UI/UX仕様
   - Popup UI（プレビュー、進捗）
   - Settings UI
   - 状態管理（Zustand）
   - デザインシステム

#### 品質・運用

5. **[`specs/testing.md`](specs/testing.md)** - テスト要件
   - 単体テスト（Vitest）
   - E2Eテスト（Playwright）
   - テストサイト（5サイト→10サイト）
   - パフォーマンステスト

6. **[`specs/non-functional.md`](specs/non-functional.md)** - 非機能要件
   - パフォーマンス目標
   - セキュリティ要件
   - アクセシビリティ
   - エラーハンドリング

7. **[`specs/deployment.md`](specs/deployment.md)** - デプロイとリリース
   - ビルドプロセス（Vite）
   - リリースフロー
   - Chrome Web Store公開
   - バージョニング

8. **[`specs/monitoring.md`](specs/monitoring.md)** - 監視とメンテナンス
   - テレメトリ設計
   - メトリクス収集
   - エラー追跡
   - ユーザーフィードバック

#### 開発プロセス

9. **[`specs/workflows.md`](specs/workflows.md)** - 開発ワークフロー
   - Git ブランチ戦略
   - コミット規約
   - コードレビュー基準
   - 品質チェック

#### 将来計画

10. **[`specs/future-phases.md`](specs/future-phases.md)** - 次フェーズ計画
    - Phase 2: Pro拡張機能（Day 91-150）
    - Phase 3: Team機能（Day 151-240）
    - 拡張可能性

---

## 推奨読み順（AIエージェント向け）

### 初回実装時

1. **[`../SPEC.md`](../SPEC.md)** - 全体像の理解
2. **[`specs/mvp-plan.md`](specs/mvp-plan.md)** - 開発スケジュールと優先度
3. **[`specs/data-models.md`](specs/data-models.md)** - 型定義とデータ構造
4. **[`specs/core-features.md`](specs/core-features.md)** - 機能実装詳細
5. **[`specs/workflows.md`](specs/workflows.md)** - 開発手順

### 機能追加時

1. **該当する仕様ファイル** - 機能詳細の確認
2. **[`specs/testing.md`](specs/testing.md)** - テスト要件
3. **[`specs/mvp-plan.md`](specs/mvp-plan.md)** - MVP範囲の確認

### デバッグ・最適化時

1. **[`specs/non-functional.md`](specs/non-functional.md)** - 性能目標
2. **[`specs/monitoring.md`](specs/monitoring.md)** - メトリクス定義
3. **[`specs/testing.md`](specs/testing.md)** - テストケース

### リリース準備時

1. **[`specs/deployment.md`](specs/deployment.md)** - リリースプロセス
2. **[`specs/mvp-plan.md`](specs/mvp-plan.md)** - 完了基準
3. **[`specs/testing.md`](specs/testing.md)** - 回帰テスト

---

## ドキュメント更新ルール

### 更新タイミング

- **仕様変更時**: 即座に該当ファイルを更新
- **実装完了時**: 実装結果を仕様に反映（乖離防止）
- **リリース時**: バージョン番号と更新日を更新

### 更新方針

- **SPEC.md**: 概要のみ。詳細は分割ファイルに記載
- **分割ファイル**: 実装アルゴリズムと仕様のみ（コード例は含めない）
- **コミットメッセージ**: `docs: [ファイル名] 変更内容`

### 矛盾発見時

1. GitHub Issueを作成
2. 該当箇所を明示
3. 修正提案を記載

---

## ファイルサイズ制限

各ファイルは **2000行以内** を目安とする。

- 現在のSPEC.md: 約300行（✅ OK）
- 分割ファイル: 200-1000行（✅ OK）

大きくなりすぎた場合はさらに分割を検討。

---

## 関連リンク

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Vite Documentation](https://vitejs.dev/)
- [React 18 Documentation](https://react.dev/)
- [Playwright for Chrome Extensions](https://playwright.dev/docs/chrome-extensions)
- [IndexedDB Best Practices](https://web.dev/indexeddb-best-practices/)
