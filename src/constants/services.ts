/**
 * Services (活動) offered in the Add Appointment form, with the defaults the
 * existing AppSheet data uses most often for each:
 * - durationMinutes → Duration; End Time is derived from it. Services without
 *   a duration get End Time = start time.
 * - price → 收費, prefilled in the form and still editable.
 * - color → calendar bar/block colour. The first five match the AppSheet
 *   timetable; the rest weren't visible there, so they're picked to be distinct.
 */
export const SERVICES = [
  { name: '整甲', durationMinutes: 150, price: 200, color: '#E53935' },
  { name: '眼睫毛', durationMinutes: 120, price: 380, color: '#2DC653' },
  { name: '整甲 + 眼睫毛', durationMinutes: 240, price: 580, color: '#8E44EF' },
  { name: '補甲', durationMinutes: 60, price: 0, color: '#FF9800' },
  { name: '拆甲', durationMinutes: 60, price: 100, color: '#C8A600' },
  { name: '補眼睫毛', durationMinutes: 60, price: 0, color: '#2979FF' },
  { name: '拆眼睫毛', durationMinutes: 60, price: undefined, color: '#00ACC1' },
  { name: '粉嫩術', durationMinutes: undefined, price: undefined, color: '#F48FB1' },
  { name: '特別事項', durationMinutes: undefined, price: 0, color: '#E040D0' },
] as const;

export type ServiceType = (typeof SERVICES)[number]['name'];

/** 手/腳 options, spelled exactly as in the sheet. */
export const HAND_OR_FOOT_OPTIONS = ['手', '腳', '手 + 腳'] as const;

export type HandOrFoot = (typeof HAND_OR_FOOT_OPTIONS)[number];

const UNKNOWN_SERVICE_COLOR = '#757575';

export function defaultDurationFor(service: ServiceType): number | undefined {
  return SERVICES.find((s) => s.name === service)?.durationMinutes;
}

export function defaultPriceFor(service: ServiceType): number | undefined {
  return SERVICES.find((s) => s.name === service)?.price;
}

/** Accepts any sheet value, since old rows may hold services not listed here. */
export function serviceColor(service: string): string {
  return SERVICES.find((s) => s.name === service)?.color ?? UNKNOWN_SERVICE_COLOR;
}
