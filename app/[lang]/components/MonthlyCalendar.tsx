'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarProps {
  events: any[];
  lang: string;
}

export default function MonthlyCalendar({ events, lang }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));

  const monthName = currentDate.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US', { month: 'long' });
  const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const displayDays = lang === 'cs' ? days : daysEn;

  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= totalDays; i++) calendarDays.push(i);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-xl overflow-hidden">
      <header className="bg-stone-900 p-8 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black capitalize">{monthName}</h3>
            <p className="text-stone-400 font-bold text-xs uppercase tracking-widest">{year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-3 hover:bg-white/10 rounded-xl transition"><ChevronLeft size={20} /></button>
          <button onClick={nextMonth} className="p-3 hover:bg-white/10 rounded-xl transition"><ChevronRight size={20} /></button>
        </div>
      </header>

      <div className="p-4 md:p-8">
        <div className="grid grid-cols-7 mb-4">
          {displayDays.map(d => (
            <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-stone-400 py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-stone-100 rounded-2xl overflow-hidden border border-stone-100">
          {calendarDays.map((day, idx) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const isToday = day && new Date().toDateString() === new Date(year, month, day).toDateString();

            return (
              <div key={idx} className={`min-h-[100px] md:min-h-[140px] bg-white p-2 md:p-4 ${day ? '' : 'bg-stone-50/50'}`}>
                {day && (
                  <>
                    <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-sm font-black mb-2 ${isToday ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-stone-400'}`}>
                      {day}
                    </span>
                    <div className="space-y-1">
                      {dayEvents.map(ev => (
                        <div key={ev.id} className="bg-green-50 text-green-700 p-1.5 rounded-lg text-[9px] font-bold leading-tight border border-green-100 truncate hover:bg-green-100 transition-colors cursor-pointer">
                          {ev.time && <span className="mr-1 opacity-60">{ev.time}</span>}
                          {lang === 'en' && ev.title_en ? ev.title_en : ev.title}
                        </div>
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
