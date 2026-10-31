import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type AlertQueue = typeof import('./alertQueue');

describe('alertQueue', () => {
  let queue: AlertQueue;

  beforeEach(() => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      queue = require('./alertQueue');
    });
  });

  it('shows alerts one at a time, in order', () => {
    queue.enqueueAlert('first');
    queue.enqueueAlert('second');
    const first = queue.currentAlert()!;
    expect(first.title).toBe('first');

    queue.answerAlert(first, first.buttons[0]);
    expect(queue.currentAlert()?.title).toBe('second');
  });

  it('gives an alert without buttons a 確定 button', () => {
    queue.enqueueAlert('failed', 'why');
    expect(queue.currentAlert()?.buttons.map((b) => b.text)).toEqual(['確定']);
  });

  it('runs the chosen button once, even if answered twice', () => {
    const onPress = jest.fn();
    queue.enqueueAlert('question', undefined, [{ text: '取消', style: 'cancel' }, { text: '好', onPress }]);
    const alert = queue.currentAlert()!;

    queue.answerAlert(alert, alert.buttons[1]);
    queue.answerAlert(alert, alert.buttons[1]);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(queue.currentAlert()).toBeUndefined();
  });

  it('closes the alert before running the button, which may show another', () => {
    queue.enqueueAlert('first', undefined, [
      { text: '好', onPress: () => queue.enqueueAlert('second') },
    ]);
    const first = queue.currentAlert()!;
    queue.answerAlert(first, first.buttons[0]);
    expect(queue.currentAlert()?.title).toBe('second');
  });

  it('lets the newest presenter present, and falls back when it goes', () => {
    const root = {};
    const modal = {};
    queue.addAlertPresenter(root);
    const removeModal = queue.addAlertPresenter(modal);
    expect(queue.frontPresenter()).toBe(modal);

    removeModal();
    expect(queue.frontPresenter()).toBe(root);
  });

  it('tells listeners about new alerts and presenters', () => {
    const listener = jest.fn();
    const unsubscribe = queue.subscribeAlerts(listener);

    queue.enqueueAlert('one');
    queue.addAlertPresenter({});
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    queue.enqueueAlert('two');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
