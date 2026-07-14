import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function isoToDate(s) { return new Date(s + 'T00:00:00'); }
function dateToISO(d) { return d.toISOString().slice(0, 10); }
function sameDay(a, b) { return a && b && dateToISO(a) === dateToISO(b); }
function clamp(d, lo, hi) { return d < lo ? lo : d > hi ? hi : d; }

// Get monday-based week day (0=Mon … 6=Sun)
function weekDay(d) { return (d.getDay() + 6) % 7; }

function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const cells = [];
  // leading blanks
  for (let i = 0; i < weekDay(first); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  // trailing blanks to complete row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Props:
 *  visible, onClose
 *  mode: 'single' | 'range'
 *  from, to  (ISO strings, for range)
 *  onApply(from, to)  – for range; onApply(date) – for single
 */
export default function CalendarModal({ visible, onClose, mode = 'range', from, to, onApply }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(() => {
    const d = from ? isoToDate(from) : today;
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = from ? isoToDate(from) : today;
    return d.getMonth();
  });

  const [selFrom, setSelFrom] = useState(from ? isoToDate(from) : null);
  const [selTo,   setSelTo]   = useState(to   ? isoToDate(to)   : null);
  const [picking, setPicking] = useState('from'); // 'from' | 'to'

  const grid = buildGrid(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleDay = (day) => {
    if (!day) return;
    if (mode === 'single') {
      setSelFrom(day);
      setSelTo(day);
      return;
    }
    if (picking === 'from') {
      setSelFrom(day);
      setSelTo(null);
      setPicking('to');
    } else {
      if (day < selFrom) {
        setSelFrom(day);
        setSelTo(null);
        setPicking('to');
      } else {
        setSelTo(day);
        setPicking('from');
      }
    }
  };

  const handleApply = () => {
    if (!selFrom) return;
    const f = dateToISO(selFrom);
    const t = dateToISO(selTo || selFrom);
    onApply(f, t);
    onClose();
  };

  const inRange = (day) => {
    if (!day || !selFrom || !selTo) return false;
    return day > selFrom && day < selTo;
  };
  const isFrom = (day) => day && selFrom && sameDay(day, selFrom);
  const isTo   = (day) => day && selTo   && sameDay(day, selTo);
  const isToday = (day) => day && sameDay(day, today);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Month nav */}
          <View style={s.nav}>
            <TouchableOpacity style={s.navBtn} onPress={prevMonth}>
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={s.navTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={s.navBtn} onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Range labels (range mode) */}
          {mode === 'range' && (
            <View style={s.rangeRow}>
              <TouchableOpacity style={[s.rangeLabel, picking === 'from' && s.rangeLabelActive]} onPress={() => setPicking('from')}>
                <Text style={s.rangeLabelSub}>Начало</Text>
                <Text style={[s.rangeLabelVal, picking === 'from' && { color: Colors.primary }]}>
                  {selFrom ? selFrom.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                </Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
              <TouchableOpacity style={[s.rangeLabel, picking === 'to' && s.rangeLabelActive]} onPress={() => setPicking('to')}>
                <Text style={s.rangeLabelSub}>Конец</Text>
                <Text style={[s.rangeLabelVal, picking === 'to' && { color: Colors.primary }]}>
                  {selTo ? selTo.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Day headers */}
          <View style={s.weekRow}>
            {DAYS.map(d => <Text key={d} style={[s.weekLabel, (d === 'Сб' || d === 'Вс') && { color: Colors.expense }]}>{d}</Text>)}
          </View>

          {/* Grid */}
          <View style={s.grid}>
            {grid.map((day, i) => {
              const from_ = isFrom(day);
              const to_   = isTo(day);
              const range = inRange(day);
              const tod   = isToday(day);
              const sel   = from_ || to_;

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.cell,
                    range && s.cellRange,
                    from_ && s.cellRangeStart,
                    to_   && s.cellRangeEnd,
                  ]}
                  onPress={() => handleDay(day)}
                  activeOpacity={day ? 0.7 : 1}
                >
                  {day && (
                    <View style={[s.dayCircle, sel && s.dayCircleSel]}>
                      <Text style={[s.dayTxt, sel && s.dayTxtSel, range && { color: Colors.primary }, tod && !sel && s.dayTxtToday]}>
                        {day.getDate()}
                      </Text>
                      {tod && !sel && <View style={s.todayDot} />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.applyBtn, !selFrom && { opacity: 0.4 }]} onPress={handleApply} disabled={!selFrom}>
              <Text style={s.applyTxt}>{mode === 'range' ? 'Применить' : 'Выбрать'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CELL = (width - 32) / 7;

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingBottom: 28 },
  handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  navBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.bgMuted, borderRadius: 16, padding: 14, marginBottom: 12, gap: 8 },
  rangeLabel: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 10 },
  rangeLabelActive: { backgroundColor: Colors.primaryLight },
  rangeLabelSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  rangeLabelVal: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { width: CELL, textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textMuted, paddingVertical: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  cellRange: { backgroundColor: Colors.primaryLight },
  cellRangeStart: { backgroundColor: Colors.primaryLight, borderTopLeftRadius: CELL / 2, borderBottomLeftRadius: CELL / 2 },
  cellRangeEnd:   { backgroundColor: Colors.primaryLight, borderTopRightRadius: CELL / 2, borderBottomRightRadius: CELL / 2 },

  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleSel: { backgroundColor: Colors.primary },
  dayTxt: { fontSize: 14, fontWeight: '500', color: Colors.text },
  dayTxtSel: { color: Colors.white, fontWeight: '700' },
  dayTxtToday: { color: Colors.primary, fontWeight: '700' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary, position: 'absolute', bottom: 3 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.bgMuted },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  applyBtn: { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.primary },
  applyTxt: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
