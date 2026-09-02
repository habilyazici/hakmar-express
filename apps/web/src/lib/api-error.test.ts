import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from './api-error';

function apiError(status: number, message?: string): AxiosError {
  const error = new AxiosError('request failed');
  error.response = {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: message ? { success: false, error: { code: '', message } } : {},
  };
  return error;
}

describe('apiErrorMessage', () => {
  it('translates the messages a user can act on', () => {
    expect(
      apiErrorMessage(
        apiError(409, 'A record with these unique values already exists.'),
      ),
    ).toContain('zaten var');

    expect(
      apiErrorMessage(
        apiError(409, 'Related record is missing or still referenced.'),
      ),
    ).toContain('kullanılıyor');

    expect(
      apiErrorMessage(
        apiError(
          409,
          'This is the last active superadmin; promote another one first.',
        ),
      ),
    ).toContain('son aktif süper yönetici');
  });

  /**
   * Matched on a prefix so a later wording change on the server degrades to
   * the generic Turkish message rather than leaking English.
   */
  it('still matches when the server message gains a suffix', () => {
    expect(
      apiErrorMessage(apiError(409, 'Record not found in table x')),
    ).toBe('Kayıt bulunamadı.');
  });

  it('keeps a 400 message verbatim, because it names the failing field', () => {
    expect(
      apiErrorMessage(apiError(400, 'plateCode must not be greater than 81')),
    ).toBe('plateCode must not be greater than 81');
  });

  it.each([
    [401, 'Oturumunuz'],
    [403, 'yetkiniz yok'],
    [429, 'Çok fazla istek'],
  ])('gives a Turkish message for %i', (status, fragment) => {
    expect(apiErrorMessage(apiError(status))).toContain(fragment);
  });

  it('names the entity in the 404 and 409 fallbacks', () => {
    expect(apiErrorMessage(apiError(404), 'ürün')).toContain('ürün');
    expect(apiErrorMessage(apiError(409), 'marka')).toContain('marka');
  });

  it('falls back for an unrecognised status', () => {
    expect(apiErrorMessage(apiError(500))).toBe(
      'İşlem tamamlanamadı. Lütfen tekrar deneyin.',
    );
  });

  /**
   * A 500 deliberately says nothing about what went wrong, which leaves the
   * user with nothing to report. The API returns the id it logged the
   * failure under; surfacing it is what makes the report actionable.
   */
  it('quotes the request id when the server sends one', () => {
    const error = apiError(500);
    error.response!.data = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: 'ab12-cd34',
      },
    };

    expect(apiErrorMessage(error)).toContain('ab12-cd34');
  });

  it('handles something that is not an axios error at all', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe(
      'Beklenmeyen bir hata oluştu.',
    );
  });
});
