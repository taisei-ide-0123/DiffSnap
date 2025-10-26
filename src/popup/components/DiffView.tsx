import { useState } from 'react'
import { Download, Sparkles } from 'lucide-react'
import type { ImageSnapshot } from '@/shared/types'
import { formatImageSize } from '@/lib/image-utils'

// ImageSnapshotから差分表示に必要なフィールドのみを抽出
type DiffImageData = Pick<ImageSnapshot, 'url' | 'width' | 'height' | 'alt' | 'hash'>

interface DiffViewProps {
  newImages: DiffImageData[]
  existingImages: DiffImageData[]
  tier: 'free' | 'pro'
  isFirstVisit: boolean
  onDownloadNew?: () => void
  onDownloadAll?: () => void
  onUpgrade?: () => void
}

export const DiffView = ({
  newImages,
  existingImages,
  tier,
  isFirstVisit,
  onDownloadNew,
  onDownloadAll,
  onUpgrade,
}: DiffViewProps) => {
  const totalImages = newImages.length + existingImages.length

  if (tier === 'free') {
    return <FreeTierDiffView
      newCount={newImages.length}
      totalCount={totalImages}
      isFirstVisit={isFirstVisit}
      onUpgrade={onUpgrade}
    />
  }

  return (
    <ProTierDiffView
      newImages={newImages}
      existingImages={existingImages}
      isFirstVisit={isFirstVisit}
      onDownloadNew={onDownloadNew}
      onDownloadAll={onDownloadAll}
    />
  )
}

interface FreeTierDiffViewProps {
  newCount: number
  totalCount: number
  isFirstVisit: boolean
  onUpgrade?: () => void
}

const FreeTierDiffView = ({
  newCount,
  totalCount,
  isFirstVisit,
  onUpgrade,
}: FreeTierDiffViewProps) => {
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade()
    } else {
      chrome.runtime.openOptionsPage()
    }
  }

  return (
    <div className="w-full p-4 space-y-4">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Proにアップグレードして差分機能を解放
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              {isFirstVisit ? (
                '初回訪問です。次回訪問時から新規画像のみを自動検出できます。'
              ) : (
                `${newCount}枚の新規画像を検出しました。Proプランで詳細を確認できます。`
              )}
            </p>
            <button
              onClick={handleUpgrade}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Proプランにアップグレード"
            >
              Proにアップグレード
            </button>
          </div>
        </div>
      </div>

      {!isFirstVisit && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-700">
            <div className="flex justify-between mb-2">
              <span className="font-medium">検出画像総数:</span>
              <span className="font-semibold text-gray-900">{totalCount}枚</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">新規画像:</span>
              <span className="font-semibold text-green-600">{newCount}枚</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ProTierDiffViewProps {
  newImages: DiffImageData[]
  existingImages: DiffImageData[]
  isFirstVisit: boolean
  onDownloadNew?: () => void
  onDownloadAll?: () => void
}

const ProTierDiffView = ({
  newImages,
  existingImages,
  isFirstVisit,
  onDownloadNew,
  onDownloadAll,
}: ProTierDiffViewProps) => {
  const totalImages = newImages.length + existingImages.length

  return (
    <div className="w-full">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-gray-600">新規: </span>
              <span className="font-semibold text-green-600">{newImages.length}枚</span>
            </div>
            <div>
              <span className="text-gray-600">既存: </span>
              <span className="font-semibold text-gray-500">{existingImages.length}枚</span>
            </div>
          </div>
          <div className="text-gray-600">
            合計: <span className="font-semibold text-gray-900">{totalImages}枚</span>
          </div>
        </div>

        {isFirstVisit && (
          <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            初回訪問です。次回訪問時から差分検出が有効になります。
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-0.5 bg-gray-200">
        <div className="bg-white">
          <div className="px-3 py-2 bg-green-50 border-b border-green-200">
            <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wide">
              新規画像 ({newImages.length})
            </h3>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {newImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-1" role="list" aria-label="新規画像一覧">
                {newImages.map((image) => (
                  <DiffImageCard key={`new-${image.hash}`} image={image} isNew={true} />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                新規画像はありません
              </div>
            )}
          </div>
        </div>

        <div className="bg-white">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              既存画像 ({existingImages.length})
            </h3>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {existingImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-1" role="list" aria-label="既存画像一覧">
                {existingImages.map((image) => (
                  <DiffImageCard key={`existing-${image.hash}`} image={image} isNew={false} />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                既存画像はありません
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={onDownloadNew}
            disabled={newImages.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            aria-label="新規画像のみダウンロード"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>新規のみ</span>
          </button>
          <button
            onClick={onDownloadAll}
            disabled={totalImages === 0}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="全画像ダウンロード"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>すべて</span>
          </button>
        </div>
      </div>
    </div>
  )
}

interface DiffImageCardProps {
  image: DiffImageData
  isNew: boolean
}

const DiffImageCard = ({ image, isNew }: DiffImageCardProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const borderColor = isNew ? 'border-green-400' : 'border-gray-300'
  const opacity = isNew ? 'opacity-100' : 'opacity-60'

  const sizeText = formatImageSize(image.width, image.height)

  return (
    <div
      className={`relative aspect-square bg-gray-100 rounded overflow-hidden border-2 ${borderColor} ${opacity}`}
      role="listitem"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!hasError ? (
        <img
          src={image.url}
          alt={image.alt ?? ''}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
          読込失敗
        </div>
      )}

      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isNew && (
        <div className="absolute top-1 right-1 bg-green-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
          NEW
        </div>
      )}

      {!isNew && (
        <div className="absolute top-1 right-1 bg-gray-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded opacity-80">
          EXISTING
        </div>
      )}

      {isHovered && isLoaded && !hasError && (
        <div
          className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white text-xs p-1 transition-opacity duration-200"
          role="tooltip"
        >
          {sizeText && (
            <div className="font-semibold text-center">{sizeText}</div>
          )}
          {image.alt && (
            <div className="text-center line-clamp-2 break-all mt-1">
              {image.alt}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
