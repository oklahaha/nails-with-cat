/**
 * Background writes to Apps Script (see appointmentWrites / customerWrites)
 * run one at a time in the order they were made, so e.g. a booking for a
 * customer still being added is sent after that customer.
 */
let queue: Promise<void> = Promise.resolve();

/** `task` should catch its own errors; it runs after every earlier one. */
export function enqueueWrite(task: () => Promise<void>): void {
  queue = queue.then(task);
}
