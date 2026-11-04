const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** 22 letters and digits, the shape of AppSheet's keys (預約ID, photo file names). */
export function randomId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 22; i++) id += ID_CHARS[Math.floor(random() * ID_CHARS.length)];
  return id;
}
