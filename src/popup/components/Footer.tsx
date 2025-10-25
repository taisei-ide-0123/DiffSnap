import { Download, Settings } from 'lucide-react'

interface FooterProps {
  onDownload?: () => void
  onOpenSettings?: () => void
  isDownloading?: boolean
  disabled?: boolean
}

const BUTTON_TEXT = {
  download: {
    label: 'Download All',
    ariaLabel: 'Download all images',
  },
  downloading: {
    label: 'Downloading...',
    ariaLabel: 'Downloading images',
  },
  settings: {
    ariaLabel: 'Open settings',
  },
} as const

export const Footer = ({
  onDownload,
  onOpenSettings,
  isDownloading = false,
  disabled = false,
}: FooterProps) => {
  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings()
    } else {
      chrome.runtime.openOptionsPage()
    }
  }

  const downloadButtonText = isDownloading
    ? BUTTON_TEXT.downloading
    : BUTTON_TEXT.download

  return (
    <footer className="px-4 py-3 border-t border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onDownload}
          disabled={disabled || isDownloading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={downloadButtonText.ariaLabel}
        >
          <Download className="w-5 h-5" aria-hidden="true" />
          <span>{downloadButtonText.label}</span>
        </button>

        <button
          onClick={handleSettingsClick}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-label={BUTTON_TEXT.settings.ariaLabel}
        >
          <Settings className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </footer>
  )
}
