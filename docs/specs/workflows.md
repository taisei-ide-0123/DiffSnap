# DiffSnap 開発ワークフロー

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション12

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

### 12.3 品質チェックスクリプト（個人開発最適化）

**方針**: CI/CDは不要、ローカルスクリプトで同等の品質担保

```
package.json scripts設定:

{
  "scripts": {
    // 開発用
    "dev": "vite",
    "build": "vite build",

    // 品質チェック（個別）
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css}\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",

    // 統合チェック（リリース前実行）
    "check": "pnpm lint && pnpm typecheck && pnpm test",
    "check:full": "pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e",

    // リリースワークフロー
    "prebuild": "pnpm check",
    "release": "pnpm check:full && pnpm build && pnpm zip",
    "zip": "node scripts/create-release-zip.js"
  }
}

主要スクリプト:

1. scripts/create-release-zip.js
   目的: dist/ を Chrome Web Store用ZIPに圧縮

   処理:
   - manifest.json のバージョン読み取り
   - diffsnap-v{version}.zip 生成
   - 不要ファイル除外（.map, .DS_Store等）
   - サイズ検証（>10MBで警告）
   - SHA-256ハッシュ生成（検証用）

2. scripts/validate-manifest.js
   目的: manifest.json の整合性チェック

   検証項目:
   - 必須フィールド存在確認
   - バージョン形式（semver）
   - 権限の妥当性
   - アイコンファイル存在
   - content_scripts パス確認

3. scripts/check-bundle-size.js
   目的: ビルドサイズ監視

   処理:
   - dist/ 各ファイルサイズ計測
   - 前回ビルドとの差分表示（.bundle-size.json保存）
   - 閾値超過で警告:
     - background.js: >150KB
     - content.js: >100KB
     - popup.js: >300KB
   - 合計 >500KB で警告

4. scripts/pre-commit.sh（任意、git hooks用）
   目的: コミット前の自動チェック

   処理:
   - pnpm lint（staged filesのみ）
   - pnpm typecheck
   - テストは省略（高速化）

開発ワークフロー:

日常開発:
1. コード変更
2. pnpm dev で動作確認
3. git commit（自動で pre-commit hook実行）

リリース前:
1. pnpm check:full（全テスト実行、5-10分）
2. 手動QA（実サイトで動作確認）
3. pnpm release（check + build + zip）
4. Chrome Web Storeへ手動アップロード

メリット（個人開発）:
✅ コスト: 完全無料（GitHub Actions不要）
✅ シンプル: スクリプト4つのみ、理解容易
✅ 高速: ローカル実行、待機なし
✅ 柔軟: 必要に応じてスキップ可能
✅ 学習コスト: pnpm scriptsの基礎知識のみ

デメリット:
❌ 自動化度: 手動実行必須（忘れるリスク）
❌ 履歴: CIダッシュボードなし（ローカルログのみ）

対策:
- pre-commit hook で最低限の品質担保
- リリースチェックリスト作成（RELEASE.md）
- 重要: pnpm release を必ず実行する習慣化

Phase 2以降（必要に応じて）:
- GitHub Actions追加（無料枠で十分）
- プルリクエスト時のみ自動実行
- main ブランチ保護
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

