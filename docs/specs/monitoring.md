# DiffSnap 監視とメンテナンス

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション10

---

## 10. 監視とメンテナンス

### 10.1 テレメトリ

#### 10.1.1 収集イベント

```
匿名イベント（オプトアウト可）:

実行イベント:
- run_start: 収集開始
- run_end: 収集完了
- run_error: エラー発生

属性:
- imageCount: 画像枚数
- processingTime: 処理時間（ms）
- hasDiff: 差分検出の有無（Pro）
- failedCount: 失敗画像数
- zipSize: ZIPサイズ（MB）
- version: 拡張バージョン

UI イベント:
- upgrade_prompt_shown: アップグレード表示
- upgrade_prompt_clicked: クリック
- settings_opened: 設定画面表示
- template_changed: テンプレート変更

エラーイベント:
- error: { type, message, url? }
```

#### 10.1.2 送信仕様

```
送信エンドポイント:
POST https://api.diffsnap.io/v1/telemetry

ペイロード:
{
  "events": [
    {
      "type": "run_end",
      "timestamp": 1704067200000,
      "attributes": {
        "imageCount": 42,
        "processingTime": 8500,
        "version": "1.0.0"
      }
    }
  ],
  "sessionId": "uuid-v4",  // 匿名セッション
  "extensionId": "chrome-extension-id"
}

プライバシー:
- ユーザーID送信なし
- URL送信なし
- 画像コンテンツ送信なし
- IPアドレス記録なし（サーバ側）
```

### 10.2 エラー監視

```
エラーレポート:

自動送信（ユーザー承認後）:
- エラー種別
- スタックトレース
- 拡張バージョン
- ブラウザバージョン
- 発生時刻

手動レポート:
- 「Report Issue」ボタン
- GitHub Issue自動作成
- 再現手順入力欄
```

### 10.3 アップデート戦略

```
自動更新:
- Chrome Web Store経由
- ユーザー操作不要
- バックグラウンドで実行

更新通知:
- メジャーバージョン: リリースノート表示
- マイナーバージョン: 控えめ通知
- パッチ: 通知なし

データ移行:
- メジャーバージョン時のみ
- バックグラウンドで自動実行
- 失敗時はロールバック
```

---

