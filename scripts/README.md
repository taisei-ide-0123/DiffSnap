# DiffSnap Development Scripts

DiffSnap プロジェクトの品質チェックと開発支援スクリプト集です。

## スクリプト一覧

### 1. check-size.sh - ビルド成果物サイズ確認

ビルドされた拡張機能のファイルサイズを確認し、閾値を超えていないかチェックします。

```bash
# 直接実行
./scripts/check-size.sh

# pnpm経由
pnpm check:size
```

**チェック項目:**
- Content Script: 100KB以下
- Background Script: 200KB以下
- Popup UI: 150KB以下
- Settings UI: 150KB以下
- 拡張機能全体: 1MB以下

**出力:**
- ✅ 各ファイルのサイズと閾値との比較
- 📊 最大サイズのファイルトップ10
- ⚠️ 閾値超過の警告

### 2. validate-manifest.sh - manifest.json検証

Chrome拡張機能のmanifest.jsonが正しく設定されているか検証します。

```bash
# 直接実行
./scripts/validate-manifest.sh

# pnpm経由
pnpm check:manifest
```

**検証項目:**
- JSON構文の正当性
- 必須フィールドの存在確認
- Manifest V3準拠の確認
- Permissions設定の確認
- Content Scripts設定の確認
- Background Service Worker設定の確認
- 参照ファイルの存在確認（dist/ディレクトリ内）

**要件:**
- `jq` コマンドがインストールされていると詳細な検証が可能
- インストールされていない場合は基本的な検証のみ実行

### 3. run-e2e.sh - E2Eテスト実行

Playwrightを使用したE2Eテストを実行します（MVP Week 6で実装予定）。

```bash
# 直接実行
./scripts/run-e2e.sh [options]

# pnpm経由
pnpm test:e2e
pnpm test:e2e:ui  # UIモード
```

**オプション:**
```bash
--ui          # UIモードで実行（インタラクティブ）
--debug       # デバッグモードで実行（ヘッドあり + スローモーション）
--headed      # ヘッドありモードで実行（ブラウザを表示）
--grep TEXT   # パターンマッチでテストをフィルタ
-h, --help    # ヘルプを表示
```

**使用例:**
```bash
# すべてのテストをヘッドレスで実行
./scripts/run-e2e.sh

# UIモードで実行
./scripts/run-e2e.sh --ui

# popupテストのみ実行
./scripts/run-e2e.sh --grep "popup"

# デバッグモードで実行
./scripts/run-e2e.sh --debug
```

**注意:**
- Playwrightがインストールされていない場合は案内メッセージを表示
- MVP Week 6で本格的に実装予定

### 4. release.sh - リリースZIP生成

Chrome Web Store提出用のZIPファイルを生成します。

```bash
# 直接実行
./scripts/release.sh [options]

# pnpm経由
pnpm release
```

**オプション:**
```bash
--skip-build   # ビルドをスキップ（既存のdist/を使用）
--skip-tests   # テストをスキップ
--output DIR   # 出力ディレクトリを指定（デフォルト: release/）
-h, --help     # ヘルプを表示
```

**実行手順:**
1. manifest.jsonの検証
2. テスト実行（オプション）
3. 拡張機能のビルド（オプション）
4. バンドルサイズチェック
5. releaseディレクトリ作成
6. ZIPファイル生成

**使用例:**
```bash
# フルビルド（テストあり）
./scripts/release.sh

# クイックビルド（テストなし）
./scripts/release.sh --skip-tests

# 既存のdist/をパッケージ
./scripts/release.sh --skip-build

# 出力先を変更
./scripts/release.sh --output ./build
```

**出力:**
- `release/diffsnap-v0.1.0.zip` - 配布用ZIPファイル
- ZIPファイルのサイズと内容リスト
- Chrome Web Store提出の手順案内

## 統合実行

### check:full - 全チェック実行

すべての品質チェックを一括実行します。

```bash
pnpm check:full
```

**実行内容:**
1. ESLint（コード品質チェック）
2. Prettier（フォーマットチェック）
3. Vitest（単体テスト実行）
4. TypeScript + Vite（ビルド）
5. manifest.json検証
6. バンドルサイズチェック

**CI/CD統合:**
このコマンドはGitHub Actionsなどでの自動実行に適しています。

## 開発ワークフロー

### 日常開発

```bash
# 開発サーバー起動
pnpm dev

# コード変更後
pnpm lint
pnpm format
pnpm test

# ビルド確認
pnpm build
pnpm check:size
```

### コミット前

```bash
# すべてのチェックを実行
pnpm check:full
```

### リリース前

```bash
# フルチェック
pnpm check:full

# E2Eテスト実行
pnpm test:e2e

# リリースZIP生成
pnpm release
```

## トラブルシューティング

### jqがインストールされていない

manifest.jsonの詳細検証にはjqが必要です。インストールしていない場合は基本的な検証のみ行われます。

```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq
```

### bcがインストールされていない

サイズ計算にはbcが必要です。

```bash
# Ubuntu/Debian
sudo apt-get install bc

# macOS
brew install bc
```

### スクリプトに実行権限がない

```bash
chmod +x scripts/*.sh
```

### dist/ディレクトリが存在しない

```bash
# ビルドを実行
pnpm build
```

## スクリプトの拡張

新しいチェックスクリプトを追加する場合：

1. `scripts/`ディレクトリにシェルスクリプトを作成
2. 実行権限を付与: `chmod +x scripts/your-script.sh`
3. `package.json`の`scripts`セクションに追加
4. このREADMEに使用方法を記載

## ライセンス

このスクリプト集はDiffSnapプロジェクトの一部です。
