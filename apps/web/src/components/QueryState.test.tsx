import type { UseQueryResult } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryState } from './QueryState'

/**
 * Every analytics panel in the app renders through this, so what it decides
 * loading, failure and emptiness look like is what the whole application
 * looks like in those three states. It had no test: the smoke suite only
 * ever sees the success path, because it runs against a seeded database.
 */

type Fake<T> = Partial<UseQueryResult<T>>

function fakeQuery<T>(state: Fake<T>): UseQueryResult<T> {
  return {
    isPending: false,
    isError: false,
    data: undefined,
    refetch: vi.fn(),
    ...state,
  } as UseQueryResult<T>
}

describe('QueryState', () => {
  it('reports loading as a live region rather than an empty panel', () => {
    render(
      <QueryState query={fakeQuery<string>({ isPending: true })}>
        {(data) => <p>{data}</p>}
      </QueryState>,
    )

    // role="status" is what makes a screen reader announce the wait; a bare
    // <p> would leave the panel silently blank.
    expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor…')
  })

  it('offers a retry that actually refetches', async () => {
    const refetch = vi.fn()
    render(
      <QueryState query={fakeQuery<string>({ isError: true, refetch })}>
        {(data) => <p>{data}</p>}
      </QueryState>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Veri yüklenemedi.')
    await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('distinguishes "no data" from "failed"', () => {
    render(
      <QueryState
        query={fakeQuery<number[]>({ data: [] })}
        isEmpty={(rows) => rows.length === 0}
        emptyText="Bu aralıkta satış yok."
      >
        {(rows) => <p>{rows.length} satır</p>}
      </QueryState>,
    )

    expect(screen.getByText('Bu aralıkta satış yok.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the children with the data once it has arrived', () => {
    render(
      <QueryState query={fakeQuery<number[]>({ data: [1, 2, 3] })}>
        {(rows) => <p>{rows.length} satır</p>}
      </QueryState>,
    )

    expect(screen.getByText('3 satır')).toBeInTheDocument()
  })

  /**
   * An empty array is falsy-adjacent in a way that has bitten this kind of
   * component before: `isEmpty` must be consulted, not inferred, or a
   * legitimately empty result renders the children with nothing in them.
   */
  it('renders empty data as data when no isEmpty predicate is given', () => {
    render(
      <QueryState query={fakeQuery<number[]>({ data: [] })}>
        {(rows) => <p>{rows.length} satır</p>}
      </QueryState>,
    )

    expect(screen.getByText('0 satır')).toBeInTheDocument()
  })
})
