# DiffSnap 次フェーズ計画

**対象**: AIコーディングエージェント
**参照元**: SPEC.md セクション16

---

## 16. 次フェーズ計画（Day 91以降）

### 16.1 Phase 2: Pro拡張機能（Day 91-150）

```
追加機能候補:

1. OCR/全文検索
   - Tesseract.js統合
   - 遅延索引
   - 検索UI

2. タブ一括処理
   - 現在ウィンドウ全タブ
   - 並列実行管理
   - 統合レポート

3. 後処理パイプライン
   - WebP/AVIF変換
   - 圧縮率指定
   - EXIF操作

4. 高度なフィルタ
   - 類似画像除外（pHash）
   - 顔検出（TensorFlow.js）
   - PII自動マスク

条件:
- MVP黒字化
- Proユーザー100+
- NPS ≥50
```

### 16.2 Phase 3: Team機能（Day 151-240）

```
Team機能:

1. 共有コレクション
   - Firebase Realtime DB
   - リアルタイム同期
   - チーム招待

2. クラウド連携
   - S3書き出し
   - Google Drive統合
   - Webhook（Figma/Notion）

3. 権限管理
   - ロール設定（Admin/Member/Viewer）
   - 監査ログ
   - アクセス制御

4. Enterprise機能
   - SSO (SAML/OAuth)
   - データ所在地選択
   - DLP統合

条件:
- Pro MRR $10k+
- Team需要検証（50+リクエスト）
- バックエンド開発リソース確保
```

### 16.3 拡張可能性

```
将来的な拡張方向:

水平展開:
- Firefox対応（MV3対応後）
- Safari対応（API差異解消後）
- Edgeネイティブ配布

垂直展開:
- ビデオダウンロード（別製品）
- PDFエクスポート
- データセット作成支援

API化:
- 外部ツール連携
- ヘッドレス実行
- CI/CD統合
```

---

