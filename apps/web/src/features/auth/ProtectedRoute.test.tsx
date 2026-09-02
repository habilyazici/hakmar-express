import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue } from './auth-context'
import { ProtectedRoute } from './ProtectedRoute'

/**
 * The one component standing between an unauthenticated visitor and every
 * page in the application. The API refuses the requests regardless, but a
 * route that renders its page and only then discovers there is no session
 * shows a screenful of failed panels instead of a login form.
 */

const ANALYST: AuthContextValue['user'] = {
  sub: 1,
  username: 'analiz',
  role: 'ANALYST',
}

function renderAt(auth: Partial<AuthContextValue>) {
  const value: AuthContextValue = {
    user: null,
    isLoading: false,
    login: async () => {},
    logout: async () => {},
    ...auth,
  }

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<h1>Giriş</h1>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <h1>Genel Bakış</h1>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute', () => {
  it('renders the page for a signed-in user', () => {
    renderAt({ user: ANALYST })
    expect(
      screen.getByRole('heading', { name: 'Genel Bakış' }),
    ).toBeInTheDocument()
  })

  it('sends an unauthenticated visitor to the login page', () => {
    renderAt({ user: null })
    expect(screen.getByRole('heading', { name: 'Giriş' })).toBeInTheDocument()
    expect(screen.queryByText('Genel Bakış')).not.toBeInTheDocument()
  })

  /**
   * Every cold load starts with no user and a refresh in flight. Redirecting
   * on that would bounce a perfectly valid session to /login on every hard
   * reload, and rendering null — which this used to do — showed a blank white
   * page indistinguishable from a crash.
   */
  it('waits, visibly, while the session is still being restored', () => {
    renderAt({ user: null, isLoading: true })

    expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor…')
    expect(screen.queryByText('Giriş')).not.toBeInTheDocument()
    expect(screen.queryByText('Genel Bakış')).not.toBeInTheDocument()
  })
})
