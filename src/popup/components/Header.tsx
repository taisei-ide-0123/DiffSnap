import { Camera } from 'lucide-react'

interface HeaderProps {
  imageCount?: number
  tier?: 'Free' | 'Pro'
}

export const Header = ({ imageCount = 0, tier = 'Free' }: HeaderProps) => {
  const tierStyles =
    tier === 'Pro'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-800'

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-2">
        <Camera className="w-6 h-6 text-blue-600" aria-hidden="true" />
        <h1 className="text-xl font-bold text-gray-900">DiffSnap</h1>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="text-sm text-gray-600"
          aria-live="polite"
          aria-label={`検出画像数: ${imageCount}枚`}
        >
          <span className="font-semibold text-gray-900">{imageCount}</span>{' '}
          images
        </div>

        <span
          className={`px-2 py-1 text-xs font-semibold rounded ${tierStyles}`}
          aria-label={`プラン: ${tier}`}
        >
          {tier}
        </span>
      </div>
    </header>
  )
}
