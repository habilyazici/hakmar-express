import type { ApiErrorEnvelope } from '@hakmar/contracts';
import { isAxiosError } from 'axios';

/**
 * The API answers in English, the interface is Turkish, and the messages that
 * matter most are the ones a user can act on — a duplicate name, a record
 * still referenced elsewhere, the last superadmin.
 *
 * These are matched on a stable prefix rather than the whole string so a
 * later wording tweak on the server does not silently drop a translation
 * back to the generic fallback. A message with no entry here still surfaces:
 * validation failures (400) name the offending field, and showing that in
 * English beats hiding it behind "check your input".
 */
const TRANSLATIONS: [string, string][] = [
  [
    'A record with these unique values already exists',
    'Aynı bilgilere sahip bir kayıt zaten var.',
  ],
  [
    'Related record is missing or still referenced',
    'Bu kayıt başka kayıtlar tarafından kullanılıyor ya da bağlı olduğu kayıt bulunamadı. Önce ona bağlı kayıtları silin.',
  ],
  ['Record not found', 'Kayıt bulunamadı.'],
  [
    'A provided value is too long',
    'Girdiğiniz değer bu alan için fazla uzun.',
  ],
  [
    'This is the last active superadmin',
    'Bu son aktif süper yönetici. Önce başka birini süper yönetici yapın.',
  ],
  [
    'You cannot deactivate your own account',
    'Kendi hesabınızı kapatamazsınız.',
  ],
  ['You cannot change your own role', 'Kendi rolünüzü değiştiremezsiniz.'],
  ['You cannot delete your own account', 'Kendi hesabınızı silemezsiniz.'],
  ['Current password is incorrect', 'Mevcut şifreniz hatalı.'],
  [
    'New password must differ',
    'Yeni şifre mevcut şifrenizden farklı olmalı.',
  ],
];

function translate(message: string | undefined): string | null {
  if (!message) return null;
  for (const [needle, turkish] of TRANSLATIONS) {
    if (message.includes(needle)) return turkish;
  }
  return null;
}

export function apiErrorMessage(error: unknown, noun = 'kayıt'): string {
  if (!isAxiosError(error)) {
    return 'Beklenmeyen bir hata oluştu.';
  }

  const status = error.response?.status;
  // The contract's own shape, rather than a structural type written out here
  // — the two used to agree only by coincidence.
  const body = error.response?.data as ApiErrorEnvelope | undefined;
  const serverMessage = body?.error?.message;
  const translated = translate(serverMessage);

  if (translated) return translated;

  switch (status) {
    case 400:
      // Untranslated on purpose: the server names the field that failed,
      // which is more useful than a generic Turkish sentence that does not.
      return serverMessage ?? 'Girdiğiniz bilgiler geçersiz.';
    case 401:
      return 'Oturumunuz sona ermiş görünüyor. Sayfayı yenileyin.';
    case 403:
      return 'Bu işlem için yetkiniz yok.';
    case 404:
      return `Bu ${noun} bulunamadı; başka biri silmiş olabilir.`;
    case 409:
      return `Bu ${noun} başka kayıtlarla ilişkili veya aynısı zaten var.`;
    case 429:
      return 'Çok fazla istek gönderildi. Bir dakika sonra tekrar deneyin.';
    default: {
      // A 5xx says nothing on purpose, which leaves the user with nothing to
      // report. The API returns the id it logged the failure under; showing
      // it is what makes "bir hata oluştu" actionable for whoever reads the
      // logs afterwards.
      const requestId = body?.error?.requestId;
      return requestId
        ? `İşlem tamamlanamadı. Tekrar deneyin; sürerse şu numarayı iletin: ${requestId}`
        : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
    }
  }
}
