/**
 * Where appointments go in the Day / Week time grid (TimeGrid): their
 * minutes, side-by-side lanes for overlaps, and the hour to open at.
 */
import type { Appointment } from '@/types/appointment';
import { timeToMinutes } from '@/utils/dates';

/** Hour the grid opens at on days other than today, unless a booking starts earlier. */
const DEFAULT_START_HOUR = 9;
/** Shortest block drawn, so zero-length rows (e.g. 特別事項) stay tappable. */
export const MIN_BLOCK_MINUTES = 30;

export type Block = {
  appointment: Appointment;
  /** Minutes since midnight */
  start: number;
  end: number;
  /** Which of `lanes` side-by-side columns it sits in. */
  lane: number;
  lanes: number;
};

function blockEnd(apt: Appointment, start: number): number {
  let end = apt.endTime ? timeToMinutes(apt.endTime) : NaN;
  if (!(end > start) && apt.durationMinutes) end = start + apt.durationMinutes;
  if (!(end > start)) end = start;
  return Math.max(end, start + MIN_BLOCK_MINUTES);
}

/** Assign side-by-side lanes to overlapping appointments within one day. */
export function layoutBlocks(appointments: Appointment[]): Block[] {
  const sorted = appointments
    .map((apt) => {
      const start = timeToMinutes(apt.time);
      return { appointment: apt, start, end: blockEnd(apt, start), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start);

  const result: Block[] = [];
  let cluster: Block[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const block of cluster) block.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const block of sorted) {
    if (block.start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= block.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = block.end;
    block.lane = lane;
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  closeCluster();

  return result;
}

/** The hour the grid scrolls to first: 09:00, or the earliest booking's hour. */
export function firstVisibleHour(blocks: Block[]): number {
  let start = DEFAULT_START_HOUR;
  for (const block of blocks) start = Math.min(start, Math.floor(block.start / 60));
  return start;
}
