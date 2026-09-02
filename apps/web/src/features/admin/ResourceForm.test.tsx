import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { FieldDef } from './resource-types'
import { ResourceForm } from './ResourceForm'

/**
 * Yönetim drives all nine master-data entities through this one form, from a
 * declarative table of field definitions. That makes it the single place a
 * mistake reaches every entity at once — and it had no test, because nothing
 * in this app mounted a component until now.
 *
 * What is asserted here is the part the API cannot save us from: it validates
 * every write regardless, but it cannot tell us that a number field sent a
 * string, or that clearing a field sent "" instead of dropping the key.
 */

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Ad', type: 'text', required: true },
  { name: 'plateCode', label: 'Plaka', type: 'number' },
  { name: 'isActive', label: 'Aktif', type: 'checkbox' },
  {
    name: 'gender',
    label: 'Cinsiyet',
    type: 'select',
    options: [
      { value: '', label: 'Seçiniz…' },
      { value: 'K', label: 'Kadın' },
      { value: 'E', label: 'Erkek' },
    ],
  },
]

/** Drives the form the way ResourceManager does: it owns the values. */
function Harness({
  onSubmit = vi.fn(),
  initial = {},
  fields = FIELDS,
}: {
  onSubmit?: () => void
  initial?: Record<string, unknown>
  fields?: FieldDef[]
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ResourceForm
        fields={fields}
        values={values}
        onChange={setValues}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isSaving={false}
        error={null}
        submitLabel="Kaydet"
      />
      <pre data-testid="values">{JSON.stringify(values)}</pre>
    </QueryClientProvider>
  )
}

function values() {
  return JSON.parse(screen.getByTestId('values').textContent ?? '{}') as Record<
    string,
    unknown
  >
}

describe('ResourceForm', () => {
  it('labels every field so it can be reached by name', () => {
    render(<Harness />)

    // Not cosmetic: the label is the accessible name, and it is also how
    // these tests — and anyone using a screen reader — find the input at all.
    expect(screen.getByLabelText(/Ad/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Plaka/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Aktif/)).toBeInTheDocument()
  })

  it('marks a required field both visually and to the browser', () => {
    render(<Harness />)

    expect(screen.getByLabelText(/Ad/)).toBeRequired()
    expect(screen.getByLabelText(/Plaka/)).not.toBeRequired()
  })

  it('sends a number field as a number, not as the string typed into it', async () => {
    render(<Harness />)

    await userEvent.type(screen.getByLabelText(/Plaka/), '34')

    // `"34"` would clear the API's @IsInt() and fail as a 400 the form can
    // only display, which is exactly the failure this form's genericness
    // makes easy to introduce for all nine entities at once.
    expect(values().plateCode).toBe(34)
  })

  it('drops a cleared field rather than sending an empty string', async () => {
    render(<Harness initial={{ name: 'Ankara' }} />)

    await userEvent.clear(screen.getByLabelText(/Ad/))

    // undefined disappears from the JSON body; "" would reach the API as a
    // real value and fail @MinLength — a different error for "I removed this".
    expect('name' in values()).toBe(false)
  })

  it('sends a checkbox as a boolean', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByLabelText(/Aktif/))
    expect(values().isActive).toBe(true)

    await userEvent.click(screen.getByLabelText(/Aktif/))
    expect(values().isActive).toBe(false)
  })

  it('submits without reloading the page', async () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/Ad/), 'Ankara')
    await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows a save failure as an alert', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ResourceForm
          fields={FIELDS}
          values={{}}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          isSaving={false}
          error="Aynı bilgilere sahip bir kayıt zaten var."
          submitLabel="Kaydet"
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Aynı bilgilere sahip bir kayıt zaten var.',
    )
  })

  it('disables the submit button while a save is in flight', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ResourceForm
          fields={FIELDS}
          values={{}}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          isSaving
          error={null}
          submitLabel="Kaydet"
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: 'Kaydediliyor…' })).toBeDisabled()
  })
})
