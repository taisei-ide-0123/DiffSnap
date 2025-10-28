/**
 * Message Router for Background Service Worker
 *
 * このモジュールはContent ScriptやPopupからのメッセージを受信し、
 * 適切なハンドラに振り分けます。
 *
 * メッセージフロー:
 * - Content → Background: 画像検出、スクロール完了、エラー通知
 * - Popup → Background: 収集開始、リトライ、差分チェック
 * - Background → Popup: 状態更新、差分結果、ZIP準備完了
 */

import type {
  ContentToBackgroundMessage,
  PopupToBackgroundMessage,
  BackgroundToPopupMessage,
  BackgroundToContentMessage,
  RunState,
  ImageSnapshot,
  ImageCandidate,
  CollectionOptions,
} from '../shared/types'
import { ImageCollector, type CollectionResult } from './collector'
import { computeDiff, updateRecord, type ImageWithData } from './diff-engine'
import { createZip } from './zipper'
import { checkTier, checkFreeLimit } from './license-validator'

/**
 * メッセージハンドラの型定義
 */
type MessageHandler<T> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void

/**
 * 収集状態管理（進行中の収集を追跡）
 */
interface CollectionState {
  tabId: number
  url: string
  candidates: ImageCandidate[]
  options: CollectionOptions
  startedAt: number
}

// 進行中の収集を管理するMap (テスト用にexport)
export const activeCollections = new Map<number, CollectionState>()

/**
 * 収集オーケストレーター
 *
 * フロー:
 * 1. ライセンス検証（tier確認）
 * 2. Free制限チェック
 * 3. 画像収集（並列fetch + 去重）
 * 4. 差分計算（Proのみ）
 * 5. ZIP生成
 * 6. ダウンロード実行
 * 7. 完了通知
 */
const orchestrateCollection = async (
  tabId: number,
  url: string,
  candidates: ImageCandidate[],
  _options: CollectionOptions
): Promise<void> => {
  try {
    // ステップ1: ライセンス検証
    await sendStateUpdate({
      tabId,
      status: 'detecting',
      total: candidates.length,
      completed: 0,
      failed: [],
      zipSize: 0,
    })

    const tier = await checkTier()
    console.log(`[orchestrateCollection] User tier: ${tier}`)

    // ステップ2: Free制限チェック
    if (tier === 'free') {
      const withinLimit = await checkFreeLimit(candidates.length)
      if (!withinLimit) {
        // 制限超過通知
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'DiffSnap - Free制限到達',
          message: '今月の無料枠(500枚)を超えています。Proプランで無制限にご利用いただけます。',
          priority: 2,
        })

        await sendStateUpdate({
          tabId,
          status: 'error',
          total: candidates.length,
          completed: 0,
          failed: [],
          zipSize: 0,
        })
        console.warn('[orchestrateCollection] Free tier limit exceeded')
        return
      }
    }

    // ステップ3: 画像収集
    await sendStateUpdate({
      tabId,
      status: 'fetching',
      total: candidates.length,
      completed: 0,
      failed: [],
      zipSize: 0,
    })

    const collector = new ImageCollector({ tabId })
    const collectionResult: CollectionResult = await collector.collect(candidates)

    console.log(`[orchestrateCollection] Collection complete:`, {
      fetched: collectionResult.stats.fetched,
      failed: collectionResult.stats.failed,
      deduplicated: collectionResult.stats.deduplicated,
    })

    // ステップ4: 差分計算（Proのみ）
    let imagesToZip = collectionResult.images

    if (tier === 'pro') {
      console.log(`[orchestrateCollection] Computing diff (Pro feature)`)

      const imagesWithData: ImageWithData[] = collectionResult.images.map((img) => ({
        blob: img.blob,
        url: img.snapshot.url,
        width: img.snapshot.width,
        height: img.snapshot.height,
        alt: img.snapshot.alt,
        context: img.snapshot.context,
      }))

      const diffResult = await computeDiff(url, imagesWithData)

      // 差分結果をPopupに通知
      await sendDiffResult(diffResult.newImages, diffResult.existingImages, diffResult.isFirstVisit)

      // 新規画像のみをZIPに含める
      imagesToZip = collectionResult.images.filter((img) =>
        diffResult.newImages.some((newImg) => newImg.hash === img.hash)
      )

      // 台帳更新（新規画像を保存）
      await updateRecord(url, diffResult.newImages)

      console.log(`[orchestrateCollection] Diff complete:`, {
        new: diffResult.newImages.length,
        existing: diffResult.existingImages.length,
        isFirstVisit: diffResult.isFirstVisit,
      })
    }

    // 画像がない場合は終了
    if (imagesToZip.length === 0) {
      await sendStateUpdate({
        tabId,
        status: 'complete',
        total: candidates.length,
        completed: collectionResult.stats.fetched,
        failed: collectionResult.failed,
        zipSize: 0,
      })
      console.log('[orchestrateCollection] No images to zip')
      return
    }

    // ステップ5: ZIP生成
    await sendStateUpdate({
      tabId,
      status: 'zipping',
      total: candidates.length,
      completed: collectionResult.stats.fetched,
      failed: collectionResult.failed,
      zipSize: 0,
    })

    // 設定からファイル名テンプレートを取得（デフォルトは"default"）
    const config = await chrome.storage.sync.get(['namingTemplate'])
    const template = config.namingTemplate ?? '{date}-{domain}-{w}x{h}-{index}'

    const zipResult = await createZip(imagesToZip, {
      template,
      pageUrl: url,
      zipFilename: 'images',
    })

    console.log(`[orchestrateCollection] ZIP created:`, {
      fileCount: zipResult.fileCount,
      size: zipResult.size,
    })

    // ステップ6: ダウンロード実行
    const blobUrl = URL.createObjectURL(zipResult.blob)

    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: zipResult.filename,
      saveAs: true,
    })

    // Blob URLを60秒後に解放（メモリリーク防止）
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
    }, 60000)

    // ステップ7: 完了通知
    await sendStateUpdate({
      tabId,
      status: 'complete',
      total: candidates.length,
      completed: collectionResult.stats.fetched,
      failed: collectionResult.failed,
      zipSize: zipResult.size,
    })

    await sendZipReady(downloadId)

    console.log(`[orchestrateCollection] Collection orchestration complete`)
  } catch (error) {
    console.error('[orchestrateCollection] Error:', error)

    await sendStateUpdate({
      tabId,
      status: 'error',
      total: candidates.length,
      completed: 0,
      failed: [],
      zipSize: 0,
    })
  } finally {
    // 収集状態をクリーンアップ
    activeCollections.delete(tabId)
  }
}

/**
 * Content Scriptからのメッセージハンドラ
 */
const handleContentMessage: MessageHandler<ContentToBackgroundMessage> = (
  message,
  sender,
  sendResponse
) => {
  const tabId = sender.tab?.id

  switch (message.type) {
    case 'IMAGES_DETECTED': {
      // 候補配列の検証
      if (!message.candidates || !Array.isArray(message.candidates)) {
        console.error('Invalid IMAGES_DETECTED message:', message)
        sendResponse({ status: 'ERROR', error: 'Invalid candidates field' })
        return true
      }

      if (!tabId) {
        console.error('IMAGES_DETECTED: tabId is undefined')
        sendResponse({ status: 'ERROR', error: 'Invalid sender' })
        return true
      }

      console.log('Received IMAGES_DETECTED from tab:', tabId, 'count:', message.candidates.length)

      // 既存の収集状態を取得
      const existingState = activeCollections.get(tabId)
      if (!existingState) {
        console.warn('Received IMAGES_DETECTED without active collection')
        sendResponse({ status: 'ERROR', error: 'No active collection' })
        return true
      }

      // 候補を更新
      existingState.candidates = message.candidates

      // 収集オーケストレーションを開始
      chrome.tabs
        .get(tabId)
        .then((tab) => {
          if (!tab.url) {
            throw new Error('Tab URL not available')
          }
          // 非同期で収集開始（レスポンスはすぐ返す）
          orchestrateCollection(tabId, tab.url, message.candidates, existingState.options).catch(
            (err) => {
              console.error('[IMAGES_DETECTED] Orchestration failed:', err)
            }
          )
        })
        .catch((err) => {
          console.error('[IMAGES_DETECTED] Failed to get tab:', err)
          activeCollections.delete(tabId)
        })

      sendResponse({ status: 'OK', received: message.candidates.length })
      return true
    }

    case 'SCROLL_COMPLETE': {
      console.log('Scroll completed:', message.result)
      console.log(
        `  State: ${message.result.state}, Count: ${message.result.scrollCount}, ` +
          `Height: ${message.result.finalHeight}px, Elapsed: ${message.result.elapsed}ms`
      )

      // TODO: Issue #13で収集オーケストレーター連携実装
      sendResponse({ status: 'OK' })
      return true
    }

    case 'SCROLL_TIMEOUT': {
      console.warn('Scroll timeout from tab:', tabId)

      // TODO: Issue #13でタイムアウト処理実装
      sendResponse({ status: 'OK' })
      return true
    }

    case 'DETECTION_ERROR': {
      console.error('Detection error from tab:', tabId, 'error:', message.error)

      // TODO: Issue #13でエラーハンドリング実装
      sendResponse({ status: 'OK' })
      return true
    }

    default: {
      // 型安全性チェック（到達不可能）
      const _exhaustive: never = message
      console.warn('Unknown content message type:', _exhaustive)
      sendResponse({ status: 'ERROR', error: 'Unknown message type' })
      return true
    }
  }
}

/**
 * Popupからのメッセージハンドラ
 */
const handlePopupMessage: MessageHandler<PopupToBackgroundMessage> = (
  message,
  _sender,
  sendResponse
) => {
  switch (message.type) {
    case 'START_COLLECTION': {
      const { tabId, options } = message

      console.log('START_COLLECTION request:', { tabId, options })

      // 進行中の収集があるかチェック
      if (activeCollections.has(tabId)) {
        console.log('Collection already in progress for tab:', tabId)
        sendResponse({
          status: 'ERROR',
          error: 'Collection already in progress',
        })
        return true
      }

      // 状態を予約（競合防止 - 空の候補配列で初期化）
      activeCollections.set(tabId, {
        tabId,
        url: '', // tab取得後に更新
        candidates: [],
        options,
        startedAt: Date.now(),
      })

      // 非同期処理を開始
      chrome.tabs
        .get(tabId)
        .then(async (tab) => {
          if (!tab.url) {
            throw new Error('Tab URL not available')
          }

          // 状態更新
          const state = activeCollections.get(tabId)
          if (state) {
            state.url = tab.url
          }

          // Content Scriptに画像検出を依頼
          await sendToContent(tabId, {
            type: 'START_SCROLL',
            options: {
              maxDepth: options.maxScrollDepth,
              timeout: options.scrollTimeout,
            },
          })
        })
        .catch(async (err) => {
          console.error('[START_COLLECTION] Failed:', err)
          // エラーは別のメッセージチャネルで通知
          await sendStateUpdate({
            tabId,
            status: 'error',
            total: 0,
            completed: 0,
            failed: [],
            zipSize: 0,
          })
          activeCollections.delete(tabId)
        })

      // 即座に受付確認を返す
      sendResponse({
        status: 'OK',
        message: 'Collection request accepted',
      })
      return true
    }

    case 'RETRY_FAILED': {
      console.log('RETRY_FAILED request:', {
        count: message.failedImages.length,
        failedImages: message.failedImages,
      })

      // Issue #17: エラーハンドリング実装完了
      // UIからの再試行リクエストを受信
      // 実際の収集処理はIssue #13のCollectorオーケストレーター実装時に統合
      // 現在は受信確認のみ（Collector.retryFailed()メソッドは実装済み）
      sendResponse({
        status: 'OK',
        message: 'Retry request received',
        retryCount: message.failedImages.length,
      })
      return true
    }

    case 'CHECK_DIFF': {
      console.log('CHECK_DIFF request:', { url: message.url })

      // TODO: Issue #14で差分エンジン実装
      sendResponse({
        status: 'OK',
        message: 'Diff check started (placeholder)',
      })
      return true
    }

    default: {
      // 型安全性チェック（到達不可能）
      const _exhaustive: never = message
      console.warn('Unknown popup message type:', _exhaustive)
      sendResponse({ status: 'ERROR', error: 'Unknown message type' })
      return true
    }
  }
}

/**
 * メッセージルーターのメインハンドラ
 *
 * Content ScriptとPopupの両方からのメッセージを受け付け、
 * 適切なハンドラに振り分けます。
 *
 * @param message - メッセージオブジェクト
 * @param sender - 送信元情報
 * @param sendResponse - レスポンス送信関数
 * @returns 非同期チャネルを使用する場合はtrue
 *
 * @example
 * chrome.runtime.onMessage.addListener((msg, sender, respond) => {
 *   return handleMessage(msg, sender, respond)
 * })
 */
export const handleMessage = (
  message: ContentToBackgroundMessage | PopupToBackgroundMessage | { type: 'PING' },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean => {
  const senderInfo = sender.tab?.id
    ? `tab:${sender.tab.id}`
    : sender.url?.includes('popup.html')
      ? 'popup'
      : 'unknown'
  console.log('Background received message:', message.type, 'from:', senderInfo)

  // PINGメッセージ（接続確認用）
  if (message.type === 'PING') {
    sendResponse({ status: 'OK', timestamp: Date.now() })
    return true
  }

  // Content Scriptからのメッセージ
  if (
    message.type === 'IMAGES_DETECTED' ||
    message.type === 'SCROLL_COMPLETE' ||
    message.type === 'SCROLL_TIMEOUT' ||
    message.type === 'DETECTION_ERROR'
  ) {
    return handleContentMessage(message as ContentToBackgroundMessage, sender, sendResponse) ?? true
  }

  // Popupからのメッセージ
  if (
    message.type === 'START_COLLECTION' ||
    message.type === 'RETRY_FAILED' ||
    message.type === 'CHECK_DIFF'
  ) {
    return handlePopupMessage(message as PopupToBackgroundMessage, sender, sendResponse) ?? true
  }

  // 未知のメッセージタイプ
  console.warn('Unknown message type:', message)
  sendResponse({ status: 'ERROR', error: 'Unknown message type' })
  return true
}

/**
 * Popup向けメッセージ送信ヘルパー関数群
 */

/**
 * STATE_UPDATEメッセージをPopupに送信
 *
 * @param state - 送信する実行状態
 *
 * @example
 * await sendStateUpdate({ status: 'collecting', progress: 50 })
 */
export const sendStateUpdate = async (state: RunState): Promise<void> => {
  const message: BackgroundToPopupMessage = {
    type: 'STATE_UPDATE',
    state,
  }

  try {
    await chrome.runtime.sendMessage(message)
    console.log('STATE_UPDATE sent to popup:', state.status)
  } catch (error) {
    // Popupが開いていない場合はエラーになるが、無視して良い
    const isPopupClosed = (error as Error).message?.includes('Receiving end does not exist')
    if (isPopupClosed) {
      // Popup未起動時は正常（エラーログ不要）
      return
    }
    console.error('Failed to send STATE_UPDATE:', error)
  }
}

/**
 * DIFF_RESULTメッセージをPopupに送信
 *
 * @param newImages - 新規に検出された画像のスナップショット
 * @param existingImages - 既存の画像スナップショット
 * @param isFirstVisit - 初回訪問かどうか
 *
 * @example
 * await sendDiffResult([newImage1, newImage2], [existingImage1], false)
 */
export const sendDiffResult = async (
  newImages: ImageSnapshot[],
  existingImages: ImageSnapshot[],
  isFirstVisit: boolean
): Promise<void> => {
  const message: BackgroundToPopupMessage = {
    type: 'DIFF_RESULT',
    new: newImages,
    existing: existingImages,
    isFirstVisit,
  }

  try {
    await chrome.runtime.sendMessage(message)
    console.log('DIFF_RESULT sent to popup:', {
      new: newImages.length,
      existing: existingImages.length,
      isFirstVisit,
    })
  } catch (error) {
    const isPopupClosed = (error as Error).message?.includes('Receiving end does not exist')
    if (isPopupClosed) {
      return
    }
    console.error('Failed to send DIFF_RESULT:', error)
  }
}

/**
 * ZIP_READYメッセージをPopupに送信
 *
 * @param downloadId - ChromeダウンロードID
 *
 * @example
 * await sendZipReady(12345)
 */
export const sendZipReady = async (downloadId: number): Promise<void> => {
  const message: BackgroundToPopupMessage = {
    type: 'ZIP_READY',
    downloadId,
  }

  try {
    await chrome.runtime.sendMessage(message)
    console.log('ZIP_READY sent to popup, downloadId:', downloadId)
  } catch (error) {
    const isPopupClosed = (error as Error).message?.includes('Receiving end does not exist')
    if (isPopupClosed) {
      return
    }
    console.error('Failed to send ZIP_READY:', error)
  }
}

/**
 * Content Scriptへメッセージを送信
 *
 * @param tabId - 送信先のタブID
 * @param message - 送信するメッセージ（BackgroundToContentMessage型）
 * @throws メッセージ送信に失敗した場合
 *
 * @example
 * await sendToContent(123, { type: 'START_SCROLL', options: { maxDepth: 20 } })
 */
export const sendToContent = async (
  tabId: number,
  message: BackgroundToContentMessage
): Promise<void> => {
  try {
    await chrome.tabs.sendMessage(tabId, message)
    console.log('Message sent to content script:', { tabId, type: message.type })
  } catch (error) {
    console.error('Failed to send message to content script:', error)
    throw error
  }
}
