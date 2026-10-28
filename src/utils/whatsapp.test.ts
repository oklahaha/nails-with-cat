import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { canSendConfirmation, confirmationMessage } from './whatsapp';

describe('confirmationMessage', () => {
  it('lists the date, time range, service and price', () => {
    const apt = makeAppointment({ endTime: '16:00', handOrFoot: '手', price: 218 });
    expect(confirmationMessage(apt)).toBe(
      [
        '你好 陳小姐！你的預約已確認：',
        '日期：2026年11月2日 星期一',
        '時間：14:00–16:00',
        '項目：整甲（手）',
        '收費：$218',
        '如需更改請回覆此訊息，謝謝！',
      ].join('\n')
    );
  });

  it('leaves out 手/腳 for lashes and a missing price', () => {
    const message = confirmationMessage(makeAppointment({ service: '眼睫毛', handOrFoot: '手' }));
    expect(message).toContain('項目：眼睫毛\n');
    expect(message).not.toContain('收費');
    expect(message).toContain('時間：14:00\n');
  });
});

describe('canSendConfirmation', () => {
  it('needs a phone and a customer booking', () => {
    expect(canSendConfirmation(makeAppointment({ phone: '85291234567' }))).toBe(true);
    expect(canSendConfirmation(makeAppointment({ phone: ' ' }))).toBe(false);
    expect(canSendConfirmation(makeAppointment({ service: '特別事項', phone: '85291234567' }))).toBe(
      false
    );
  });
});
