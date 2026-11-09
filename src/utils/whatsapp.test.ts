import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { canSendConfirmation, confirmationMessage, reminderMessage } from './whatsapp';

describe('confirmationMessage', () => {
  it('fills the date, time range, service and duration', () => {
    const message = confirmationMessage(
      makeAppointment({ endTime: '16:00', durationMinutes: 120, handOrFoot: '手' })
    );
    expect(message.startsWith('𝐀𝐩𝐩𝐨𝐢𝐧𝐭𝐦𝐞𝐧𝐭 𝐃𝐞𝐭𝐚𝐢𝐥𝐬 🫧\n')).toBe(true);
    expect(message).toContain('𝗗𝗮𝘁𝗲 & 𝗧𝗶𝗺𝗲：2/11（一）14:00–16:00\n');
    expect(message).toContain('𝗦𝗲𝗿𝘃𝗶𝗰𝗲：整甲\n');
    expect(message).toContain('𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻：約 2 小時\n');
    expect(message.endsWith('有咩唔明隨時問我哋～🐾')).toBe(true);
  });

  it('leaves out a missing end time and duration', () => {
    const message = confirmationMessage(makeAppointment({ durationMinutes: 0 }));
    expect(message).toContain('（一）14:00\n');
    expect(message).not.toContain('𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻');
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
