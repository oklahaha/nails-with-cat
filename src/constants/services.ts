/**
 * Services (活動) offered in the Add Appointment form, with the defaults the
 * existing AppSheet data uses most often for each:
 * - durationMinutes → Duration; End Time is derived from it. Services without
 *   a duration get End Time = start time.
 * - price → 收費, prefilled in the form and still editable.
 * - noHandOrFoot → the service doesn't ask for 手/腳, so the form hides it and
 *   saves it blank.
 * - hasDeposit → the form asks whether 訂金 was paid (TRUE / FALSE in the
 *   sheet's 訂金 column).
 * - viewIsCustomer → View is written with the customer's name (as AppSheet
 *   does for 粉嫩術). 特別事項 copies 備注 into View instead, in the forms.
 * - color → calendar bar/block colour. The first five keep the AppSheet
 *   timetable's hues (toned down so white text reads on them); the rest
 *   weren't visible there, so they're picked to be distinct.
 */
export const SERVICES = [
  { name: '整甲', durationMinutes: 150, price: 200, color: '#D2453E' },
  { name: '眼睫毛', durationMinutes: 120, price: 380, color: '#2E9E58' },
  { name: '整甲 + 眼睫毛', durationMinutes: 240, price: 580, color: '#8150D6' },
  { name: '補甲', durationMinutes: 60, price: 0, color: '#D17A1E' },
  { name: '拆甲', durationMinutes: 60, price: 100, color: '#A88C12' },
  // price is the full price; the forms lower it after a recent set (lashTopUpPrice)
  {
    name: '補眼睫毛',
    durationMinutes: 60,
    price: 428,
    color: '#3C72D6',
    noHandOrFoot: true,
    hasDeposit: true,
  },
  {
    name: '拆眼睫毛',
    durationMinutes: 60,
    price: 100,
    color: '#1A8F9E',
    noHandOrFoot: true,
    viewIsCustomer: true,
    hasDeposit: true,
  },
  {
    name: '粉嫩術',
    durationMinutes: 90,
    price: 2000,
    color: '#C9668E',
    noHandOrFoot: true,
    viewIsCustomer: true,
  },
  { name: '特別事項', durationMinutes: undefined, price: 0, color: '#AE45A8' },
] as const;

export type ServiceType = (typeof SERVICES)[number]['name'];

/** 手/腳 options, spelled exactly as in the sheet. */
export const HAND_OR_FOOT_OPTIONS = ['手', '腳', '手 + 腳'] as const;

export type HandOrFoot = (typeof HAND_OR_FOOT_OPTIONS)[number];

const UNKNOWN_SERVICE_COLOR = '#6E655F';

export function defaultDurationFor(service: ServiceType): number | undefined {
  return SERVICES.find((s) => s.name === service)?.durationMinutes;
}

/** Accepts any sheet value. 特別事項 is handled separately by the forms. */
export function usesHandOrFoot(service: string): boolean {
  const found = SERVICES.find((s) => s.name === service);
  return !(found && 'noHandOrFoot' in found && found.noHandOrFoot);
}

export function usesDeposit(service: string): boolean {
  const found = SERVICES.find((s) => s.name === service);
  return !!(found && 'hasDeposit' in found && found.hasDeposit);
}

/** The View value to send for a non-特別事項 booking, or undefined to leave it as is. */
export function viewFor(service: string, customerName: string): string | undefined {
  const found = SERVICES.find((s) => s.name === service);
  return found && 'viewIsCustomer' in found && found.viewIsCustomer
    ? customerName.trim()
    : undefined;
}

export function defaultPriceFor(service: ServiceType): number | undefined {
  return SERVICES.find((s) => s.name === service)?.price;
}

/** Accepts any sheet value, since old rows may hold services not listed here. */
export function serviceColor(service: string): string {
  return SERVICES.find((s) => s.name === service)?.color ?? UNKNOWN_SERVICE_COLOR;
}
