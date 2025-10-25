import { AlertCircle, ShieldAlert, WifiOff, Clock, HelpCircle } from 'lucide-react'
import type { FailedImage, ErrorType } from '@/shared/types'

export type ProgressStatus = 'detecting' | 'fetching' | 'creating-zip' | 'complete' | 'error'

interface ProgressBarProps {
  status: ProgressStatus
  current: number
  total: number
  failedImages?: FailedImage[]
  onRetry?: (url: string) => void
  onRetryAll?: () => void
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  detecting: 'Detecting images...',
  fetching: 'Fetching images...',
  'creating-zip': 'Creating ZIP...',
  complete: 'Complete',
  error: 'Error occurred',
}

const getErrorIcon = (errorType: ErrorType) => {
  switch (errorType) {
    case 'CORS':
      return <ShieldAlert className="w-4 h-4 text-red-600" aria-hidden="true" />
    case 'TIMEOUT':
      return <Clock className="w-4 h-4 text-orange-600" aria-hidden="true" />
    case 'NETWORK':
    case 'HTTP_ERROR':
      return <WifiOff className="w-4 h-4 text-red-600" aria-hidden="true" />
    case 'UNKNOWN':
    default:
      return <HelpCircle className="w-4 h-4 text-gray-600" aria-hidden="true" />
  }
}

export const ProgressBar = ({
  status,
  current,
  total,
  failedImages = [],
  onRetry,
  onRetryAll,
}: ProgressBarProps) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  const hasErrors = failedImages.length > 0

  const truncateUrl = (url: string, maxLength = 50): string => {
    if (url.length <= maxLength) return url
    return `${url.slice(0, maxLength - 3)}...`
  }

  return (
    <div className="w-full space-y-3 px-4 py-3" role="region" aria-label="進捗状況">
      {/* プログレスバー */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`進捗: ${percentage}%`}
        />
      </div>

      {/* テキスト情報 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 font-medium" aria-live="polite">
          {STATUS_LABELS[status]}
        </span>
        <div className="flex items-center gap-2 text-gray-600">
          <span aria-label={`現在の進捗: ${current}件中${total}件`}>
            {current} / {total}
          </span>
          <span className="font-semibold text-blue-600" aria-label={`進捗率: ${percentage}%`}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* エラーリスト */}
      {hasErrors && (
        <div
          className="mt-3 border border-red-200 rounded-md bg-red-50"
          role="alert"
          aria-label={`${failedImages.length}件のエラー`}
        >
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
                <span className="text-sm font-semibold text-red-800">
                  Failed to fetch {failedImages.length} image{failedImages.length > 1 ? 's' : ''}
                </span>
              </div>
              {onRetryAll && (
                <button
                  onClick={onRetryAll}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  aria-label="全ての失敗画像を再試行"
                >
                  Retry All
                </button>
              )}
            </div>
            <ul className="space-y-2 max-h-32 overflow-y-auto">
              {failedImages.map((failed, index) => (
                <li
                  key={`${failed.url}-${index}`}
                  className="flex items-start gap-2 text-xs"
                >
                  <div className="flex-shrink-0 mt-0.5">{getErrorIcon(failed.errorType)}</div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-gray-700 truncate"
                      title={failed.url}
                      aria-label={`エラーURL: ${failed.url}`}
                    >
                      {truncateUrl(failed.url)}
                    </p>
                    <p className="text-red-600 mt-1" aria-label={`エラー理由: ${failed.error}`}>
                      {failed.error}
                    </p>
                  </div>
                  {onRetry && (
                    <button
                      onClick={() => onRetry(failed.url)}
                      className="flex-shrink-0 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                      aria-label={`${failed.url}を再試行`}
                    >
                      Retry
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
