/**
 * Background writes to Apps Script (see appointmentWrites / customerWrites)
 * run one at a time in the order they were made, so e.g. a booking for a
 * customer still being added is sent after that customer.
 *
 * Writes show as saved before they're sent, so the queue is an outbox kept
 * on the device: each write is stored as data (its kind and payload) before
 * the screen closes, and removed once it has run. If the app is closed
 * first, resumeWrites puts the changes back on screen at the next launch
 * and sends them. Writes are safe to send twice, since a closed app may
 * have sent one without hearing back: a new booking carries its own
 * 預約ID, and Apps Script treats a repeated create or delete as done.
 */
import { readStored, writeStoredNow } from '@/utils/persistentStorage';

const STORAGE_KEY = 'write-outbox-v1';

type WriteRecord = { seq: number; kind: string; payload: unknown };

type WriteHandler<P> = {
  /** Send the write; should catch its own errors (undo and report them). */
  run: (payload: P) => Promise<void>;
  /** Show the write as pending again after a restart, before it's resent. */
  restore: (payload: P) => void;
};

const handlers = new Map<string, WriteHandler<never>>();
let outbox: WriteRecord[] = [];
let nextSeq = 1;
let queue: Promise<void> = Promise.resolve();

function saveOutbox(): void {
  writeStoredNow(STORAGE_KEY, JSON.stringify(outbox));
}

function schedule(record: WriteRecord): void {
  const handler = handlers.get(record.kind) as WriteHandler<unknown> | undefined;
  queue = queue
    .then(() => handler?.run(record.payload))
    // A handler that throws anyway mustn't stop every later write
    .catch(() => {})
    .then(() => {
      outbox = outbox.filter((r) => r !== record);
      saveOutbox();
    });
}

/**
 * Register a kind of write; returns the function that queues one. Call at
 * module level, so handlers exist before resumeWrites runs.
 */
export function defineWrite<P>(kind: string, handler: WriteHandler<P>): (payload: P) => void {
  handlers.set(kind, handler as WriteHandler<never>);
  return (payload) => {
    const record = { seq: nextSeq++, kind, payload };
    outbox = [...outbox, record];
    saveOutbox();
    schedule(record);
  };
}

let resumed = false;

/** Restore and resend the writes a closed app left unsent. Called once at launch. */
export function resumeWrites(): void {
  if (resumed) return;
  resumed = true;
  let saved: WriteRecord[];
  try {
    const parsed: unknown = JSON.parse(readStored(STORAGE_KEY) ?? '[]');
    saved = Array.isArray(parsed) ? (parsed as WriteRecord[]) : [];
  } catch {
    saved = [];
  }
  const known = saved.filter((record) => handlers.has(record.kind));
  for (const record of known) {
    (handlers.get(record.kind) as WriteHandler<unknown>).restore(record.payload);
  }
  // Runs from the root layout at launch, before the user can save anything
  outbox = [...known, ...outbox];
  nextSeq = Math.max(nextSeq, ...outbox.map((r) => r.seq + 1));
  saveOutbox();
  for (const record of known) schedule(record);
}
