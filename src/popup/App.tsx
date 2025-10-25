import { Header } from './components/Header'
import { Footer } from './components/Footer'

export const App = () => {
  const handleDownload = () => {
    // TODO: Implement download logic
  }

  return (
    <div className="w-96 h-[600px] flex flex-col bg-gray-50">
      <Header imageCount={0} tier="Free" />

      <main className="flex-1 overflow-y-auto p-4">
        <div className="text-center py-12">
          <p className="text-gray-600 mb-2">画像を検出中...</p>
          <p className="text-sm text-gray-500">
            このページの画像が自動的に検出されます
          </p>
        </div>
      </main>

      <Footer onDownload={handleDownload} isDownloading={false} />
    </div>
  )
}
