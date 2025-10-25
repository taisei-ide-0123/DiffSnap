import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { Footer } from './Footer'

describe('Footer', () => {
  it('renders download button and settings button', () => {
    render(<Footer />)
    expect(
      screen.getByRole('button', { name: '全画像ダウンロード' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '設定を開く' })
    ).toBeInTheDocument()
  })

  it('calls onDownload when download button is clicked', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    render(<Footer onDownload={onDownload} />)

    await user.click(screen.getByRole('button', { name: '全画像ダウンロード' }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('shows downloading state', () => {
    render(<Footer isDownloading={true} />)
    expect(
      screen.getByRole('button', { name: 'ダウンロード中' })
    ).toBeInTheDocument()
    expect(screen.getByText('Downloading...')).toBeInTheDocument()
  })

  it('disables download button when disabled prop is true', () => {
    render(<Footer disabled={true} />)
    const button = screen.getByRole('button', { name: '全画像ダウンロード' })
    expect(button).toBeDisabled()
  })

  it('disables download button when isDownloading is true', () => {
    render(<Footer isDownloading={true} />)
    const button = screen.getByRole('button', { name: 'ダウンロード中' })
    expect(button).toBeDisabled()
  })

  it('calls onOpenSettings when settings button is clicked', async () => {
    const user = userEvent.setup()
    const onOpenSettings = vi.fn()
    render(<Footer onOpenSettings={onOpenSettings} />)

    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('calls chrome.runtime.openOptionsPage when onOpenSettings is not provided', async () => {
    const user = userEvent.setup()
    const openOptionsPage = vi.fn()
    global.chrome = {
      runtime: {
        openOptionsPage,
      },
    } as typeof chrome

    render(<Footer />)
    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    expect(openOptionsPage).toHaveBeenCalledTimes(1)
  })

  it('has accessible button labels', () => {
    render(<Footer />)
    expect(
      screen.getByLabelText('全画像ダウンロード')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('設定を開く')).toBeInTheDocument()
  })
})
