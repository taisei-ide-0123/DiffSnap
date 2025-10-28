import { useState } from 'react'
import { Crown, Key, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { VerifyLicenseResponse } from '@/shared/types'

interface AccountSectionProps {
  tier: 'free' | 'pro'
  licenseKey?: string
  monthlyCount?: number
  monthlyResetAt?: number
  onTierChange: (tier: 'free' | 'pro') => void
  onLicenseKeyChange: (key: string) => void
}

export const AccountSection = ({
  tier,
  licenseKey = '',
  monthlyCount = 0,
  monthlyResetAt,
  onTierChange,
  onLicenseKeyChange,
}: AccountSectionProps) => {
  const [keyInput, setKeyInput] = useState(licenseKey)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const isPro = tier === 'pro'
  const remainingImages = 500 - monthlyCount

  // Format reset date
  const resetDate = monthlyResetAt
    ? new Date(monthlyResetAt).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '未設定'

  // Verify license key
  const handleVerifyKey = async () => {
    if (!keyInput.trim()) {
      setErrorMessage('ライセンスキーを入力してください')
      setVerificationStatus('error')
      return
    }

    setIsVerifying(true)
    setVerificationStatus('idle')
    setErrorMessage('')

    try {
      // Call background service to verify
      const response = (await chrome.runtime.sendMessage({
        type: 'VERIFY_LICENSE',
        payload: { key: keyInput.trim() },
      })) as VerifyLicenseResponse

      if (response.success) {
        setVerificationStatus('success')
        onTierChange('pro')
        onLicenseKeyChange(keyInput.trim())
      } else {
        setVerificationStatus('error')
        setErrorMessage(response.error ?? 'ライセンスキーが無効です')
      }
    } catch {
      setVerificationStatus('error')
      setErrorMessage('検証に失敗しました。ネットワーク接続を確認してください。')
    } finally {
      setIsVerifying(false)
    }
  }

  // Open upgrade page
  const handleUpgrade = () => {
    chrome.tabs.create({ url: 'https://diffsnap.io/pricing' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">アカウント</h2>
        <p className="text-sm text-gray-600">プランの管理とライセンスキーの設定を行います。</p>
      </div>

      {/* Tier Status */}
      <div
        className={`p-4 rounded-lg border-2 ${
          isPro
            ? 'bg-gradient-to-r from-primary-50 to-purple-50 border-primary-200'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPro && <Crown className="w-6 h-6 text-primary-600" />}
            <div>
              <p className="font-semibold text-gray-900">{isPro ? 'Pro プラン' : 'Free プラン'}</p>
              <p className="text-sm text-gray-600 mt-1">
                {isPro
                  ? '全機能がご利用いただけます'
                  : `月間 ${remainingImages} / 500 画像まで利用可能`}
              </p>
            </div>
          </div>

          {!isPro && (
            <button
              onClick={handleUpgrade}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              aria-label="Pro プランにアップグレード"
            >
              <Crown className="w-4 h-4" />
              Upgrade to Pro
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>

        {!isPro && monthlyResetAt && (
          <p className="text-xs text-gray-500 mt-2">次回リセット: {resetDate}</p>
        )}
      </div>

      {/* License Key Input (Pro only) */}
      {!isPro && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="licenseKey"
              className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
            >
              <Key className="w-4 h-4" />
              ライセンスキー
            </label>
            <input
              id="licenseKey"
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              aria-describedby="licenseKeyHelp"
              disabled={isVerifying}
            />
            <p id="licenseKeyHelp" className="text-xs text-gray-500 mt-1">
              Pro プランのライセンスキーを入力してください
            </p>
          </div>

          <button
            onClick={handleVerifyKey}
            disabled={isVerifying || !keyInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="ライセンスキーを検証"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                検証中...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                検証
              </>
            )}
          </button>

          {/* Verification Status */}
          {verificationStatus === 'success' && (
            <div
              className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg"
              role="alert"
            >
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm">ライセンスキーが正常に検証されました</p>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div
              className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg"
              role="alert"
            >
              <XCircle className="w-5 h-5" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}
        </div>
      )}

      {/* Pro Status */}
      {isPro && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-medium">Pro プラン有効</p>
          </div>
          {licenseKey && (
            <p className="text-xs text-green-600 mt-2">
              ライセンスキー: {licenseKey.slice(0, 4)}...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
