import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('render exploded')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error itself, and the boundary logs it again on
    // purpose. Neither is a failure; silence both so a passing run is quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes children through when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>her şey yolunda</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('her şey yolunda')).toBeInTheDocument()
  })

  /**
   * Without the boundary, a render-time exception unmounts the entire tree
   * and leaves a blank white page. The smoke suite asserts this heading is
   * *absent* on every route, which only means anything if it appears when
   * something really does throw.
   */
  it('shows a recoverable message instead of a blank page', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Bir şeyler ters gitti' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sayfayı yenile' }),
    ).toBeInTheDocument()
  })
})
