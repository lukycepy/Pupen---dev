'use client';

import React, { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false }) as any;
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false }) as any;

type Member = {
  first_name?: string;
  last_name?: string;
  email?: string;
  address_meta?: any;
};

export default function MemberDirectoryMap({
  members,
  labels,
}: {
  members: Member[];
  labels: { title: string; membersLabel: string };
}) {
  useEffect(() => {
    const i = (L as any).Icon?.Default;
    if (!i) return;
    try {
      delete (i.prototype as any)._getIconUrl;
    } catch {}
    i.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const points = useMemo(() => {
    const byCity = new Map<string, { city: string; latSum: number; lonSum: number; count: number }>();
    for (const m of members || []) {
      const meta = m?.address_meta;
      const lat = typeof meta?.lat === 'number' ? meta.lat : meta?.lat ? Number(meta.lat) : null;
      const lon = typeof meta?.lon === 'number' ? meta.lon : meta?.lon ? Number(meta.lon) : null;
      const city = String(meta?.city || '').trim();
      if (!city) continue;
      if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) continue;
      const key = city.toLowerCase();
      const prev = byCity.get(key);
      if (prev) {
        prev.latSum += lat;
        prev.lonSum += lon;
        prev.count += 1;
      } else {
        byCity.set(key, { city, latSum: lat, lonSum: lon, count: 1 });
      }
    }
    return Array.from(byCity.values())
      .map((x) => ({ city: x.city, lat: x.latSum / x.count, lon: x.lonSum / x.count, count: x.count }))
      .sort((a, b) => b.count - a.count);
  }, [members]);

  return (
    <div className="bg-stone-50 rounded-[2rem] border border-stone-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 bg-white flex items-center justify-between gap-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
          {labels.title}
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">
          {points.reduce((acc, p) => acc + p.count, 0)} {labels.membersLabel}
        </div>
      </div>
      <div className="h-[360px]">
        <MapContainer center={[49.8, 15.5]} zoom={7} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {points.map((p) => (
            <Marker key={p.city} position={[p.lat, p.lon]}>
              <Popup>
                <div className="font-bold">{p.city}</div>
                <div className="text-sm">{p.count} {labels.membersLabel}</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
