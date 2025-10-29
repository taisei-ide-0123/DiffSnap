import { useEffect } from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { PreviewGrid } from './components/PreviewGrid'
import { ProgressBar, type ProgressStatus } from './components/ProgressBar'
import { usePopupStore, setupBackgroundListener } from './store'
import type { MessageResponse } from '../shared/types'

export const App = () => {
  const status = usePopupStore((state) => state.status)
  const total = usePopupStore((state) => state.total)
  const completed = usePopupStore((state) => state.completed)
  const failed = usePopupStore((state) => state.failed)
  const candidates = usePopupStore((state) => state.candidates)
  const errorMessage = usePopupStore((state) => state.errorMessage)
  const reset = usePopupStore((state) => state.reset)
  const setError = usePopupStore((state) => state.setError)

  useEffect(() => {
    // Backgroundからのメッセージリスナーをセットアップ
    const cleanup = setupBackgroundListener()
    // コンポーネントのアンマウント時にリスナーを削除（メモリリーク防止）
    return cleanup
  }, [])

  const handleDownload = async () => {
    try {
      // 現在のタブを取得
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!currentTab?.id) {
        setError('No active tab found')
        return
      }

      // START_COLLECTIONメッセージを送信
      const response = (await chrome.runtime.sendMessage({
        type: 'START_COLLECTION',
        tabId: currentTab.id,
        options: {
          enableScroll: false, // MVP: 自動スクロールは手動トリガー
          maxScrollDepth: 20,
          scrollTimeout: 15000,
        },
      })) as MessageResponse

      if (response?.status === 'OK') {
        console.log('Collection started successfully')
      } else {
        setError(`Collection failed to start: ${response?.error ?? 'Unknown error'}`)
      }
    } catch (error) {
      setError(
        `Failed to send START_COLLECTION: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  const handleRetry = async (url: string) => {
    // 単一URLの再試行
    const failedImage = failed.find((f) => f.url === url)
    if (!failedImage) return

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'RETRY_FAILED',
        failedImages: [failedImage],
      })) as MessageResponse

      if (response?.status === 'OK') {
        console.log(`Retry queued for ${url}`)
      } else {
        console.error('Retry failed:', response)
      }
    } catch (error) {
      console.error('Failed to send retry request:', error)
    }
  }

  const handleRetryAll = async () => {
    // 全失敗画像の再試行
    if (failed.length === 0) return

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'RETRY_FAILED',
        failedImages: failed,
      })) as MessageResponse

      if (response?.status === 'OK') {
        console.log(`Retry queued for ${response.retryCount} images`)
      } else {
        console.error('Retry all failed:', response)
      }
    } catch (error) {
      console.error('Failed to send retry all request:', error)
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'detecting':
        return '画像を検出中...'
      case 'fetching':
        return '画像を取得中...'
      case 'zipping':
        return 'ZIPファイルを生成中...'
      case 'complete':
        return '完了しました'
      case 'error':
        return `エラー: ${errorMessage ?? '不明なエラー'}`
      default:
        return 'このページの画像が自動的に検出されます'
    }
  }

  const isDownloading = ['detecting', 'fetching', 'zipping'].includes(status)

  // ProgressBarコンポーネント用にstatusを変換
  const getProgressBarStatus = (): ProgressStatus => {
    switch (status) {
      case 'detecting':
        return 'detecting'
      case 'fetching':
        return 'fetching'
      case 'zipping':
        return 'creating-zip'
      case 'complete':
        return 'complete'
      case 'error':
        return 'error'
      default:
        return 'detecting'
    }
  }

  return (
    <div className="w-96 h-[600px] flex flex-col bg-gray-50">
      <Header imageCount={total} tier="Free" />

      <main className="flex-1 overflow-y-auto p-4">
        {status === 'idle' && candidates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-2">{getStatusMessage()}</p>
          </div>
        )}

        {isDownloading && (
          <div className="space-y-4">
            <ProgressBar
              status={getProgressBarStatus()}
              current={completed}
              total={total}
              failedImages={failed}
              onRetry={handleRetry}
              onRetryAll={handleRetryAll}
            />
            <div className="text-center">
              <p className="text-gray-600 mb-1">{getStatusMessage()}</p>
              <p className="text-sm text-gray-500">
                {completed} / {total}
              </p>
            </div>
          </div>
        )}

        {status === 'complete' && (
          <div data-testid="download-complete">
            <div className="text-center py-4 bg-green-50 rounded-lg mb-4">
              <p className="text-green-600 font-medium">ダウンロード完了</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12">
            <p className="text-red-600 mb-2">{getStatusMessage()}</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              リセット
            </button>
          </div>
        )}

        {candidates.length > 0 && status !== 'error' && <PreviewGrid images={candidates} />}
      </main>

      <Footer onDownload={handleDownload} isDownloading={isDownloading} />
    </div>
  )
}
