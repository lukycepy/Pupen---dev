'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarProps {
  events: any[];
  lang: string;
  value?: Date;
  onChange?: (next: Date) => void;
}

export default function MonthlyCalendar({ events, lang, value, onChange }: CalendarProps) {
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = value || internalDate;
  const setCurrentDate = (next: Date) => {
    if (onChange) onChange(next);
    else setInternalDate(next);
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US', { month: 'long' });
  const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const displayDays = lang === 'cs' ? days : daysEn;

  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const toYmd = (v: any) => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= totalDays; i++) calendarDays.push(i);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => toYmd(e.date) === dateStr);
  };

  return (
    <div className="bg-white dark:bg-black rounded-[2.5rem] border-2 border-black dark:border-white overflow-hidden">
      <header className="bg-black dark:bg-white p-8 text-white dark:text-black flex items-center justify-between border-b-2 border-black dark:border-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 dark:bg-black/10 rounded-2xl border-2 border-white/30 dark:border-black/30">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black capitalize">{monthName}</h3>
            <p className="text-white/60 dark:text-black/60 font-bold text-xs uppercase tracking-widest">{year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-3 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition border-2 border-white/20 dark:border-black/20"><ChevronLeft size={20} /></button>
          <button onClick={nextMonth} className="p-3 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition border-2 border-white/20 dark:border-black/20"><ChevronRight size={20} /></button>
        </div>
      </header>

      <div className="p-4 md:p-8">
        <div className="grid grid-cols-7 mb-4">
          {displayDays.map(d => (
            <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-black dark:bg-white rounded-2xl overflow-hidden border-2 border-black dark:border-white">
          {calendarDays.map((day, idx) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const isToday = day && new Date().toDateString() === new Date(year, month, day).toDateString();

            return (
              <div key={idx} className={`min-h-[100px] md:min-h-[140px] bg-white dark:bg-black p-2 md:p-4 ${day ? '' : 'bg-green-50/30 dark:bg-green-950/30'}`}>
                {day && (
                  <>
                    <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-sm font-black mb-2 border-2 ${isToday ? 'bg-green-600 text-white border-green-600 dark:bg-green-500 dark:border-green-500' : 'text-stone-400 dark:text-stone-500 border-transparent'}`}>
                      {day}
                    </span>
                    <div className="space-y-1">
                      {dayEvents.map(ev => (
                        <Link
                          key={ev.id}
                          href={`/${lang}/akce/${ev.id}`}
                          className="block bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 p-1.5 rounded-lg text-[9px] font-bold leading-tight border-2 border-green-600/30 dark:border-green-400/30 truncate hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                        >
                          {ev.time && <span className="mr-1 opacity-60">{ev.time}</span>}
                          {lang === 'en' && ev.title_en ? ev.title_en : ev.title}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
