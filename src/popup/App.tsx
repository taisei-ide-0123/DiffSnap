import { useEffect } from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { PreviewGrid } from './components/PreviewGrid'
import { ProgressBar, type ProgressStatus } from './components/ProgressBar'
import { usePopupStore, setupBackgroundListener } from './store'

export const App = () => {
  const status = usePopupStore((state) => state.status)
  const total = usePopupStore((state) => state.total)
  const completed = usePopupStore((state) => state.completed)
  const failed = usePopupStore((state) => state.failed)
  const candidates = usePopupStore((state) => state.candidates)
  const errorMessage = usePopupStore((state) => state.errorMessage)
  const reset = usePopupStore((state) => state.reset)

  useEffect(() => {
    // Backgroundからのメッセージリスナーをセットアップ
    const cleanup = setupBackgroundListener()
    // コンポーネントのアンマウント時にリスナーを削除（メモリリーク防止）
    return cleanup
  }, [])

  const handleDownload = () => {
    // TODO: Implement download logic
    // chrome.runtime.sendMessage({ type: 'START_COLLECTION', ... })
  }

  const handleRetry = (url: string) => {
    // 単一URLの再試行
    chrome.runtime.sendMessage({
      type: 'RETRY_FAILED',
      urls: [url],
    })
  }

  const handleRetryAll = () => {
    // 全失敗画像の再試行
    const failedUrls = failed.map((f) => f.url)
    if (failedUrls.length > 0) {
      chrome.runtime.sendMessage({
        type: 'RETRY_FAILED',
        urls: failedUrls,
      })
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

        {(status === 'idle' || status === 'complete') &&
          candidates.length > 0 && <PreviewGrid images={candidates} />}

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
      </main>

      <Footer onDownload={handleDownload} isDownloading={isDownloading} />
    </div>
  )
}
