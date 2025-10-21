# DiffSnap UI/UX仕様

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション6

---

## 6. UI/UX仕様

### 6.1 Popup UI（拡張ポップアップ）

#### 6.1.1 レイアウト仕様

```
サイズ: 幅384px × 高さ600px

構成:
┌─────────────────────────────┐
│ Header                       │
│ - ロゴ + タイトル             │
│ - 検出画像数表示              │
│ - (Pro) Tier バッジ          │
├─────────────────────────────┤
│ Main Content (動的)          │
│                              │
│ [idle] プレビューグリッド     │
│ [processing] 進捗バー         │
│ [complete] 差分表示           │
│                              │
│ (スクロール可能)              │
├─────────────────────────────┤
│ Footer                       │
│ - アクションボタン            │
│ - 設定リンク                  │
└─────────────────────────────┘
```

#### 6.1.2 状態遷移

```
状態マシン:

idle (初期状態)
  → ユーザー: "Download All" クリック
  → detecting

detecting (画像検出中)
  → 自動: 検出完了
  → fetching

fetching (画像取得中)
  → 自動: 全fetch完了
  → zipping

zipping (ZIP生成中)
  → 自動: ZIP完了
  → complete

complete (完了)
  → ユーザー: "Close" or 再実行
  → idle

error (エラー)
  → ユーザー: "Retry" or "Close"
  → idle or fetching
```

#### 6.1.3 プレビューグリッド

```
グリッド仕様:

レイアウト: 3列 × N行
アスペクト比: 1:1 (正方形)
最大表示: 100枚（それ以上は仮想スクロール）
遅延読込: IntersectionObserver使用

各カード:
- サムネイル画像（object-fit: cover）
- オーバーレイ情報（hover時）:
  - サイズ表示（WxH）
  - altテキスト（存在する場合）
- (Pro) 新規バッジ（差分検出時）
```

#### 6.1.4 進捗表示

```
進捗UI要素:

1. プログレスバー
   - 幅: 100%
   - 高さ: 8px
   - 色: Blue (#3B82F6)
   - アニメーション: スムーズ遷移（transition: 0.3s）

2. テキスト情報
   - ステータス: "Detecting images..." / "Fetching..." / "Creating ZIP..."
   - カウンタ: "42 / 100"
   - パーセンテージ: "42%"

3. 失敗リスト（エラー時のみ）
   - 最大高さ: 128px（スクロール可能）
   - 各エラー: URL（50文字） + 理由
   - 再試行ボタン
```

#### 6.1.5 差分表示（Pro機能）

```
差分UI:

Free Tier:
- 新規画像数を表示
- 「Proにアップグレード」バナー
- 全画像ダウンロード（差分抽出なし）

Pro Tier:
- 2列表示:
  - 左: 新規画像（緑枠、NEWバッジ）
  - 右: 既存画像（グレーアウト、EXISTINGラベル）
- 統計情報:
  - "X new images found"
  - "Y existing images"
- アクション:
  - 「Download New Only」（新規のみ）
  - 「Download All」（全画像）
```

### 6.2 Settings UI（設定ページ）

#### 6.2.1 設定項目

```
設定セクション:

1. Account（アカウント）
   - Tier表示: Free or Pro
   - License Key入力欄（Pro）
   - "Upgrade to Pro" ボタン（Free）

2. Naming Template（命名テンプレート）
   - プリセット選択（5種類）
   - カスタムテンプレート入力
   - プレビュー表示（リアルタイム）
   - 変数リファレンス

3. Domain Profiles（ドメインプロファイル）
   - プロファイルリスト
   - 追加/編集/削除ボタン
   - 各プロファイル:
     - Domain
     - Include Pattern (正規表現)
     - Exclude Pattern (正規表現)
     - Min Width (ピクセル)

4. Advanced（詳細設定）
   - 自動スクロール有効/無効
   - 最大スクロール深度
   - タイムアウト設定
   - データクリーンアップ（手動実行）
```

#### 6.2.2 テンプレートプレビュー

```
プレビュー機能:

入力: テンプレート文字列
出力: サンプルファイル名（3例）

サンプルデータ:
- date: 今日の日付
- domain: example.com
- w: 800, h: 600
- alt: Sample Image
- index: 001, 002, 003

リアルタイム更新:
- 入力のたびにデバウンス（300ms）
- 無効な変数は赤字表示
```

#### 6.2.3 ドメインプロファイル編集

```
プロファイル編集UI:

モーダルダイアログ:
┌────────────────────────────┐
│ Edit Domain Profile         │
├────────────────────────────┤
│ Domain: [example.com      ] │
│                             │
│ Include Pattern (regex):    │
│ [/products/.*              ]│
│                             │
│ Exclude Pattern (regex):    │
│ [.*thumbnail.*             ]│
│                             │
│ Min Width (px):             │
│ [800                       ]│
│                             │
│ [Test Pattern] [Cancel] [Save]│
└────────────────────────────┘

正規表現テスト機能:
- サンプルURL入力
- マッチ/非マッチを即座表示
```

### 6.3 アクセシビリティ

```
アクセシビリティ要件:

1. キーボード操作
   - Tab順序: 論理的な順序
   - Enter/Space: ボタン実行
   - Esc: モーダルクローズ

2. スクリーンリーダー
   - aria-label: すべての画像・ボタン
   - aria-live: 進捗状態の変化
   - role属性: 意味的マークアップ

3. コントラスト
   - テキスト: WCAG AA準拠（4.5:1以上）
   - インタラクティブ要素: 3:1以上

4. フォーカス表示
   - outline: 明確な視覚的フィードバック
   - focus-visible: キーボード操作時のみ表示
```

---

