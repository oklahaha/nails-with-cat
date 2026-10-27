import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// The device's storage, kept across "restarts" (fresh copies of writeQueue)
const mockStored = new Map<string, string>();
jest.mock('@/utils/persistentStorage', () => ({
  readStored: (key: string) => mockStored.get(key) ?? null,
  writeStoredNow: (key: string, value: string) => mockStored.set(key, value),
}));

type WriteQueue = typeof import('./writeQueue');

/** A fresh copy of the module, as after the app is restarted. */
function launch(): WriteQueue {
  let mod!: WriteQueue;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./writeQueue');
  });
  return mod;
}

const outbox = () => JSON.parse(mockStored.get('write-outbox-v1') ?? '[]') as { kind: string }[];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => mockStored.clear());

describe('write outbox', () => {
  it('stores a write before sending it and removes it once sent', async () => {
    const { defineWrite } = launch();
    let release!: () => void;
    const send = defineWrite<string>('save', {
      run: () => new Promise<void>((resolve) => (release = resolve)),
      restore: () => {},
    });

    send('a');
    expect(outbox()).toHaveLength(1);
    await settle();
    release();
    await settle();
    expect(outbox()).toEqual([]);
  });

  it('runs writes one at a time, in order', async () => {
    const { defineWrite } = launch();
    const log: string[] = [];
    const send = defineWrite<string>('save', {
      run: async (p) => {
        log.push(`start ${p}`);
        await settle();
        log.push(`end ${p}`);
      },
      restore: () => {},
    });
    send('a');
    send('b');
    await settle();
    await settle();
    await settle();
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('keeps going after a write that throws', async () => {
    const { defineWrite } = launch();
    const sent: string[] = [];
    const send = defineWrite<string>('save', {
      run: async (p) => {
        if (p === 'bad') throw new Error('boom');
        sent.push(p);
      },
      restore: () => {},
    });
    send('bad');
    send('good');
    await settle();
    expect(sent).toEqual(['good']);
    expect(outbox()).toEqual([]);
  });

  it('restores and resends writes left unsent when the app closed', async () => {
    // First launch: the write never finishes before the app is closed
    const first = launch();
    first.defineWrite<string>('save', { run: () => new Promise(() => {}), restore: () => {} })('a');
    first.defineWrite<string>('delete', { run: () => new Promise(() => {}), restore: () => {} })('b');
    expect(outbox().map((r) => r.kind)).toEqual(['save', 'delete']);

    // Next launch
    const second = launch();
    const events: string[] = [];
    second.defineWrite<string>('save', {
      run: async (p) => void events.push(`run save ${p}`),
      restore: (p) => events.push(`restore save ${p}`),
    });
    second.defineWrite<string>('delete', {
      run: async (p) => void events.push(`run delete ${p}`),
      restore: (p) => events.push(`restore delete ${p}`),
    });
    second.resumeWrites();
    await settle();

    expect(events).toEqual([
      'restore save a',
      'restore delete b',
      'run save a',
      'run delete b',
    ]);
    expect(outbox()).toEqual([]);
  });

  it('drops saved writes of a kind this version no longer has', async () => {
    mockStored.set('write-outbox-v1', JSON.stringify([{ seq: 1, kind: 'gone', payload: null }]));
    const { resumeWrites } = launch();
    resumeWrites();
    await settle();
    expect(outbox()).toEqual([]);
  });
});
