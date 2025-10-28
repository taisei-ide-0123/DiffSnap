import { useState, useEffect, useMemo } from 'react'
import { FileText, Info } from 'lucide-react'
import { evaluateTemplate } from '@/shared/utils/template'

interface NamingTemplateSectionProps {
  template: string
  onTemplateChange: (template: string) => void
}

// Template presets
const PRESETS = [
  {
    name: 'デフォルト',
    value: '{date}-{domain}-{w}x{h}-{index}',
    description: '日付-ドメイン-サイズ-番号',
  },
  {
    name: 'シンプル',
    value: '{domain}-{index}',
    description: 'ドメイン-番号',
  },
  {
    name: '詳細',
    value: '{date}-{domain}-{alt}-{w}x{h}-{index}',
    description: '日付-ドメイン-Alt-サイズ-番号',
  },
  {
    name: 'タイムスタンプ',
    value: '{timestamp}-{domain}-{index}',
    description: 'Unix時刻-ドメイン-番号',
  },
  {
    name: 'サイズ重視',
    value: '{w}x{h}-{domain}-{date}-{index}',
    description: 'サイズ-ドメイン-日付-番号',
  },
]

// Available variables
const VARIABLES = [
  { name: '{date}', description: '日付 (YYYY-MM-DD)', example: '2025-01-15' },
  { name: '{timestamp}', description: 'Unix タイムスタンプ', example: '1705305600' },
  { name: '{domain}', description: 'ドメイン名', example: 'example.com' },
  { name: '{w}', description: '画像幅 (px)', example: '800' },
  { name: '{h}', description: '画像高さ (px)', example: '600' },
  { name: '{alt}', description: 'Alt テキスト', example: 'sample-image' },
  { name: '{index}', description: '連番 (001, 002...)', example: '001' },
]

// Sample data for preview
const getTodayDate = (): string => {
  return new Date().toISOString().slice(0, 10)
}

const SAMPLE_DATA: Array<Record<string, string>> = [
  {
    date: getTodayDate(),
    timestamp: Math.floor(Date.now() / 1000).toString(),
    domain: 'example.com',
    w: '800',
    h: '600',
    alt: 'sample-image',
    index: '001',
  },
  {
    date: getTodayDate(),
    timestamp: Math.floor(Date.now() / 1000).toString(),
    domain: 'test.co.jp',
    w: '1920',
    h: '1080',
    alt: 'hero-banner',
    index: '002',
  },
  {
    date: getTodayDate(),
    timestamp: Math.floor(Date.now() / 1000).toString(),
    domain: 'photos.net',
    w: '1200',
    h: '800',
    alt: '',
    index: '003',
  },
]

export const NamingTemplateSection = ({
  template,
  onTemplateChange,
}: NamingTemplateSectionProps) => {
  const [customTemplate, setCustomTemplate] = useState(template)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  // Update custom template when prop changes
  useEffect(() => {
    setCustomTemplate(template)

    // Check if current template matches a preset
    const matchingPreset = PRESETS.find((p) => p.value === template)
    setSelectedPreset(matchingPreset?.name ?? null)
  }, [template])

  // Preview samples
  const previewSamples = useMemo(
    () => SAMPLE_DATA.map((data) => evaluateTemplate(customTemplate, data)),
    [customTemplate]
  )

  // Check for invalid variables
  const hasErrors = previewSamples.some((sample) => sample.startsWith('❌'))

  // Handle preset selection
  const handlePresetSelect = (presetValue: string, presetName: string) => {
    setCustomTemplate(presetValue)
    setSelectedPreset(presetName)
    onTemplateChange(presetValue)
  }

  // Handle custom template change
  const handleCustomChange = (value: string) => {
    setCustomTemplate(value)
    setSelectedPreset(null)
    onTemplateChange(value)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">命名テンプレート</h2>
        <p className="text-sm text-gray-600">ダウンロードする画像のファイル名形式を設定します。</p>
      </div>

      {/* Presets */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-3 block">プリセット</label>
        <div className="grid grid-cols-1 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePresetSelect(preset.value, preset.name)}
              className={`p-3 text-left border rounded-lg transition-colors ${
                selectedPreset === preset.name
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              aria-pressed={selectedPreset === preset.name}
            >
              <p className="font-medium text-gray-900">{preset.name}</p>
              <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
              <p className="text-xs text-primary-600 mt-1 font-mono">{preset.value}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Template Input */}
      <div>
        <label htmlFor="customTemplate" className="text-sm font-medium text-gray-700 mb-2 block">
          カスタムテンプレート
        </label>
        <input
          id="customTemplate"
          type="text"
          value={customTemplate}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="{date}-{domain}-{w}x{h}-{index}"
          className={`w-full px-4 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            hasErrors ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
          aria-describedby="templateHelp"
        />
        <p id="templateHelp" className="text-xs text-gray-500 mt-1">
          利用可能な変数: {VARIABLES.map((v) => v.name).join(', ')}
        </p>
      </div>

      {/* Preview */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">プレビュー</label>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
          {previewSamples.map((sample, index) => (
            <div
              key={index}
              className={`p-2 rounded font-mono text-sm ${
                sample.startsWith('❌') ? 'bg-red-100 text-red-700' : 'bg-white text-gray-900'
              }`}
            >
              {sample}.jpg
            </div>
          ))}
        </div>
        {hasErrors && (
          <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            無効な変数が含まれています
          </p>
        )}
      </div>

      {/* Variable Reference */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">変数リファレンス</label>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-700">変数</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700">説明</th>
                <th className="text-left py-2 px-2 font-medium text-gray-700">例</th>
              </tr>
            </thead>
            <tbody>
              {VARIABLES.map((variable, index) => (
                <tr key={index} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 px-2 font-mono text-primary-600">{variable.name}</td>
                  <td className="py-2 px-2 text-gray-600">{variable.description}</td>
                  <td className="py-2 px-2 font-mono text-gray-500 text-xs">{variable.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
