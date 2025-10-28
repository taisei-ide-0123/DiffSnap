import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { Footer } from './Footer'

describe('Footer', () => {
  it('renders download button and settings button', () => {
    render(<Footer />)
    expect(screen.getByRole('button', { name: 'Download all images' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument()
  })

  it('calls onDownload when download button is clicked', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    render(<Footer onDownload={onDownload} />)

    await user.click(screen.getByRole('button', { name: 'Download all images' }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('shows downloading state', () => {
    render(<Footer isDownloading={true} />)
    expect(screen.getByRole('button', { name: 'Downloading images' })).toBeInTheDocument()
    expect(screen.getByText('Downloading...')).toBeInTheDocument()
  })

  it('disables download button when disabled prop is true', () => {
    render(<Footer disabled={true} />)
    const button = screen.getByRole('button', { name: 'Download all images' })
    expect(button).toBeDisabled()
  })

  it('disables download button when isDownloading is true', () => {
    render(<Footer isDownloading={true} />)
    const button = screen.getByRole('button', { name: 'Downloading images' })
    expect(button).toBeDisabled()
  })

  it('calls onOpenSettings when settings button is clicked', async () => {
    const user = userEvent.setup()
    const onOpenSettings = vi.fn()
    render(<Footer onOpenSettings={onOpenSettings} />)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('calls chrome.runtime.openOptionsPage when onOpenSettings is not provided', async () => {
    const user = userEvent.setup()
    const openOptionsPage = vi.fn()
    vi.stubGlobal('chrome', {
      runtime: {
        openOptionsPage,
      },
    })

    render(<Footer />)
    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(openOptionsPage).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('has accessible button labels', () => {
    render(<Footer />)
    expect(screen.getByLabelText('Download all images')).toBeInTheDocument()
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument()
  })
})
