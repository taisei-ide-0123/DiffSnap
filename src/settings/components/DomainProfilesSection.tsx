import { useState } from 'react'
import { Plus, Edit2, Trash2, Globe } from 'lucide-react'
import type { DomainProfile } from '@/shared/types'
import { ProfileEditModal } from './ProfileEditModal'

interface DomainProfilesSectionProps {
  profiles: DomainProfile[]
  onProfilesChange: (profiles: DomainProfile[]) => void
}

export const DomainProfilesSection = ({
  profiles,
  onProfilesChange,
}: DomainProfilesSectionProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<DomainProfile | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Open modal for adding new profile
  const handleAdd = () => {
    setEditingProfile(null)
    setEditingIndex(null)
    setIsModalOpen(true)
  }

  // Open modal for editing existing profile
  const handleEdit = (profile: DomainProfile, index: number) => {
    setEditingProfile(profile)
    setEditingIndex(index)
    setIsModalOpen(true)
  }

  // Delete profile
  const handleDelete = (index: number) => {
    const newProfiles = profiles.filter((_, i) => i !== index)
    onProfilesChange(newProfiles)
  }

  // Save profile (add or update)
  const handleSave = (profile: DomainProfile) => {
    if (editingIndex !== null) {
      // Update existing
      const newProfiles = profiles.map((p, i) => (i === editingIndex ? profile : p))
      onProfilesChange(newProfiles)
    } else {
      // Add new
      onProfilesChange([...profiles, profile])
    }

    setIsModalOpen(false)
    setEditingProfile(null)
    setEditingIndex(null)
  }

  // Cancel editing
  const handleCancel = () => {
    setIsModalOpen(false)
    setEditingProfile(null)
    setEditingIndex(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">ドメインプロファイル</h2>
          <p className="text-sm text-gray-600">
            特定のドメインに対する画像フィルタ設定を管理します。
          </p>
        </div>

        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          aria-label="新しいプロファイルを追加"
        >
          <Plus className="w-4 h-4" />
          追加
        </button>
      </div>

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
          <Globe className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">プロファイルが登録されていません</p>
          <button
            onClick={handleAdd}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            最初のプロファイルを作成
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-primary-600 flex-shrink-0" />
                    <h3 className="font-semibold text-gray-900 truncate">{profile.domain}</h3>
                  </div>

                  <div className="space-y-1 text-sm">
                    {profile.includePattern && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-20">Include:</span>
                        <code className="text-green-700 bg-green-50 px-2 py-0.5 rounded font-mono text-xs">
                          {profile.includePattern}
                        </code>
                      </div>
                    )}

                    {profile.excludePattern && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-20">Exclude:</span>
                        <code className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-mono text-xs">
                          {profile.excludePattern}
                        </code>
                      </div>
                    )}

                    {profile.minWidth && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 w-20">最小幅:</span>
                        <span className="text-gray-700">{profile.minWidth} px</span>
                      </div>
                    )}

                    {!profile.includePattern && !profile.excludePattern && !profile.minWidth && (
                      <p className="text-gray-400 italic">フィルタ設定なし</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(profile, index)}
                    className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
                    aria-label={`${profile.domain} を編集`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(index)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    aria-label={`${profile.domain} を削除`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <ProfileEditModal profile={editingProfile} onSave={handleSave} onCancel={handleCancel} />
      )}
    </div>
  )
}
