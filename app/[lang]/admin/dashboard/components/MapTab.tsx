'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Trash2, Map as MapIcon, Loader2, MapPin, Edit3, X, Save,
  Info, Coffee, BookOpen, Heart, Landmark, Settings, 
  HelpCircle, Utensils, ShoppingBag, TreePine, Hospital, School, GraduationCap, Building, Building2, Beer, Pizza, Wifi, Phone, Mail, Bus, Train, ParkingCircle, Navigation
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const AVAILABLE_ICONS = [
  'MapPin', 'Info', 'Coffee', 'BookOpen', 'Heart', 'Landmark', 'Navigation', 'Utensils', 
  'ShoppingBag', 'TreePine', 'Hospital', 'School', 'GraduationCap', 'Building', 'Building2', 
  'Beer', 'Pizza', 'Wifi', 'Phone', 'Mail', 'Bus', 'Train', 'ParkingCircle'
];

const DynamicIcon = ({ name, size = 16, className = "" }: { name: string, size?: number, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) return <HelpCircle size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useToast } from '../../../../context/ToastContext';

// Dynamický import Leaflet komponent kvůli SSR
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false }) as any;

// Komponenta pro výběr polohy kliknutím na mapu
function LocationPicker({ onLocationSelect, currentPos }: { onLocationSelect: (lat: number, lng: number) => void, currentPos: [number, number] }) {
  const { useMapEvents, Marker: MarkerComp } = require('react-leaflet');
  
  useMapEvents({
    click(e: any) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return <MarkerComp position={currentPos} />;
}

export default function MapTab({ dict }: { dict: any }) {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [L, setL] = useState<any>(null);
  const [newCategory, setNewCategory] = useState({ name: '', icon_name: 'MapPin' });
  const [formData, setFormData] = useState({ 
    name: '', 
    name_en: '', 
    building_code: '', 
    category: '', 
    description: '', 
    description_en: '',
    lat: 50.129,
    lng: 14.373
  });

  const [editingPoint, setEditingPoint] = useState<any>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['map_categories'],
    queryFn: async () => {
      const { data } = await supabase.from('campus_map_categories').select('*').order('name', { ascending: true });
      return data || [];
    }
  });

  React.useEffect(() => {
    if (categories.length > 0 && !formData.category) {
      setFormData(prev => ({ ...prev, category: categories[0].name }));
    }
  }, [categories]);

  const saveCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: existing, error: checkError } = await supabase
        .from('campus_map_categories')
        .select('id')
        .eq('name', data.name)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('campus_map_categories')
          .update({ icon_name: data.icon_name })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('campus_map_categories').insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map_categories'] });
      setNewCategory({ name: '', icon_name: 'MapPin' });
      showToast(dict.admin.alertCategorySaved || 'Kategorie uložena', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_map_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map_categories'] });
      showToast(dict.admin.alertCategoryDeleted || 'Kategorie smazána', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  React.useEffect(() => {
    import('leaflet').then(leaflet => {
      setL(leaflet);
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
    });
  }, []);

  const { data: points = [], isLoading } = useQuery({
    queryKey: ['map_points'],
    queryFn: async () => {
      const { data } = await supabase.from('campus_map_points').select('*').order('building_code', { ascending: true });
      return data || [];
    }
  });

  const savePointMutation = useMutation({
    mutationFn: async (data: any) => {
      // Find category icon_name
      const cat = categories.find((c: any) => c.name === data.category);
      const payload = {
        name: data.name,
        name_en: data.name_en,
        building_code: data.building_code,
        category: data.category,
        description: data.description,
        description_en: data.description_en,
        lat: data.lat,
        lng: data.lng,
        icon_name: cat?.icon_name || 'MapPin'
      };
      
      if (editingPoint) {
        const { error } = await supabase.from('campus_map_points').update(payload).eq('id', editingPoint.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('campus_map_points').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map_points'] });
      setIsAdding(false);
      setEditingPoint(null);
      setFormData({ name: '', name_en: '', building_code: '', category: categories[0]?.name || '', description: '', description_en: '', lat: 50.129, lng: 14.373 });
      showToast('Bod uložen', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const handleEditPoint = (point: any) => {
    setEditingPoint(point);
    setFormData({
      name: point.name,
      name_en: point.name_en || '',
      building_code: point.building_code,
      category: point.category,
      description: point.description || '',
      description_en: point.description_en || '',
      lat: point.lat,
      lng: point.lng
    });
    setIsAdding(true);
  };

  const handleCancelPoint = () => {
    setEditingPoint(null);
    setIsAdding(false);
    setFormData({ 
      name: '', 
      name_en: '', 
      building_code: '', 
      category: categories.length > 0 ? categories[0].name : '', 
      description: '', 
      description_en: '', 
      lat: 50.129, 
      lng: 14.373 
    });
  };

  const deletePointMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campus_map_points').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map_points'] });
      showToast('Bod smazán', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const getIcon = (categoryName: string) => {
    const category = categories.find((c: any) => c.name === categoryName);
    return <DynamicIcon name={category?.icon_name || 'MapPin'} size={16} />;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black flex items-center gap-3"><MapIcon className="text-green-600" /> {dict.admin.tabMap}</h2>
        <div className="flex gap-4">
          <button onClick={() => setIsManagingCategories(!isManagingCategories)} className="bg-stone-100 text-stone-600 px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-stone-200 transition">
            <Settings size={18} /> {lang === 'cs' ? 'Správa kategorií' : 'Manage categories'}
          </button>
          <button onClick={() => { if(isAdding) handleCancelPoint(); else setIsAdding(true); }} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
            {isAdding ? <X size={18} /> : <Plus size={18} />} {isAdding ? dict.admin.btnCancel : dict.map.addPoint}
          </button>
        </div>
      </div>

      {isManagingCategories && (
        <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-black uppercase tracking-widest text-stone-400">{lang === 'cs' ? 'Správa kategorií' : 'Manage Categories'}</h3>
          
          <div className="grid md:grid-cols-3 gap-4 items-end bg-stone-50 p-6 rounded-2xl">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelTitle}</label>
              <input 
                type="text" 
                placeholder="Název kategorie" 
                value={newCategory.name} 
                onChange={e => setNewCategory({...newCategory, name: e.target.value})} 
                className="w-full bg-white p-3 rounded-xl font-bold border-none shadow-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{lang === 'cs' ? 'Ikona' : 'Icon'}</label>
              <div className="grid grid-cols-6 gap-2 bg-white p-4 rounded-xl border max-h-48 overflow-y-auto">
                {AVAILABLE_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewCategory({...newCategory, icon_name: icon})}
                    className={`p-2 rounded-lg flex items-center justify-center transition ${
                      newCategory.icon_name === icon ? 'bg-green-600 text-white shadow-lg' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
                    }`}
                    title={icon}
                  >
                    <DynamicIcon name={icon} size={20} />
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => saveCategoryMutation.mutate(newCategory)}
              disabled={!newCategory.name}
              className="bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition disabled:opacity-50"
            >
              {dict.admin.btnSaveEvent}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map((cat: any) => (
              <div key={cat.id} className="bg-stone-50 p-4 rounded-2xl flex flex-col items-center gap-3 relative group">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                  <DynamicIcon name={cat.icon_name} size={20} />
                </div>
                <span className="text-xs font-bold text-stone-700 text-center">{cat.name}</span>
                <button 
                  onClick={() => deleteCategoryMutation.mutate(cat.id)}
                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdding && (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název (CZ)</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="Např. Menza"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Název (EN)</label>
                <input 
                  type="text" 
                  value={formData.name_en}
                  onChange={e => setFormData({...formData, name_en: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  placeholder="e.g. Canteen"
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.labelLocation}</label>
                <input type="text" placeholder="SIC, A, B..." value={formData.building_code} onChange={e => setFormData({...formData, building_code: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.discounts.category}</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold">
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                  {categories.length === 0 && <option value="">{lang === 'cs' ? 'Nejdříve přidejte kategorii' : 'Add a category first'}</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Popis (CZ)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  rows={3}
                  placeholder="Informace o budově..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Popis (EN)</label>
                <textarea 
                  value={formData.description_en}
                  onChange={e => setFormData({...formData, description_en: e.target.value})}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                  rows={3}
                  placeholder="Building info..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.map.lat}: {formData.lat.toFixed(5)}</label>
                <input type="number" step="0.00001" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.map.lng}: {formData.lng.toFixed(5)}</label>
                <input type="number" step="0.00001" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
              </div>
            </div>

            <button 
              onClick={() => {
                if (!formData.category && categories.length > 0) {
                  savePointMutation.mutate({ ...formData, category: categories[0].name });
                } else {
                  savePointMutation.mutate(formData);
                }
              }} 
              disabled={!formData.name || !formData.building_code || categories.length === 0 || savePointMutation.isPending}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-500 disabled:opacity-50 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
            >
              {savePointMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {editingPoint ? dict.admin.btnUpdateMapPoint : dict.admin.btnSaveMapPoint}
            </button>
          </div>

          <div className="bg-white p-4 rounded-[2.5rem] border shadow-sm relative overflow-hidden min-h-[400px]">
            {/* @ts-ignore */}
            {typeof window !== 'undefined' && L ? (
              <MapContainer 
                center={[50.129, 14.373]} 
                zoom={16} 
                className="w-full h-full rounded-[2rem]"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker 
                  currentPos={[formData.lat, formData.lng]} 
                  onLocationSelect={(lat, lng) => setFormData({ ...formData, lat, lng })} 
                />
              </MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-50 rounded-[2rem]">
                <Loader2 className="animate-spin text-green-600" size={48} />
              </div>
            )}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1000] bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border shadow-sm text-[10px] font-black uppercase tracking-widest text-stone-400">
              {dict.map.clickMap}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b">
            <tr>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.admin.labelLocation}</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.admin.labelTitle}</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.discounts.category}</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.admin.tabMap} (Lat, Lng)</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {points.map((p: any) => (
              <tr key={p.id}>
                <td className="px-8 py-4 font-black text-green-600">{p.building_code}</td>
                <td className="px-8 py-4 font-bold text-stone-900">{p.name}</td>
                <td className="px-8 py-4 uppercase text-[10px] font-black text-stone-400">{p.category}</td>
                <td className="px-8 py-4 font-medium text-stone-500">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</td>
                <td className="px-8 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => handleEditPoint(p)} className="text-stone-300 hover:text-green-600 transition"><Edit3 size={18} /></button>
                    <button onClick={() => deletePointMutation.mutate(p.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
