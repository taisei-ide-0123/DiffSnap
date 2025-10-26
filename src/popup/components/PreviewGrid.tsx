import { useEffect, useRef, useState, useMemo } from 'react'
import type { ImageCandidate } from '@/shared/types'
import { formatImageSize } from '@/lib/image-utils'

// PreviewGrid用の表示型を定義（既存型を拡張）
interface PreviewImageData extends Pick<ImageCandidate, 'url' | 'width' | 'height' | 'alt'> {
  isNew?: boolean // Pro機能用: 差分検出時の新規画像マーカー
}

interface PreviewGridProps {
  images: PreviewImageData[]
  maxDisplay?: number
}

export const PreviewGrid = ({
  images,
  maxDisplay = 100,
}: PreviewGridProps) => {
  const [visibleCount, setVisibleCount] = useState(12)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const displayImages = useMemo(
    () => images.slice(0, Math.min(images.length, maxDisplay)),
    [images, maxDisplay]
  )
  const visibleImages = displayImages.slice(0, visibleCount)

  useEffect(() => {
    if (!sentinelRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && visibleCount < displayImages.length) {
          setVisibleCount((prev) => Math.min(prev + 12, displayImages.length))
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    )

    observerRef.current.observe(sentinelRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [visibleCount, displayImages.length])

  return (
    <div className="w-full">
      <div
        className="grid grid-cols-3 gap-2 p-4"
        role="list"
        aria-label="画像プレビューグリッド"
      >
        {visibleImages.map((image, index) => (
          <PreviewCard key={`${image.url}-${index}`} image={image} />
        ))}
      </div>

      {visibleCount < displayImages.length && (
        <div
          ref={sentinelRef}
          className="h-4"
          aria-hidden="true"
        />
      )}

      {images.length > maxDisplay && (
        <div className="px-4 pb-4 text-sm text-gray-500 text-center">
          表示中: {displayImages.length} / {images.length} 枚
        </div>
      )}
    </div>
  )
}

interface PreviewCardProps {
  image: PreviewImageData
}

const PreviewCard = ({ image }: PreviewCardProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const sizeText = formatImageSize(image.width, image.height)

  return (
    <div
      className="relative aspect-square bg-gray-100 rounded overflow-hidden group"
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
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {image.isNew && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
          NEW
        </div>
      )}

      {isHovered && isLoaded && !hasError && (
        <div
          className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white text-xs p-2 transition-opacity duration-200"
          role="tooltip"
        >
          {sizeText && (
            <div className="font-semibold mb-1">{sizeText}</div>
          )}
          {image.alt && (
            <div className="text-center line-clamp-3 break-all">
              {image.alt}
            </div>
          )}
          {!sizeText && !image.alt && (
            <div className="text-gray-300">情報なし</div>
          )}
        </div>
      )}
    </div>
  )
}
