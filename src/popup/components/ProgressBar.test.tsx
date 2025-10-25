import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  describe('Basic rendering', () => {
    it('renders progress bar with correct percentage', () => {
      render(<ProgressBar status="fetching" current={42} total={100} />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '42')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('displays status text correctly', () => {
      render(<ProgressBar status="detecting" current={0} total={100} />)
      expect(screen.getByText('Detecting images...')).toBeInTheDocument()
    })

    it('displays all status labels correctly', () => {
      const statuses: Array<{ status: 'detecting' | 'fetching' | 'creating-zip' | 'complete' | 'error', label: string }> = [
        { status: 'detecting', label: 'Detecting images...' },
        { status: 'fetching', label: 'Fetching images...' },
        { status: 'creating-zip', label: 'Creating ZIP...' },
        { status: 'complete', label: 'Complete' },
        { status: 'error', label: 'Error occurred' },
      ]

      statuses.forEach(({ status, label }) => {
        const { unmount } = render(<ProgressBar status={status} current={0} total={100} />)
        expect(screen.getByText(label)).toBeInTheDocument()
        unmount()
      })
    })

    it('displays current/total counter', () => {
      render(<ProgressBar status="fetching" current={42} total={100} />)
      expect(screen.getByText('42 / 100')).toBeInTheDocument()
    })

    it('displays percentage text', () => {
      render(<ProgressBar status="fetching" current={42} total={100} />)
      expect(screen.getByText('42%')).toBeInTheDocument()
    })
  })

  describe('Progress calculations', () => {
    it('calculates percentage correctly', () => {
      render(<ProgressBar status="fetching" current={50} total={200} />)
      expect(screen.getByText('25%')).toBeInTheDocument()
    })

    it('handles zero total gracefully', () => {
      render(<ProgressBar status="detecting" current={0} total={0} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
    })

    it('rounds percentage to integer', () => {
      render(<ProgressBar status="fetching" current={1} total={3} />)
      // 1/3 = 33.333... should be rounded to 33
      expect(screen.getByText('33%')).toBeInTheDocument()
    })

    it('shows 100% when current equals total', () => {
      render(<ProgressBar status="complete" current={100} total={100} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '100')
    })
  })

  describe('Error handling', () => {
    it('does not show error list when no failed images', () => {
      render(<ProgressBar status="fetching" current={10} total={100} />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows error list when failed images exist', () => {
      const failedImages = [
        { url: 'https://example.com/image1.jpg', error: 'Network timeout', retryCount: 0 },
      ]
      render(
        <ProgressBar
          status="error"
          current={99}
          total={100}
          failedImages={failedImages}
        />
      )
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Failed to fetch 1 image/)).toBeInTheDocument()
    })

    it('displays multiple failed images', () => {
      const failedImages = [
        { url: 'https://example.com/image1.jpg', error: 'Network timeout', retryCount: 0 },
        { url: 'https://example.com/image2.jpg', error: '404 Not Found', retryCount: 0 },
        { url: 'https://example.com/image3.jpg', error: 'CORS error', retryCount: 0 },
      ]
      render(
        <ProgressBar
          status="error"
          current={97}
          total={100}
          failedImages={failedImages}
        />
      )
      expect(screen.getByText(/Failed to fetch 3 images/)).toBeInTheDocument()
      expect(screen.getByText('Network timeout')).toBeInTheDocument()
      expect(screen.getByText('404 Not Found')).toBeInTheDocument()
      expect(screen.getByText('CORS error')).toBeInTheDocument()
    })

    it('truncates long URLs', () => {
      const longUrl = 'https://example.com/very/long/path/to/image/that/exceeds/fifty/characters/image.jpg'
      const failedImages = [{ url: longUrl, error: 'Error', retryCount: 0 }]
      render(
        <ProgressBar
          status="error"
          current={99}
          total={100}
          failedImages={failedImages}
        />
      )
      const urlElement = screen.getByTitle(longUrl)
      expect(urlElement.textContent).toMatch(/\.\.\.$/)
      expect(urlElement.textContent?.length ?? 0).toBeLessThanOrEqual(53) // 50 + "..."
    })

    it('does not truncate short URLs', () => {
      const shortUrl = 'https://example.com/img.jpg'
      const failedImages = [{ url: shortUrl, error: 'Error', retryCount: 0 }]
      render(
        <ProgressBar
          status="error"
          current={99}
          total={100}
          failedImages={failedImages}
        />
      )
      expect(screen.getByText(shortUrl)).toBeInTheDocument()
    })
  })

  describe('Retry functionality', () => {
    it('shows retry button when onRetry is provided', () => {
      const failedImages = [
        { url: 'https://example.com/image1.jpg', error: 'Network error', retryCount: 0 },
      ]
      const onRetry = vi.fn()
      render(
        <ProgressBar
          status="error"
          current={99}
          total={100}
          failedImages={failedImages}
          onRetry={onRetry}
        />
      )
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('does not show retry button when onRetry is not provided', () => {
      const failedImages = [
        { url: 'https://example.com/image1.jpg', error: 'Network error', retryCount: 0 },
      ]
      render(
        <ProgressBar
          status="error"
          current={99}
          total={100}
          failedImages={failedImages}
        />
      )
      expect(screen.queryByText('Retry')).not.toBeInTheDocument()
    })

    it('calls onRetry with correct URL when retry button is clicked', async () => {
      const user = userEvent.setup()
      const failedImages = [
        { url: 'https://example.com/image1.jpg', error: 'Network error', retryCount: 0 },
      ]
      const onRetry = vi.fn()
      render(
        <ProgressBar
          status="error"
          current={99}
          total={100}
          failedImages={failedImages}
          onRetry={onRetry}
        />
      )

      const retryButton = screen.getByRole('button', { name: /https:\/\/example\.com\/image1\.jpg/ })
      await user.click(retryButton)

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith('https://example.com/image1.jpg')
    })

    it('shows retry button for each failed image', () => {
      const failedImages = [
        { url: 'https://example.com/image1.jpg', error: 'Error 1', retryCount: 0 },
        { url: 'https://example.com/image2.jpg', error: 'Error 2', retryCount: 0 },
      ]
      const onRetry = vi.fn()
      render(
        <ProgressBar
          status="error"
          current={98}
          total={100}
          failedImages={failedImages}
          onRetry={onRetry}
        />
      )
      const retryButtons = screen.getAllByText('Retry')
      expect(retryButtons).toHaveLength(2)
    })
  })

  describe('Accessibility', () => {
    it('has proper region role', () => {
      render(<ProgressBar status="fetching" current={42} total={100} />)
      expect(screen.getByRole('region', { name: '進捗状況' })).toBeInTheDocument()
    })

    it('has aria-live for status updates', () => {
      render(<ProgressBar status="fetching" current={42} total={100} />)
      const statusElement = screen.getByText('Fetching images...')
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
    })

    it('has proper aria-label for progress percentage', () => {
      render(<ProgressBar status="fetching" current={42} total={100} />)
      expect(screen.getByLabelText('進捗: 42%')).toBeInTheDocument()
    })

    it('has proper aria-label for counter', () => {
      render(<ProgressBar status="fetching" current={42} total={100} />)
      expect(screen.getByLabelText('現在の進捗: 42件中100件')).toBeInTheDocument()
    })

    it('has proper aria-label for error count', () => {
      const failedImages = [
        { url: 'https://example.com/image1.jpg', error: 'Error 1', retryCount: 0 },
        { url: 'https://example.com/image2.jpg', error: 'Error 2', retryCount: 0 },
      ]
      render(
        <ProgressBar
          status="error"
          current={98}
          total={100}
          failedImages={failedImages}
        />
      )
      expect(screen.getByLabelText('2件のエラー')).toBeInTheDocument()
    })
  })

  describe('Visual styling', () => {
    it('applies correct progress bar width', () => {
      const { container } = render(<ProgressBar status="fetching" current={75} total={100} />)
      const progressBar = container.querySelector('[style*="width: 75%"]')
      expect(progressBar).toBeInTheDocument()
    })

    it('has transition class for smooth animation', () => {
      render(<ProgressBar status="fetching" current={50} total={100} />)
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveClass('transition-all', 'duration-300')
    })
  })
})
