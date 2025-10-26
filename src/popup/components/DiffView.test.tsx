import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { DiffView } from './DiffView'

describe('DiffView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const mockNewImages = [
    {
      url: 'https://example.com/new1.jpg',
      width: 800,
      height: 600,
      alt: 'New Image 1',
      hash: 'hash1',
    },
    {
      url: 'https://example.com/new2.jpg',
      width: 1024,
      height: 768,
      alt: 'New Image 2',
      hash: 'hash2',
    },
  ]

  const mockExistingImages = [
    {
      url: 'https://example.com/existing1.jpg',
      width: 1920,
      height: 1080,
      alt: 'Existing Image 1',
      hash: 'hash3',
    },
    {
      url: 'https://example.com/existing2.jpg',
      width: 640,
      height: 480,
      alt: 'Existing Image 2',
      hash: 'hash4',
    },
  ]

  describe('Free Tier', () => {
    it('renders upgrade banner for non-first visit', () => {
      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="free"
          isFirstVisit={false}
        />
      )

      expect(screen.getByText(/Proにアップグレードして差分機能を解放/)).toBeInTheDocument()
      expect(screen.getByText(/2枚の新規画像を検出しました/)).toBeInTheDocument()
    })

    it('renders first visit message for free tier', () => {
      render(
        <DiffView
          newImages={[]}
          existingImages={mockExistingImages}
          tier="free"
          isFirstVisit={true}
        />
      )

      expect(screen.getByText(/初回訪問です。次回訪問時から新規画像のみを自動検出できます/)).toBeInTheDocument()
    })

    it('displays total and new image counts for free tier', () => {
      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="free"
          isFirstVisit={false}
        />
      )

      expect(screen.getByText(/検出画像総数:/)).toBeInTheDocument()
      expect(screen.getByText(/4枚/)).toBeInTheDocument()
      expect(screen.getByText(/新規画像:/)).toBeInTheDocument()

      const newImageCountElements = screen.getAllByText(/2枚/)
      expect(newImageCountElements.length).toBeGreaterThanOrEqual(1)
    })

    it('calls onUpgrade when upgrade button clicked', async () => {
      const user = userEvent.setup()
      const mockOnUpgrade = vi.fn()

      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="free"
          isFirstVisit={false}
          onUpgrade={mockOnUpgrade}
        />
      )

      const upgradeButton = screen.getByRole('button', { name: /Proプランにアップグレード/ })
      await user.click(upgradeButton)

      expect(mockOnUpgrade).toHaveBeenCalledTimes(1)
    })

    it('opens options page when upgrade button clicked without onUpgrade handler', async () => {
      const user = userEvent.setup()
      const mockOpenOptionsPage = vi.fn()
      global.chrome = {
        runtime: {
          openOptionsPage: mockOpenOptionsPage,
        },
      } as unknown as typeof chrome

      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="free"
          isFirstVisit={false}
        />
      )

      const upgradeButton = screen.getByRole('button', { name: /Proプランにアップグレード/ })
      await user.click(upgradeButton)

      expect(mockOpenOptionsPage).toHaveBeenCalledTimes(1)
    })
  })

  describe('Pro Tier', () => {
    it('renders statistics correctly', () => {
      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
        />
      )

      expect(screen.getByText(/新規:/)).toBeInTheDocument()
      expect(screen.getByText(/既存:/)).toBeInTheDocument()
      expect(screen.getByText(/合計:/)).toBeInTheDocument()

      const twoImageElements = screen.getAllByText(/2枚/)
      expect(twoImageElements.length).toBe(2)

      const fourImageElements = screen.getAllByText(/4枚/)
      expect(fourImageElements.length).toBe(1)
    })

    it('renders first visit notice for pro tier', () => {
      render(
        <DiffView
          newImages={[]}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={true}
        />
      )

      expect(screen.getByText(/初回訪問です。次回訪問時から差分検出が有効になります/)).toBeInTheDocument()
    })

    it('renders two columns for new and existing images', () => {
      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
        />
      )

      expect(screen.getByText(/新規画像 \(2\)/)).toBeInTheDocument()
      expect(screen.getByText(/既存画像 \(2\)/)).toBeInTheDocument()
    })

    it('renders all new images with NEW badge', () => {
      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={[]}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const newBadges = screen.getAllByText('NEW')
      expect(newBadges).toHaveLength(2)
    })

    it('renders all existing images with EXISTING badge', () => {
      render(
        <DiffView
          newImages={[]}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const existingBadges = screen.getAllByText('EXISTING')
      expect(existingBadges).toHaveLength(2)
    })

    it('renders empty state when no new images', () => {
      render(
        <DiffView
          newImages={[]}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
        />
      )

      expect(screen.getByText(/新規画像はありません/)).toBeInTheDocument()
    })

    it('renders empty state when no existing images', () => {
      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={[]}
          tier="pro"
          isFirstVisit={false}
        />
      )

      expect(screen.getByText(/既存画像はありません/)).toBeInTheDocument()
    })

    it('calls onDownloadNew when "Download New Only" button clicked', async () => {
      const user = userEvent.setup()
      const mockOnDownloadNew = vi.fn()

      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
          onDownloadNew={mockOnDownloadNew}
        />
      )

      const downloadNewButton = screen.getByRole('button', { name: /新規画像のみダウンロード/ })
      await user.click(downloadNewButton)

      expect(mockOnDownloadNew).toHaveBeenCalledTimes(1)
    })

    it('calls onDownloadAll when "Download All" button clicked', async () => {
      const user = userEvent.setup()
      const mockOnDownloadAll = vi.fn()

      render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
          onDownloadAll={mockOnDownloadAll}
        />
      )

      const downloadAllButton = screen.getByRole('button', { name: /全画像ダウンロード/ })
      await user.click(downloadAllButton)

      expect(mockOnDownloadAll).toHaveBeenCalledTimes(1)
    })

    it('disables "Download New Only" button when no new images', () => {
      render(
        <DiffView
          newImages={[]}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const downloadNewButton = screen.getByRole('button', { name: /新規画像のみダウンロード/ })
      expect(downloadNewButton).toBeDisabled()
    })

    it('disables "Download All" button when no images at all', () => {
      render(
        <DiffView
          newImages={[]}
          existingImages={[]}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const downloadAllButton = screen.getByRole('button', { name: /全画像ダウンロード/ })
      expect(downloadAllButton).toBeDisabled()
    })

    it('displays image size on hover for new images', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <DiffView
          newImages={mockNewImages}
          existingImages={[]}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const imgs = container.querySelectorAll('img')
      const firstImg = imgs[0]
      if (!firstImg) throw new Error('Image not found')

      const firstCard = firstImg.closest('div')
      if (!firstCard) throw new Error('Card not found')

      // 画像のloadイベントを発火
      firstImg.dispatchEvent(new Event('load'))

      // loadイベントの処理を待機
      await waitFor(() => {
        expect(firstImg).toHaveClass('opacity-100')
      })

      // ホバー前はサイズが表示されていないことを確認
      expect(screen.queryByText('800 × 600')).not.toBeInTheDocument()

      // ホバー
      await user.hover(firstCard)

      // ホバー後はサイズが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('800 × 600')).toBeInTheDocument()
      })
    })

    it('applies green border to new image cards', () => {
      const { container } = render(
        <DiffView
          newImages={mockNewImages}
          existingImages={[]}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const imgs = container.querySelectorAll('img')
      imgs.forEach((img) => {
        const card = img.closest('div')
        expect(card).toHaveClass('border-green-400')
      })
    })

    it('applies gray border and reduced opacity to existing image cards', () => {
      const { container } = render(
        <DiffView
          newImages={[]}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const imgs = container.querySelectorAll('img')
      imgs.forEach((img) => {
        const card = img.closest('div')
        expect(card).toHaveClass('border-gray-300')
        expect(card).toHaveClass('opacity-60')
      })
    })

    it('displays error state when image fails to load', () => {
      const { container } = render(
        <DiffView
          newImages={mockNewImages}
          existingImages={[]}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const img = container.querySelector('img')
      if (!img) throw new Error('Image not found')

      img.dispatchEvent(new Event('error'))

      waitFor(() => {
        expect(screen.getByText(/読込失敗/)).toBeInTheDocument()
      })
    })

    it('uses lazy loading for all images', () => {
      const { container } = render(
        <DiffView
          newImages={mockNewImages}
          existingImages={mockExistingImages}
          tier="pro"
          isFirstVisit={false}
        />
      )

      const imgs = container.querySelectorAll('img')
      imgs.forEach((img) => {
        expect(img).toHaveAttribute('loading', 'lazy')
      })
    })
  })
})
