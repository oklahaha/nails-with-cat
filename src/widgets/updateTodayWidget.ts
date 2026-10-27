/**
 * The home screen widget is iOS-only for now (updateTodayWidget.ios.ts), so
 * Android and web skip it.
 */
import type { Appointment } from '@/types/appointment';

export function updateTodayWidget(_appointments: Appointment[], _today: string): void {}
