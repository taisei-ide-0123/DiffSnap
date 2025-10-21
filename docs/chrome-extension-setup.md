# Chrome拡張機能としての読み込み手順

## 前提条件

プロジェクトをビルドする必要があります：

```bash
pnpm install  # 初回のみ
pnpm build    # または pnpm dev
```

## 手順

### 1. Chrome拡張機能ページを開く

以下のいずれかの方法で開きます：
- アドレスバーに `chrome://extensions` を入力
- メニュー → その他のツール → 拡張機能

### 2. デベロッパーモードを有効化

右上の「デベロッパーモード」トグルをONにします。

### 3. 拡張機能を読み込む

1. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリック
2. プロジェクトの `dist` ディレクトリを選択
3. 「フォルダーの選択」をクリック

### 4. 拡張機能の確認

- 拡張機能リストに「DiffSnap」が表示されることを確認
- エラーがないことを確認
- ツールバーにアイコンが表示される（現在はデフォルトアイコン）

## トラブルシューティング

### エラー: "Manifest file is missing or unreadable"

- `dist/manifest.json` が存在することを確認
- `pnpm build` を再実行

### エラー: "Could not load background script"

- `dist/background/index.js` が存在することを確認
- TypeScriptコンパイルエラーがないか確認：`pnpm build`

### エラー: "Could not load content script"

- `dist/content/index.js` が存在することを確認
- TypeScriptコンパイルエラーがないか確認：`pnpm build`

### ポップアップが表示されない

1. ツールバーのDiffSnapアイコンをクリック
2. エラーがコンソールに表示されていないか確認
3. `dist/src/popup/index.html` が存在することを確認

## 開発時のワークフロー

### ウォッチモードで開発

```bash
pnpm dev
```

このコマンドでファイル変更を監視し、自動的に再ビルドします。

### 変更を反映

1. コードを変更
2. `pnpm dev` が自動的に再ビルド（またはpnpm buildを手動実行）
3. Chrome拡張機能ページで「更新」ボタンをクリック
   - または拡張機能のIDの右にある回転矢印アイコンをクリック
4. 必要に応じてブラウザをリロード

### デバッグ

#### バックグラウンドサービスワーカー
1. 拡張機能リストの「Service Worker」リンクをクリック
2. DevToolsが開き、console.logが表示される

#### コンテンツスクリプト
1. 任意のWebページを開く
2. F12でDevToolsを開く
3. Consoleタブで「DiffSnap content script loaded」メッセージを確認

#### ポップアップ
1. ポップアップを開く
2. ポップアップ内で右クリック → 検証
3. DevToolsが開き、Reactコンポーネントを検証可能

## 次のステップ

拡張機能の読み込みが成功したら：

1. ポップアップUIの動作確認
2. バックグラウンドとコンテンツスクリプトの通信確認
3. 画像検出機能の実装開始

## 参照

- [Chrome Extension Development Basics](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
