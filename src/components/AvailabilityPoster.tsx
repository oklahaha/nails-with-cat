/**
 * The 可約時間 Instagram story (reference/timeslot.png), drawn at 360 × 640 pt and
 * captured at 1080 × 1920. The fonts are iOS system fonts (宋體 Songti TC, Baskerville
 * digits, Snell Roundhand month, Avenir Next for small English); other platforms fall
 * back to their own. No ZWJ emoji (🐈‍⬛): they don't draw.
 */
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text as RNText, type TextProps, View } from 'react-native';

import { addDays, parseIsoDate, startOfWeek } from '@/utils/dates';
import { dayMonth, type DaySlots } from '@/utils/availableSlots';

export const POSTER_WIDTH = 360;
export const POSTER_HEIGHT = 640;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const MAUVE = '#9E5E6F';
const MAUVE_SOFT = '#C99AA6';
const GREY = '#B5A7AB';
const FAINT = '#DCCFD3';
const LINE = '#F1E5E8';
const INK = '#3E3236';

/** The artwork is a fixed-size image, so the system text size mustn't grow it. */
function Text(props: TextProps) {
  return <RNText allowFontScaling={false} {...props} />;
}

const SONG = 'Songti TC';
const SERIF = 'Baskerville';
const SANS = 'Avenir Next';

type Props = { from: string; to: string; days: DaySlots[]; ref?: Ref<ComponentRef<typeof View>> };

export function AvailabilityPoster({ from, to, days, ref }: Props) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks: string[][] = [];
  for (let start = startOfWeek(from); start <= to; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  const first = parseIsoDate(from);

  return (
    <View ref={ref} collapsable={false} style={styles.poster}>
      <View style={styles.titleRow}>
        <Text style={styles.side}>{first.getMonth() + 1}</Text>
        <Text style={styles.month} numberOfLines={1} adjustsFontSizeToFit>
          <Text style={styles.emoji}>🎀 </Text>
          {MONTHS[first.getMonth()]}
          <Text style={styles.emoji}> 🐈</Text>
        </Text>
        <Text style={styles.side}>{first.getFullYear()}</Text>
      </View>
      <Text style={styles.kicker}>✨  AVAILABLE SLOTS  ✨</Text>
      <Text style={styles.range}>
        {dayMonth(from)} – {dayMonth(to)}  Timetable
      </Text>
      <Text style={styles.flexible}>以上時間都可以彈性安排，WhatsApp 我哋 🩷</Text>

      <View style={styles.card}>
        <View style={styles.weekdays}>
          {WEEKDAYS.map((w, i) => (
            <Text key={w} style={[styles.weekday, (i === 0 || i === 6) && { color: MAUVE }]}>
              {w}
            </Text>
          ))}
        </View>
        {weeks.map((week, row) => (
          <View key={week[0]} style={[styles.week, row < weeks.length - 1 && styles.weekLine]}>
            {week.map((date, i) => (
              <Cell key={date} date={date} day={byDate.get(date)} last={i === 6} />
            ))}
          </View>
        ))}
      </View>

      <Text style={styles.note}>整甲約 2.5 小時 · 眼睫毛約 2 小時 · 一個項目一個時段</Text>
      <Text style={styles.noteEn}>Gel nails approx. 2.5 hrs · Lashes approx. 2 hrs · One service per slot</Text>
      <Text style={[styles.note, { marginTop: 10 }]}>淨拆甲 / 補睫毛 / 腳甲：WhatsApp 查詢及預約</Text>
      <Text style={styles.noteEn}>Removal only / lash refill / pedicure: message us to arrange</Text>
      <Text style={styles.handle}>🐾   @NAILS_WITH_CATS_  ·  KWAI HING   🐾</Text>
    </View>
  );
}

function Cell({ date, day, last }: { date: string; day?: DaySlots; last: boolean }) {
  const number = parseIsoDate(date).getDate();
  const times = day
    ? [
        ...day.booked.map((time) => ({ time, booked: true, lashesOnly: false })),
        ...day.slots.map((s) => ({ ...s, booked: false })),
      ].sort((a, b) => a.time.localeCompare(b.time))
    : [];

  return (
    <View style={[styles.cell, !last && styles.cellLine]}>
      <Text style={[styles.date, !day && { color: FAINT }]}>{number}</Text>
      <View style={styles.cellBody}>
        {!day ? null : day.status === 'closed' ? (
          <View style={styles.stamp}>
            <Text style={styles.stampText}>休息</Text>
            <Text style={styles.stampEn}>CLOSED</Text>
          </View>
        ) : day.status === 'full' ? (
          <>
            <Text style={styles.full}>FULL</Text>
            <Text style={styles.fullZh}>已滿</Text>
          </>
        ) : (
          <>
            {times.map((t) => (
              <View key={t.time} style={styles.timeBox}>
                <Text
                  style={[
                    styles.time,
                    t.booked && styles.booked,
                    t.lashesOnly && { color: MAUVE_SOFT },
                  ]}
                >
                  {t.time}
                </Text>
                {t.lashesOnly ? <Text style={styles.caption}>只限眼睫毛</Text> : null}
              </View>
            ))}
            {day.booked.length === 0 && day.slots.length === 1 ? (
              <Text style={styles.badge}>剩 1 位</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    alignItems: 'center',
    paddingTop: 84,
    backgroundImage: 'linear-gradient(180deg, #F2E5E8 0%, #F6EDEF 55%, #FBF8F8 100%)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 26 },
  side: { fontFamily: SERIF, fontSize: 12, color: GREY, width: 34, textAlign: 'center' },
  month: {
    flex: 1,
    fontFamily: 'Snell Roundhand',
    fontWeight: '700',
    fontSize: 38,
    color: MAUVE,
    textAlign: 'center',
  },
  emoji: { fontSize: 22 },
  kicker: {
    marginTop: 4,
    fontFamily: SANS,
    fontWeight: '600',
    fontSize: 7,
    letterSpacing: 3.2,
    color: MAUVE,
  },
  range: { marginTop: 6, fontFamily: SERIF, fontSize: 15, color: INK },
  flexible: { marginTop: 4, fontFamily: SONG, fontSize: 8.5, color: GREY },
  card: {
    marginTop: 12,
    width: 318,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 3,
    boxShadow: '0 6px 24px rgba(158, 94, 111, 0.12)',
  },
  weekdays: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: LINE,
    paddingVertical: 7,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: SANS,
    fontWeight: '600',
    fontSize: 4.6,
    letterSpacing: 0.6,
    color: GREY,
  },
  week: { flexDirection: 'row', height: 93 },
  weekLine: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: LINE },
  cell: { flex: 1, alignItems: 'center', paddingTop: 4, marginVertical: 2 },
  cellLine: { borderRightWidth: StyleSheet.hairlineWidth * 2, borderRightColor: LINE },
  date: { fontFamily: SERIF, fontSize: 10.5, lineHeight: 14, color: INK },
  cellBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  full: { fontFamily: SANS, fontWeight: '600', fontSize: 8.5, letterSpacing: 1.6, color: MAUVE },
  fullZh: { marginTop: 4, fontFamily: SONG, fontSize: 4.6, color: MAUVE },
  timeBox: { alignItems: 'center', height: 21, justifyContent: 'center' },
  time: { fontFamily: SANS, fontWeight: '500', fontSize: 10.5, color: MAUVE },
  booked: {
    color: FAINT,
    textDecorationLine: 'line-through',
    textDecorationColor: GREY,
  },
  caption: { fontFamily: SONG, fontSize: 3.8, color: GREY, marginTop: -1 },
  badge: {
    marginTop: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#F6E4E9',
    fontFamily: SONG,
    fontSize: 4.6,
    color: MAUVE,
  },
  stamp: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    borderWidth: 0.8,
    borderColor: MAUVE_SOFT,
    backgroundColor: '#FBEFF2',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  stampText: { fontFamily: SONG, fontWeight: '700', fontSize: 7.5, color: MAUVE },
  stampEn: { fontFamily: SANS, fontSize: 2.6, letterSpacing: 0.6, color: MAUVE_SOFT },
  note: { marginTop: 9, fontFamily: SONG, fontSize: 8.5, color: INK },
  noteEn: { marginTop: 2, fontFamily: SANS, fontSize: 5.6, color: GREY },
  handle: {
    marginTop: 14,
    fontFamily: SANS,
    fontWeight: '600',
    fontSize: 5.6,
    letterSpacing: 2,
    color: MAUVE,
  },
});
