import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { canSendConfirmation, confirmationMessage, reminderMessage } from './whatsapp';

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

describe('reminderMessage', () => {
  it('fills the date, weekday, time range, service and duration', () => {
    const message = reminderMessage(
      makeAppointment({ endTime: '16:30', handOrFoot: '手', durationMinutes: 150 })
    );
    expect(message).toContain('📅 11月2日（一）14:00–16:30\n📝 整甲（手）（約2.5小時）\n');
    expect(message.startsWith('🐈Nails_with_cats_🐈‍⬛\n\n明天預約提醒⏰\n')).toBe(true);
  });

  it('drops the end time and duration when missing', () => {
    const message = reminderMessage(makeAppointment({ service: '眼睫毛' }));
    expect(message).toContain('📅 11月2日（一）14:00\n📝 眼睫毛\n');
  });
});
