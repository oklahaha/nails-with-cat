/**
 * Services (活動) offered in the Add Appointment form, with the defaults the
 * existing AppSheet data uses most often for each:
 * - durationMinutes → Duration; End Time is derived from it. Services without
 *   a duration get End Time = start time. durationByHandOrFoot overrides it
 *   for the 手/腳 choices that take a different time.
 * - price → 收費, prefilled in the form and still editable. priceByHandOrFoot
 *   overrides it like durationByHandOrFoot, and the 整甲 add-ons add to it.
 * - noHandOrFoot → the service doesn't ask for 手/腳, so the form hides it and
 *   saves it blank.
 * - hasDeposit → the form asks whether 訂金 was paid (TRUE / FALSE in the
 *   sheet's 訂金 column); every service but 特別事項. New bookings start on paid.
 * - hasNailExtras → the form asks for 複雜款 (COMPLEX_DESIGN_OPTIONS) and
 *   NAIL_EXTRAS (TRUE / FALSE columns).
 * - color → calendar bar/block colour. The first five keep the AppSheet
 *   timetable's hues (toned down so white text reads on them); the rest
 *   weren't visible there, so they're picked to be distinct.
 */
export const SERVICES = [
  {
    name: '整甲',
    // For 手; 腳 and 手 + 腳 take durationByHandOrFoot, and 複雜款, 拆甲 and
    // 延長 add time on top (defaultDurationFor)
    durationMinutes: 120,
    durationByHandOrFoot: { 腳: 60, '手 + 腳': 180 },
    // Same for 收費
    price: 218,
    priceByHandOrFoot: { 腳: 298, '手 + 腳': 516 },
    color: '#D2453E',
    hasNailExtras: true,
    hasDeposit: true,
  },
  {
    name: '眼睫毛',
    durationMinutes: 120,
    price: 428,
    color: '#2E9E58',
    noHandOrFoot: true,
    hasDeposit: true,
  },
  {
    name: '整甲 + 眼睫毛',
    // 整甲's time for the same 手/腳 plus 2 h for 眼睫毛, with the same add-ons on top
    durationMinutes: 120 + 120,
    durationByHandOrFoot: { 腳: 60 + 120, '手 + 腳': 180 + 120 },
    // 整甲's 收費 for the same 手/腳 plus 眼睫毛's $428, with the same add-ons on top
    price: 218 + 428,
    priceByHandOrFoot: { 腳: 298 + 428, '手 + 腳': 516 + 428 },
    color: '#8150D6',
    hasNailExtras: true,
    hasDeposit: true,
  },
  // price is the full price; the forms lower it after a recent set (topUpPrice)
  {
    name: '補甲',
    durationMinutes: 60,
    price: 30,
    color: '#D17A1E',
    noHandOrFoot: true,
    hasDeposit: true,
  },
  {
    name: '拆甲',
    durationMinutes: 60,
    price: 100,
    color: '#A88C12',
    noHandOrFoot: true,
    hasDeposit: true,
  },
  // price is the full price; the forms lower it after a recent set (topUpPrice)
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
    hasDeposit: true,
  },
  {
    name: '粉嫩術',
    durationMinutes: 90,
    price: 2000,
    color: '#C9668E',
    noHandOrFoot: true,
    hasDeposit: true,
  },
  { name: '特別事項', durationMinutes: undefined, price: 0, color: '#AE45A8' },
] as const;

export type ServiceType = (typeof SERVICES)[number]['name'];

/** 手/腳 options, spelled exactly as in the sheet. */
export const HAND_OR_FOOT_OPTIONS = ['手', '腳', '手 + 腳'] as const;

export type HandOrFoot = (typeof HAND_OR_FOOT_OPTIONS)[number];

/** 複雜款 options, spelled exactly as in the sheet; the first is the default. */
export const COMPLEX_DESIGN_OPTIONS = ['不是複雜款', '半個鐘', '一個鐘'] as const;

export type ComplexDesign = (typeof COMPLEX_DESIGN_OPTIONS)[number];

/** A sheet value as one of the options, with blank or unknown ones as 不是複雜款. */
export function toComplexDesign(value: string | undefined): ComplexDesign {
  return COMPLEX_DESIGN_OPTIONS.find((option) => option === value) ?? COMPLEX_DESIGN_OPTIONS[0];
}

/** Other 整甲 add-ons, each a TRUE / FALSE column in the sheet named by its label. */
export const NAIL_EXTRAS = [
  { key: 'removal', label: '拆甲' },
  { key: 'extension', label: '延長' },
] as const;

export type NailExtra = (typeof NAIL_EXTRAS)[number]['key'];

export type NailExtras = Record<NailExtra, boolean>;

/** The add-ons ticked on `apt`, all off when there's no appointment. */
export function nailExtrasOf(apt?: Partial<NailExtras>): NailExtras {
  return {
    removal: apt?.removal ?? false,
    extension: apt?.extension ?? false,
  };
}

const UNKNOWN_SERVICE_COLOR = '#6E655F';

/** The form's 手/腳 and 整甲 add-ons, which change the default Duration and 收費. */
export type ServiceChoices = Partial<NailExtras> & { complexDesign?: string; handOrFoot?: string };

type ChoiceAmounts = {
  complexDesign: Record<ComplexDesign, number>;
  removal: number;
  extension: number;
};

/** Extra time for the 整甲 and 整甲 + 眼睫毛 add-ons. */
const EXTRA_MINUTES: ChoiceAmounts = {
  complexDesign: { 不是複雜款: 0, 半個鐘: 30, 一個鐘: 60 },
  removal: 30,
  extension: 60,
};

/** Extra 收費 for the same add-ons. */
const EXTRA_PRICE: ChoiceAmounts = {
  complexDesign: { 不是複雜款: 0, 半個鐘: 60, 一個鐘: 120 },
  removal: 0,
  extension: 100,
};

/** `base`, or its 手/腳 override, plus the add-ons that apply. */
function withChoices(
  service: ServiceType,
  base: number,
  byHandOrFoot: Partial<Record<string, number>> | undefined,
  extra: ChoiceAmounts,
  choices: ServiceChoices
): number {
  const handOrFoot = choices.handOrFoot ?? '';
  const start = byHandOrFoot?.[handOrFoot] ?? base;
  if (!showsNailExtras(service, handOrFoot)) return start;
  return (
    start +
    extra.complexDesign[toComplexDesign(choices.complexDesign)] +
    (choices.removal ? extra.removal : 0) +
    (choices.extension ? extra.extension : 0)
  );
}

/**
 * Pass the form's 手/腳 and add-ons, e.g. so a 整甲 for 腳 gets its own time
 * and 複雜款, 拆甲 or 延長 add theirs.
 */
export function defaultDurationFor(
  service: ServiceType,
  choices?: ServiceChoices
): number | undefined {
  const found = SERVICES.find((s) => s.name === service);
  const base = found?.durationMinutes;
  if (base == null || !found || !choices) return base;
  const byHandOrFoot = 'durationByHandOrFoot' in found ? found.durationByHandOrFoot : undefined;
  return withChoices(service, base, byHandOrFoot, EXTRA_MINUTES, choices);
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

export function usesNailExtras(service: string): boolean {
  const found = SERVICES.find((s) => s.name === service);
  return !!(found && 'hasNailExtras' in found && found.hasNailExtras);
}

/** 腳 bookings don't get the 整甲 add-ons. */
export function showsNailExtras(service: string, handOrFoot: string): boolean {
  return usesNailExtras(service) && handOrFoot !== '腳';
}

/** The add-ons saved when they don't apply (e.g. for 腳), clearing any earlier ones. */
export const NO_NAIL_EXTRAS = {
  complexDesign: COMPLEX_DESIGN_OPTIONS[0],
  removal: false,
  extension: false,
} as const;

/** e.g. 複雜款（半個鐘）、延長, or '' when nothing is added. */
export function describeNailExtras(apt: Partial<NailExtras> & { complexDesign?: string }): string {
  const complex = toComplexDesign(apt.complexDesign);
  return [
    ...(complex === COMPLEX_DESIGN_OPTIONS[0] ? [] : [`複雜款（${complex}）`]),
    ...NAIL_EXTRAS.filter(({ key }) => apt[key]).map(({ label }) => label),
  ].join('、');
}

/** Like defaultDurationFor: a 整甲 for 腳 has its own price, and add-ons add theirs. */
export function defaultPriceFor(service: ServiceType, choices?: ServiceChoices): number | undefined {
  const found = SERVICES.find((s) => s.name === service);
  const base = found?.price;
  if (base == null || !found || !choices) return base;
  const byHandOrFoot = 'priceByHandOrFoot' in found ? found.priceByHandOrFoot : undefined;
  return withChoices(service, base, byHandOrFoot, EXTRA_PRICE, choices);
}

/** Accepts any sheet value, since old rows may hold services not listed here. */
export function serviceColor(service: string): string {
  return SERVICES.find((s) => s.name === service)?.color ?? UNKNOWN_SERVICE_COLOR;
}
