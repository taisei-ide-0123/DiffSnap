# DiffSnap

画像差分監視・収集 Chrome拡張機能

## 開発環境セットアップ

### 必要要件

- Node.js 18+
- pnpm 8+

### インストール

```bash
pnpm install
```

### 開発コマンド

```bash
# 開発ビルド（ウォッチモード）
pnpm dev

# 本番ビルド
pnpm build

# ESLint実行
pnpm lint

# Prettier実行
pnpm format

# Prettierチェック
pnpm format:check

# Vitest実行
pnpm test

# Vitestカバレッジ
pnpm test:coverage

# 全チェック実行
pnpm check:full
```

### Chrome拡張機能として読み込み

1. `pnpm dev` または `pnpm build` を実行
2. Chrome で `chrome://extensions` を開く
3. 「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `dist` ディレクトリを選択

## プロジェクト構成

```
src/
├── popup/          # ポップアップUI
├── settings/       # 設定画面
├── background/     # バックグラウンドサービスワーカー
├── content/        # コンテンツスクリプト
└── shared/         # 共有コード
    ├── types/      # 型定義
    └── utils/      # ユーティリティ関数
```

## 技術スタック

- Vite 5.x - ビルドツール
- React 18 - UIフレームワーク
- TypeScript 5.3+ - 型安全性
- Tailwind CSS 3.x - スタイリング
- Zustand 4.x - 状態管理
- Vitest - テストフレームワーク

## ドキュメント

詳細な仕様は [`CLAUDE.md`](./CLAUDE.md) と [`docs/specs/`](./docs/specs/) を参照してください。

## ライセンス

MIT