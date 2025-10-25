import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { PreviewGrid } from './PreviewGrid'

describe('PreviewGrid', () => {
  const mockImages = [
    {
      url: 'https://example.com/image1.jpg',
      width: 800,
      height: 600,
      alt: 'Test Image 1',
    },
    {
      url: 'https://example.com/image2.jpg',
      width: 1024,
      height: 768,
      alt: 'Test Image 2',
    },
    {
      url: 'https://example.com/image3.jpg',
      width: 1920,
      height: 1080,
      alt: 'Test Image 3',
    },
  ]

  const mockNewImages = [
    {
      url: 'https://example.com/new1.jpg',
      width: 800,
      height: 600,
      alt: 'New Image',
      isNew: true,
    },
  ]

  beforeEach(() => {
    // IntersectionObserver のモック
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
      takeRecords: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
    }))
  })

  it('renders grid with 3 columns', () => {
    render(<PreviewGrid images={mockImages} />)
    const grid = screen.getByRole('list', { name: '画像プレビューグリッド' })
    expect(grid).toHaveClass('grid-cols-3')
  })

  it('renders all images when count is less than maxDisplay', () => {
    render(<PreviewGrid images={mockImages} />)
    const images = screen.getAllByRole('listitem')
    expect(images).toHaveLength(3)
  })

  it('limits display to maxDisplay', () => {
    const manyImages = Array.from({ length: 150 }, (_, i) => ({
      url: `https://example.com/image${i}.jpg`,
      width: 800,
      height: 600,
      alt: `Image ${i}`,
    }))

    render(<PreviewGrid images={manyImages} maxDisplay={100} />)

    // 初期表示は12枚（遅延読込前）
    const images = screen.getAllByRole('listitem')
    expect(images.length).toBeLessThanOrEqual(12)

    // 最大表示数を超えた場合のメッセージ
    expect(screen.getByText(/表示中: 100 \/ 150 枚/)).toBeInTheDocument()
  })

  it('displays NEW badge for new images', () => {
    render(<PreviewGrid images={mockNewImages} />)
    expect(screen.getByText('NEW')).toBeInTheDocument()
  })

  it('displays image with alt text', () => {
    render(<PreviewGrid images={mockImages} />)
    const img = screen.getByAltText('Test Image 1')
    expect(img).toHaveAttribute('src', 'https://example.com/image1.jpg')
  })

  it('displays loading state initially', () => {
    render(<PreviewGrid images={mockImages} />)
    const imgs = screen.getAllByRole('img')
    imgs.forEach((img) => {
      expect(img).toHaveClass('opacity-0')
    })
  })

  it('displays error state when image fails to load', async () => {
    const { container } = render(<PreviewGrid images={mockImages} />)
    const img = screen.getAllByRole('img')[0]
    if (!img) throw new Error('Image not found')

    // 画像の読込失敗をシミュレート
    img.dispatchEvent(new Event('error'))

    await waitFor(() => {
      expect(container.textContent).toContain('読込失敗')
    })
  })

  it('displays image size on hover', async () => {
    const user = userEvent.setup()
    render(<PreviewGrid images={mockImages} />)

    const imgs = screen.getAllByRole('img')
    const firstImg = imgs[0]
    if (!firstImg) throw new Error('Image not found')

    // 画像の読込完了をシミュレート
    firstImg.dispatchEvent(new Event('load'))

    const listItems = screen.getAllByRole('listitem')
    const firstItem = listItems[0]
    if (!firstItem) throw new Error('List item not found')

    // hover前は表示されていない
    expect(screen.queryByText('800 × 600')).not.toBeInTheDocument()

    // hover
    await user.hover(firstItem)

    await waitFor(() => {
      expect(screen.getByText('800 × 600')).toBeInTheDocument()
    })
  })

  it('displays alt text on hover when available', async () => {
    const user = userEvent.setup()
    render(<PreviewGrid images={mockImages} />)

    const imgs = screen.getAllByRole('img')
    const firstImg = imgs[0]
    if (!firstImg) throw new Error('Image not found')

    // 画像の読込完了をシミュレート
    firstImg.dispatchEvent(new Event('load'))

    const listItems = screen.getAllByRole('listitem')
    const firstItem = listItems[0]
    if (!firstItem) throw new Error('List item not found')

    await user.hover(firstItem)

    await waitFor(() => {
      expect(screen.getByText('Test Image 1')).toBeInTheDocument()
    })
  })

  it('displays fallback message on hover when no metadata', async () => {
    const user = userEvent.setup()
    const imageWithoutMeta = [
      {
        url: 'https://example.com/image.jpg',
      },
    ]

    const { container } = render(<PreviewGrid images={imageWithoutMeta} />)

    const firstImg = container.querySelector('img')
    if (!firstImg) throw new Error('Image not found')

    // 画像の読込完了をシミュレート
    firstImg.dispatchEvent(new Event('load'))

    const listItems = screen.getAllByRole('listitem')
    const firstItem = listItems[0]
    if (!firstItem) throw new Error('List item not found')

    await user.hover(firstItem)

    await waitFor(() => {
      expect(screen.getByText('情報なし')).toBeInTheDocument()
    })
  })

  it('uses lazy loading for images', () => {
    render(<PreviewGrid images={mockImages} />)
    const imgs = screen.getAllByRole('img')
    imgs.forEach((img) => {
      expect(img).toHaveAttribute('loading', 'lazy')
    })
  })

  it('sets up IntersectionObserver for lazy loading more images', () => {
    const manyImages = Array.from({ length: 50 }, (_, i) => ({
      url: `https://example.com/image${i}.jpg`,
    }))

    render(<PreviewGrid images={manyImages} />)

    expect(global.IntersectionObserver).toHaveBeenCalled()
  })

  it('applies correct aspect ratio for cards', () => {
    render(<PreviewGrid images={mockImages} />)
    const listItems = screen.getAllByRole('listitem')
    listItems.forEach((item) => {
      expect(item).toHaveClass('aspect-square')
    })
  })

  it('applies object-fit cover to images', () => {
    render(<PreviewGrid images={mockImages} />)
    const imgs = screen.getAllByRole('img')
    imgs.forEach((img) => {
      expect(img).toHaveClass('object-cover')
    })
  })
})
