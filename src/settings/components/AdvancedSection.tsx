import { useState, useEffect } from 'react'
import { Trash2, AlertCircle, Loader2 } from 'lucide-react'
import type { CleanupDataResponse } from '@/shared/types'

export const AdvancedSection = () => {
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

  // Handle data cleanup
  const handleCleanup = async () => {
    const confirmed = window.confirm(
      'すべての差分台帳データを削除します。この操作は取り消せません。\n\n続行しますか？'
    )

    if (!confirmed) {
      return
    }

    setIsCleaningUp(true)
    setCleanupResult(null)

    try {
      // Send cleanup message to background
      const response = (await chrome.runtime.sendMessage({
        type: 'CLEANUP_DATA',
      })) as CleanupDataResponse

      if (response.success) {
        setCleanupResult(`✅ ${response.deletedCount} 件のレコードを削除しました`)
      } else {
        setCleanupResult('❌ クリーンアップに失敗しました')
      }
    } catch (error) {
      console.error('Cleanup error:', error)
      setCleanupResult('❌ エラーが発生しました')
    } finally {
      setIsCleaningUp(false)
    }
  }

  // Clear cleanup result message after 5 seconds
  useEffect(() => {
    if (cleanupResult) {
      const timer = setTimeout(() => setCleanupResult(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [cleanupResult])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">詳細設定</h2>
        <p className="text-sm text-gray-600">高度な機能とデータ管理の設定を行います。</p>
      </div>

      {/* Auto Scroll Settings (Placeholder for MVP) */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-700 font-medium mb-1">自動スクロール設定</p>
            <p className="text-xs text-gray-500">この機能は今後のアップデートで提供予定です。</p>
          </div>
        </div>
      </div>

      {/* Data Cleanup */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <Trash2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">データクリーンアップ</h3>
            <p className="text-sm text-gray-600">
              すべての差分台帳データを削除します。この操作は取り消せません。
            </p>
          </div>
        </div>

        <button
          onClick={handleCleanup}
          disabled={isCleaningUp}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="データクリーンアップを実行"
        >
          {isCleaningUp ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              クリーンアップ中...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              データを削除
            </>
          )}
        </button>

        {cleanupResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              cleanupResult.startsWith('✅')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
            role="alert"
          >
            {cleanupResult}
          </div>
        )}
      </div>

      {/* Storage Info */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">ストレージ情報</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">設定データ:</span>
            <span className="text-gray-900">chrome.storage.sync</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">差分台帳:</span>
            <span className="text-gray-900">IndexedDB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">キャッシュ:</span>
            <span className="text-gray-900">chrome.storage.local</span>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">バージョン情報</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">拡張機能バージョン:</span>
            <span className="text-gray-900 font-mono">{chrome.runtime.getManifest().version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Manifest:</span>
            <span className="text-gray-900">V3</span>
          </div>
        </div>
      </div>
    </div>
  )
}
