// Keep-Alive機構: Alarms API + チェックポイント
// MV3 Service Workerの30秒休止問題への対応

import type { ProcessingCheckpoint } from '../shared/types'

const KEEP_ALIVE_ALARM = 'keep-alive'
const CLEAR_BADGE_ALARM = 'clear-badge'
const KEEP_ALIVE_INTERVAL_MINUTES = 0.5 // 30秒ごと
const CLEAR_BADGE_DELAY_MINUTES = 0.05 // 3秒（0.05分）
const CHECKPOINT_TTL_MS = 60000 // 1分以内なら再開可能

/**
 * Keep-Alive機構の初期化
 */
export const initKeepAlive = async (): Promise<void> => {
  // 既存のアラームをクリア
  await chrome.alarms.clear(KEEP_ALIVE_ALARM)

  // 30秒ごとにService Workerを起動
  await chrome.alarms.create(KEEP_ALIVE_ALARM, {
    periodInMinutes: KEEP_ALIVE_INTERVAL_MINUTES,
  })

  console.log('Keep-Alive initialized: alarm set to 30sec interval')
}

/**
 * アラームリスナー
 */
export const handleKeepAliveAlarm = async (alarm: chrome.alarms.Alarm): Promise<void> => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // TODO(Issue#11): orchestrator実装時にactiveProcessingフラグを設定/解除
    // 現在: フラグ未設定（常にfalse）
    // Issue#11後: orchestrator起動時にtrue、完了/エラー時にfalseを設定
    const { activeProcessing } = await chrome.storage.session.get(['activeProcessing'])

    if (activeProcessing) {
      console.log('Keep-alive: processing continues')
      // このコード実行自体がService Workerを起動 → 30秒カウンタリセット

      // チェックポイントから再開が必要か確認
      await resumeProcessingIfNeeded()
    }
  } else if (alarm.name === CLEAR_BADGE_ALARM) {
    // バッジクリア
    await chrome.action.setBadgeText({ text: '' })
    await chrome.alarms.clear(CLEAR_BADGE_ALARM)
  }
}

/**
 * チェックポイント保存
 */
export const saveCheckpoint = async (checkpoint: ProcessingCheckpoint): Promise<void> => {
  const key = `checkpoint_${checkpoint.tabId}`
  await chrome.storage.session.set({ [key]: checkpoint })
  console.log(
    `Checkpoint saved: ${checkpoint.completedIndices.length}/${checkpoint.candidates.length}`
  )
}

/**
 * 型ガード: ProcessingCheckpointの検証
 */
const isValidCheckpoint = (data: unknown): data is ProcessingCheckpoint => {
  if (typeof data !== 'object' || data === null) return false
  const checkpoint = data as Record<string, unknown>
  return (
    typeof checkpoint.tabId === 'number' &&
    typeof checkpoint.url === 'string' &&
    Array.isArray(checkpoint.candidates) &&
    Array.isArray(checkpoint.completedIndices) &&
    Array.isArray(checkpoint.failedCandidates) &&
    typeof checkpoint.lastCheckpointAt === 'number' &&
    (checkpoint.phase === 'fetching' || checkpoint.phase === 'zipping')
  )
}

/**
 * チェックポイントから処理再開
 */
export const resumeProcessingIfNeeded = async (): Promise<void> => {
  try {
    const allData = await chrome.storage.session.get(null)
    const checkpointKeys = Object.keys(allData).filter((k) => k.startsWith('checkpoint_'))

    for (const key of checkpointKeys) {
      const checkpoint = allData[key]

      // 型ガードで安全性を確保
      if (!isValidCheckpoint(checkpoint)) {
        console.warn(`Invalid checkpoint format: ${key}`)
        await chrome.storage.session.remove(key)
        continue
      }

      const elapsed = Date.now() - checkpoint.lastCheckpointAt

      // システム時刻が巻き戻った場合のエッジケース対応
      if (elapsed < 0 || elapsed >= CHECKPOINT_TTL_MS) {
        console.warn(`Removing checkpoint: ${key}, elapsed=${elapsed}ms`)
        await chrome.storage.session.remove(key)
        continue
      }

      // 1分以内なら再開
      console.log(`Resuming from checkpoint: ${key}`)
      await resumeFromCheckpoint(checkpoint)
    }
  } catch (error) {
    console.error('Failed to resume processing:', error)
  }
}

/**
 * チェックポイントから処理を再開
 * TODO(Issue#11): orchestrator実装時に実際の処理再開ロジックを実装
 * 現在: 再開状態をタブIDで分離保存（orchestratorが参照予定）
 * Issue#11後: orchestrator起動時に該当タブのresumeCheckpointを読み込み、実際の処理を再開
 */
const resumeFromCheckpoint = async (checkpoint: ProcessingCheckpoint): Promise<void> => {
  const { candidates, completedIndices, tabId } = checkpoint
  // O(n)の最適化: Setを使用
  const completedSet = new Set(completedIndices)
  const remaining = candidates.filter((_, i) => !completedSet.has(i))

  console.log(`Resuming: ${remaining.length} images remaining (tabId: ${tabId})`)

  // TODO(Issue#11): 実際の再開処理はorchestrator実装時に追加
  // 複数タブ対応: タブIDでキーを分離
  await chrome.storage.session.set({
    [`resumeCheckpoint_${tabId}`]: checkpoint,
  })
}

/**
 * チェックポイント削除
 */
export const clearCheckpoint = async (tabId: number): Promise<void> => {
  const key = `checkpoint_${tabId}`
  await chrome.storage.session.remove(key)
  console.log(`Checkpoint cleared: ${key}`)
}

/**
 * バッジ更新（進捗表示）
 */
export const updateBadge = async (completed: number, total: number): Promise<void> => {
  if (total === 0) {
    await chrome.action.setBadgeText({ text: '' })
    return
  }

  const percentage = Math.floor((completed / total) * 100)
  await chrome.action.setBadgeText({ text: `${percentage}%` })
  await chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' }) // blue-500
}

/**
 * 完了バッジ表示
 * Service Workerでも動作するようAlarms APIを使用
 */
export const showCompleteBadge = async (): Promise<void> => {
  await chrome.action.setBadgeText({ text: '✓' })
  await chrome.action.setBadgeBackgroundColor({ color: '#10B981' }) // green-500

  // 3秒後にクリア（Alarms APIを使用してService Worker休止に対応）
  await chrome.alarms.create(CLEAR_BADGE_ALARM, {
    delayInMinutes: CLEAR_BADGE_DELAY_MINUTES,
  })
}

/**
 * エラーバッジ表示
 */
export const showErrorBadge = async (): Promise<void> => {
  await chrome.action.setBadgeText({ text: '✗' })
  await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }) // red-500
}

/**
 * バッジクリア
 */
export const clearBadge = async (): Promise<void> => {
  await chrome.action.setBadgeText({ text: '' })
}
