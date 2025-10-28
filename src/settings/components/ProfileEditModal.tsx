import { useState, useEffect } from 'react'
import { X, TestTube, CheckCircle, XCircle } from 'lucide-react'
import type { DomainProfile } from '@/shared/types'

interface ProfileEditModalProps {
  profile: DomainProfile | null
  onSave: (profile: DomainProfile) => void
  onCancel: () => void
}

export const ProfileEditModal = ({ profile, onSave, onCancel }: ProfileEditModalProps) => {
  const [domain, setDomain] = useState(profile?.domain ?? '')
  const [includePattern, setIncludePattern] = useState(profile?.includePattern ?? '')
  const [excludePattern, setExcludePattern] = useState(profile?.excludePattern ?? '')
  const [minWidth, setMinWidth] = useState(profile?.minWidth?.toString() ?? '')

  // Test URL and result
  const [testUrl, setTestUrl] = useState('')
  const [testResult, setTestResult] = useState<{
    include: boolean | null
    exclude: boolean | null
    message: string
  } | null>(null)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset test result when patterns change
  useEffect(() => {
    setTestResult(null)
  }, [includePattern, excludePattern])

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!domain.trim()) {
      newErrors.domain = 'ドメインを入力してください'
    }

    if (includePattern) {
      try {
        new RegExp(includePattern)
      } catch {
        newErrors.includePattern = '無効な正規表現です'
      }
    }

    if (excludePattern) {
      try {
        new RegExp(excludePattern)
      } catch {
        newErrors.excludePattern = '無効な正規表現です'
      }
    }

    if (minWidth && (isNaN(Number(minWidth)) || Number(minWidth) < 0)) {
      newErrors.minWidth = '有効な数値を入力してください'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle save
  const handleSave = () => {
    if (!validate()) {
      return
    }

    const newProfile: DomainProfile = {
      domain: domain.trim(),
      includePattern: includePattern.trim() || undefined,
      excludePattern: excludePattern.trim() || undefined,
      minWidth: minWidth ? Number(minWidth) : undefined,
    }

    onSave(newProfile)
  }

  // Test patterns
  const handleTest = () => {
    if (!testUrl.trim()) {
      setTestResult({
        include: null,
        exclude: null,
        message: 'テスト用URLを入力してください',
      })
      return
    }

    let includeMatch: boolean | null = null
    let excludeMatch: boolean | null = null
    let message = ''

    // Test include pattern
    if (includePattern) {
      try {
        const regex = new RegExp(includePattern)
        includeMatch = regex.test(testUrl)
      } catch {
        message = 'Include パターンが無効です'
        setTestResult({ include: null, exclude: null, message })
        return
      }
    } else {
      includeMatch = true // No pattern = all allowed
    }

    // Test exclude pattern
    if (excludePattern) {
      try {
        const regex = new RegExp(excludePattern)
        excludeMatch = regex.test(testUrl)
      } catch {
        message = 'Exclude パターンが無効です'
        setTestResult({ include: null, exclude: null, message })
        return
      }
    } else {
      excludeMatch = false // No pattern = none excluded
    }

    // Determine result
    const finalMatch = includeMatch && !excludeMatch

    if (finalMatch) {
      message = '✅ このURLは収集対象です'
    } else if (!includeMatch) {
      message = '❌ Include パターンにマッチしません'
    } else if (excludeMatch) {
      message = '❌ Exclude パターンにマッチします'
    }

    setTestResult({ include: includeMatch, exclude: excludeMatch, message })
  }

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTitle"
      >
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 id="modalTitle" className="text-lg font-semibold text-gray-900">
              {profile ? 'プロファイルを編集' : '新しいプロファイルを追加'}
            </h2>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Domain */}
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                ドメイン <span className="text-red-500">*</span>
              </label>
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.domain ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.domain}
                aria-describedby={errors.domain ? 'domainError' : undefined}
              />
              {errors.domain && (
                <p id="domainError" className="text-xs text-red-600 mt-1">
                  {errors.domain}
                </p>
              )}
            </div>

            {/* Include Pattern */}
            <div>
              <label
                htmlFor="includePattern"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Include Pattern (正規表現)
              </label>
              <input
                id="includePattern"
                type="text"
                value={includePattern}
                onChange={(e) => setIncludePattern(e.target.value)}
                placeholder="/products/.*"
                className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.includePattern ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.includePattern}
                aria-describedby="includePatternHelp"
              />
              <p id="includePatternHelp" className="text-xs text-gray-500 mt-1">
                空欄の場合、すべてのURLが対象となります
              </p>
              {errors.includePattern && (
                <p className="text-xs text-red-600 mt-1">{errors.includePattern}</p>
              )}
            </div>

            {/* Exclude Pattern */}
            <div>
              <label
                htmlFor="excludePattern"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Exclude Pattern (正規表現)
              </label>
              <input
                id="excludePattern"
                type="text"
                value={excludePattern}
                onChange={(e) => setExcludePattern(e.target.value)}
                placeholder=".*thumbnail.*"
                className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.excludePattern ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.excludePattern}
                aria-describedby="excludePatternHelp"
              />
              <p id="excludePatternHelp" className="text-xs text-gray-500 mt-1">
                空欄の場合、除外されるURLはありません
              </p>
              {errors.excludePattern && (
                <p className="text-xs text-red-600 mt-1">{errors.excludePattern}</p>
              )}
            </div>

            {/* Min Width */}
            <div>
              <label htmlFor="minWidth" className="block text-sm font-medium text-gray-700 mb-1">
                最小幅 (ピクセル)
              </label>
              <input
                id="minWidth"
                type="number"
                value={minWidth}
                onChange={(e) => setMinWidth(e.target.value)}
                placeholder="800"
                min="0"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.minWidth ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                aria-invalid={!!errors.minWidth}
                aria-describedby="minWidthHelp"
              />
              <p id="minWidthHelp" className="text-xs text-gray-500 mt-1">
                空欄の場合、幅の制限はありません
              </p>
              {errors.minWidth && <p className="text-xs text-red-600 mt-1">{errors.minWidth}</p>}
            </div>

            {/* Pattern Test */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <TestTube className="w-4 h-4 text-gray-600" />
                <label className="text-sm font-medium text-gray-700">パターンテスト</label>
              </div>

              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://example.com/products/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    aria-label="テスト用URL"
                  />
                </div>

                <button
                  onClick={handleTest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  aria-label="パターンをテスト"
                >
                  <TestTube className="w-4 h-4" />
                  テスト実行
                </button>

                {testResult && (
                  <div
                    className={`p-3 rounded-lg ${
                      testResult.message.startsWith('✅')
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                    role="status"
                  >
                    <div className="flex items-start gap-2">
                      {testResult.message.startsWith('✅') ? (
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                      )}
                      <div className="text-sm">
                        <p className="font-medium">{testResult.message}</p>
                        {testResult.include !== null && (
                          <p className="text-xs mt-1">
                            Include: {testResult.include ? '✓ マッチ' : '✗ 非マッチ'} / Exclude:{' '}
                            {testResult.exclude ? '✓ マッチ' : '✗ 非マッチ'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
