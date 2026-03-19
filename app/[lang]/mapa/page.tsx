'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Navigation, HelpCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Skeleton from '../components/Skeleton';

const DynamicIcon = ({ name, size = 16, className = "" }: { name: string, size?: number, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) return <HelpCircle size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

import { getDictionary } from '@/lib/get-dictionary';

// Dynamický import Leaflet komponent kvůli SSR
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false }) as any;
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false }) as any;

// Pomocná komponenta pro změnu pohledu mapy
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const { useMap } = require('react-leaflet');
  const map = useMap();
  useEffect(() => {
    if (map) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function MapaPage({ params }: { params: Promise<{ lang: string }> }) {
  const [lang, setLang] = useState<string>('cs');
  const [dict, setDict] = useState<any>(null);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>([50.129, 14.373]);
  const [mapZoom, setMapZoom] = useState(16);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const p = await params;
      setLang(p.lang);
      const d = await getDictionary(p.lang);
      setDict(d);

      // Inicializace Leaflet ikon na klientovi
      const leaflet = await import('leaflet');
      setL(leaflet);
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
    }
    load();
  }, [params]);

  const { data: points = [] } = useQuery({
    queryKey: ['campus_map'],
    queryFn: async () => {
      const { data } = await supabase.from('campus_map_points').select('*');
      return data || [];
    }
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['map_categories'],
    queryFn: async () => {
      const { data } = await supabase.from('campus_map_categories').select('*').order('name', { ascending: true });
      return data || [];
    }
  });

  const filteredPoints = filter === 'all' ? points : points.filter((p: any) => p.category === filter);

  const getIcon = (categoryName: string) => {
    const category = categories.find((c: any) => c.name === categoryName);
    return <DynamicIcon name={category?.icon_name || 'MapPin'} size={16} />;
  };

  const handlePointSelect = (point: any) => {
    setSelectedPoint(point);
    setMapCenter([point.lat, point.lng]);
    setMapZoom(18);
  };

  if (!dict) return (
    <div className="min-h-screen bg-stone-50 py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <Skeleton className="h-14 w-80 mx-auto rounded-2xl" />
          <Skeleton className="h-7 w-[520px] max-w-full mx-auto rounded-xl" />
        </div>
        <div className="grid lg:grid-cols-4 gap-8 h-[700px]">
          <div className="space-y-6 overflow-y-auto pr-2">
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm">
              <Skeleton className="h-4 w-40 rounded-lg mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-32 rounded-lg" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white border border-stone-100 rounded-2xl p-4 space-y-2">
                  <Skeleton className="h-5 w-2/3 rounded-xl" />
                  <Skeleton className="h-3 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-3 relative bg-white p-4 rounded-[3rem] border shadow-2xl overflow-hidden">
            <Skeleton className="w-full h-full rounded-[2.5rem]" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-stone-900 mb-4 uppercase tracking-tighter">
            {dict.map.title}
          </h1>
          <p className="text-xl text-stone-500 max-w-2xl mx-auto font-medium">
            {dict.map.description}
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8 h-[700px]">
          {/* SIDEBAR */}
          <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm sticky top-0 z-10">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">{dict.map.categories}</h3>
              <div className="space-y-2">
                <button
                  onClick={() => { setFilter('all'); setSelectedPoint(null); setMapZoom(16); setMapCenter([50.129, 14.373]); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition ${filter === 'all' ? 'bg-green-600 text-white shadow-lg' : 'text-stone-600 hover:bg-stone-50'}`}
                >
                  <Navigation size={14} />
                  <span className="text-sm">{dict.map.allPoints}</span>
                </button>
                {categories.map((cat: any) => (
                  <button
                    key={cat.id}
                    onClick={() => { setFilter(cat.name); setSelectedPoint(null); setMapZoom(16); setMapCenter([50.129, 14.373]); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition ${filter === cat.name ? 'bg-green-600 text-white shadow-lg' : 'text-stone-600 hover:bg-stone-50'}`}
                  >
                    <DynamicIcon name={cat.icon_name} size={14} />
                    <span className="text-sm">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-2">{dict.map.pointList}</h3>
              {filteredPoints.map((point: any) => (
                <button
                  key={point.id}
                  onClick={() => handlePointSelect(point)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedPoint?.id === point.id ? 'bg-green-50 border-green-200 shadow-md ring-1 ring-green-500' : 'bg-white border-stone-100 hover:border-green-200'}`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedPoint?.id === point.id ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-500'}`}>
                      {getIcon(point.category)}
                    </div>
                    <span className="font-bold text-stone-900 text-sm">{lang === 'en' && point.name_en ? point.name_en : point.name}</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-11">{dict.map.building} {point.building_code}</p>
                </button>
              ))}
            </div>
          </div>

          {/* REAL MAP */}
          <div className="lg:col-span-3 relative bg-white p-4 rounded-[3rem] border shadow-2xl overflow-hidden">
            {/* @ts-ignore */}
            {typeof window !== 'undefined' && L ? (
              <MapContainer 
                center={mapCenter} 
                zoom={mapZoom} 
                className="w-full h-full rounded-[2.5rem]"
                zoomControl={false}
              >
                <ChangeView center={mapCenter} zoom={mapZoom} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredPoints.map((point: any) => (
                  <Marker 
                    key={point.id} 
                    position={[point.lat, point.lng]}
                    eventHandlers={{
                      click: () => handlePointSelect(point),
                    }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[150px]">
                        <h4 className="font-black text-stone-900 border-b pb-1 mb-2">{lang === 'en' && point.name_en ? point.name_en : point.name}</h4>
                        <p className="text-xs text-stone-500 mb-2">{lang === 'en' && point.description_en ? point.description_en : point.description}</p>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-stone-100 px-2 py-1 rounded">{dict.map.building} {point.building_code}</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-50 rounded-[2.5rem]">
                <Skeleton className="w-[90%] h-[90%] rounded-[2.5rem]" />
              </div>
            )}
            
            {/* Map Legend/Overlay */}
            <div className="absolute top-8 right-8 z-[1000] flex flex-col gap-2">
              <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border shadow-lg flex items-center gap-3">
                <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-600">Live Campus Map</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
