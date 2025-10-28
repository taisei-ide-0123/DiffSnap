import { useState, useEffect } from 'react'
import { Save, User, FileText, Globe, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import type { UserConfig, DomainProfile } from '@/shared/types'
import { AccountSection } from './components/AccountSection'
import { NamingTemplateSection } from './components/NamingTemplateSection'
import { DomainProfilesSection } from './components/DomainProfilesSection'
import { AdvancedSection } from './components/AdvancedSection'

const DEFAULT_CONFIG: UserConfig = {
  tier: 'free',
  namingTemplate: '{date}-{domain}-{w}x{h}-{index}',
  domainProfiles: [],
}

export const App = () => {
  const [config, setConfig] = useState<UserConfig>(DEFAULT_CONFIG)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>('account')

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await chrome.storage.sync.get(['config'])
        if (result.config) {
          setConfig(result.config as UserConfig)
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }

    loadConfig()
  }, [])

  // Save config handler
  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      await chrome.storage.sync.set({ config })
      setSaveMessage('設定を保存しました')

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Failed to save config:', error)
      setSaveMessage('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  // Update config handlers
  const updateTier = (tier: 'free' | 'pro') => {
    setConfig((prev) => ({ ...prev, tier }))
  }

  const updateLicenseKey = (licenseKey: string) => {
    setConfig((prev) => ({ ...prev, licenseKey }))
  }

  const updateNamingTemplate = (template: string) => {
    setConfig((prev) => ({ ...prev, namingTemplate: template }))
  }

  const updateDomainProfiles = (profiles: DomainProfile[]) => {
    setConfig((prev) => ({ ...prev, domainProfiles: profiles }))
  }

  const sections = [
    { id: 'account', label: 'アカウント', icon: User },
    { id: 'naming', label: '命名テンプレート', icon: FileText },
    { id: 'domains', label: 'ドメインプロファイル', icon: Globe },
    { id: 'advanced', label: '詳細設定', icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">DiffSnap 設定</h1>
                <p className="text-sm text-gray-500">
                  {config.tier === 'pro' ? 'Pro' : 'Free'} プラン
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="設定を保存"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>

          {/* Save message */}
          {saveMessage && (
            <div
              className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                saveMessage.includes('失敗')
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
              }`}
              role="alert"
            >
              {saveMessage}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <nav className="w-64 flex-shrink-0" aria-label="設定ナビゲーション">
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id

                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-5 h-5" />
                    {section.label}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {activeSection === 'account' && (
                <AccountSection
                  tier={config.tier}
                  licenseKey={config.licenseKey}
                  monthlyCount={config.monthlyCount}
                  monthlyResetAt={config.monthlyResetAt}
                  onTierChange={updateTier}
                  onLicenseKeyChange={updateLicenseKey}
                />
              )}

              {activeSection === 'naming' && (
                <NamingTemplateSection
                  template={config.namingTemplate}
                  onTemplateChange={updateNamingTemplate}
                />
              )}

              {activeSection === 'domains' && (
                <DomainProfilesSection
                  profiles={config.domainProfiles}
                  onProfilesChange={updateDomainProfiles}
                />
              )}

              {activeSection === 'advanced' && <AdvancedSection />}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
