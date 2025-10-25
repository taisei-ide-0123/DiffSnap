import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Header } from './Header'

describe('Header', () => {
  it('renders logo and title', () => {
    render(<Header />)
    expect(screen.getByRole('heading', { name: 'DiffSnap' })).toBeInTheDocument()
  })

  it('displays image count', () => {
    render(<Header imageCount={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('images')).toBeInTheDocument()
  })

  it('displays default image count of 0', () => {
    render(<Header />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('displays Free tier badge by default', () => {
    render(<Header />)
    expect(screen.getByLabelText('プラン: Free')).toHaveTextContent('Free')
  })

  it('displays Pro tier badge when tier is Pro', () => {
    render(<Header tier="Pro" />)
    const badge = screen.getByLabelText('プラン: Pro')
    expect(badge).toHaveTextContent('Pro')
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
  })

  it('displays Free tier badge with different styles', () => {
    render(<Header tier="Free" />)
    const badge = screen.getByLabelText('プラン: Free')
    expect(badge).toHaveTextContent('Free')
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800')
  })

  it('has accessible image count with aria-live', () => {
    render(<Header imageCount={10} />)
    const imageCountElement = screen.getByLabelText('検出画像数: 10枚')
    expect(imageCountElement).toHaveAttribute('aria-live', 'polite')
  })
})
