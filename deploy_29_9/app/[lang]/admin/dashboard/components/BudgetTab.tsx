'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, Trash2, Loader2, Save, X, Mail, Receipt } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import ConfirmModal from '@/app/components/ConfirmModal';
import { SkeletonTabContent } from '../../../components/Skeleton';

export default function BudgetTab({ dict, uploadImage }: { dict: any, uploadImage?: (file: File, bucket: string) => Promise<string> }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', amount: 0, type: 'expense', category: '', date: new Date().toISOString().split('T')[0] });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOCRRunning, setIsOCRRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string; onConfirm: () => void }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const { data: budget = [], isLoading } = useQuery({
    queryKey: ['admin_budget'],
    queryFn: async () => {
      const { data } = await supabase.from('budget').select('*').order('date', { ascending: false });
      return data || [];
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (!file) return;

    // Pokud uživatel nahrál soubor, nabídneme automatické vytěžení dat
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setIsOCRRunning(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch('/api/ocr', {
          method: 'POST',
          body: JSON.stringify({ 
            imageBase64: base64,
            mimeType: file.type || "image/jpeg"
          }),
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        const data = await res.json();
        
        if (data.merchant || data.amount) {
          setFormData(prev => ({
            ...prev,
            title: data.merchant || prev.title,
            amount: data.amount || prev.amount,
            category: data.category || prev.category,
            date: data.date || prev.date
          }));
          showToast('Údaje z účtenky byly úspěšně vytěženy pomocí AI!', 'success');
        }
      } catch (err) {
        console.error('OCR failed:', err);
        showToast('Nepodařilo se vytěžit data z účtenky, vyplňte je prosím ručně.', 'warning');
      } finally {
        setIsOCRRunning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addMutation = useMutation({
    mutationFn: async (newData: any) => {
      // 1. Uložit položku rozpočtu
      const { data: budgetItem, error } = await supabase.from('budget').insert([newData]).select().single();
      if (error) throw error;

      // 2. Pokud je obrázek, nahrát a uložit jako účtenku
      if (imageFile && uploadImage && budgetItem) {
        setIsUploading(true);
        try {
          const imageUrl = await uploadImage(imageFile, 'receipts');
          
          // Simulace OCR - v reálné app by se zde volalo API (např. Taggun)
          const ocrData = {
            merchant: newData.title,
            amount: newData.amount,
            currency: 'CZK',
            date: newData.date,
            confidence: 0.95
          };

          await supabase.from('budget_receipts').insert([{
            budget_id: budgetItem.id,
            image_url: imageUrl,
            ocr_data: ocrData
          }]);
        } catch (uploadErr) {
          console.error('Receipt upload failed:', uploadErr);
          showToast('Položka uložena, ale nahrání účtenky selhalo', 'warning');
        } finally {
          setIsUploading(false);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_budget'] });
      showToast(dict.admin.budget?.alertSave || 'Položka přidána do rozpočtu', 'success');
      setIsAdding(false);
      setImageFile(null);
      setFormData({ title: '', amount: 0, type: 'expense', category: '', date: new Date().toISOString().split('T')[0] });
    },
    onError: (err: any) => {
      console.error('Budget save error:', err);
      showToast(err.message || 'Nepodařilo se uložit položku rozpočtu.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budget').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_budget'] });
      showToast(dict.admin.budget?.alertDelete || 'Položka smazána', 'success');
    }
  });

  const totalBalance = budget.reduce((acc, curr) => curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0);

  const generateMonthlyReport = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyData = budget.filter(item => {
      const d = new Date(item.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = monthlyData.filter(i => i.type === 'income').reduce((a, c) => a + Number(c.amount), 0);
    const expense = monthlyData.filter(i => i.type === 'expense').reduce((a, c) => a + Number(c.amount), 0);

    const report = `
      REPORT - ${now.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
      -----------------------------------------
      Income: ${income.toLocaleString()} CZK
      Expense: ${expense.toLocaleString()} CZK
      Balance: ${(income - expense).toLocaleString()} CZK
      
      Items: ${monthlyData.length}
      -----------------------------------------
    `;

    console.log(report);
    showToast(dict.admin.budget?.reportSent || 'Report vygenerován', 'success');
  };

  const deleteItem = (id: string) => {
    setModalConfig({
      title: 'Smazat položku?',
      message: 'Opravdu chcete tuto položku z rozpočtu smazat?',
      onConfirm: () => deleteMutation.mutate(id)
    });
    setModalOpen(true);
  };

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm md:col-span-2 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-3 mb-1">
              <Wallet className="text-green-600" />
              {dict.admin.tabBudget}
            </h2>
            <p className="text-stone-400 text-xs font-black uppercase tracking-widest">{dict.admin.budget?.subtitle}</p>
          </div>
          <div className="text-right flex items-center gap-6">
            <button 
              onClick={generateMonthlyReport}
              className="p-3 bg-stone-50 text-stone-400 rounded-xl hover:bg-stone-900 hover:text-white transition group"
              title={dict.admin.budget?.reportTitle}
            >
              <Mail size={20} className="group-hover:scale-110 transition" />
            </button>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">{dict.admin.budget?.totalBalance}</span>
              <span className={`text-3xl font-black ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalBalance.toLocaleString()} Kč
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-green-600 text-white p-8 rounded-[2.5rem] font-black uppercase tracking-widest flex flex-col items-center justify-center gap-2 hover:bg-green-500 transition shadow-lg shadow-green-900/20"
        >
          {isAdding ? <X size={32} /> : <Plus size={32} />}
          {isAdding ? dict.admin.btnCancel : dict.admin.budget?.newEntry}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.budget?.labelTitle}</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder={dict.admin.budget?.placeholderTitle}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.budget?.labelAmount}</label>
              <input 
                type="number" 
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.budget?.labelType}</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition appearance-none"
              >
                <option value="expense">{dict.admin.budget?.typeExpense}</option>
                <option value="income">{dict.admin.budget?.typeIncome}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.budget?.labelCategory}</label>
              <input 
                type="text" 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
                placeholder={dict.admin.budget?.placeholderCategory}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">{dict.admin.budget?.labelDate}</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 font-bold text-stone-700 focus:ring-2 focus:ring-green-500 transition"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 px-1">Nahrát účtenku (volitelné)</label>
              <div className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer relative group transition-all ${isOCRRunning ? 'bg-green-50 border-green-300 animate-pulse' : 'bg-stone-50 border-stone-200 hover:bg-white hover:border-green-300'}`}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                  disabled={isOCRRunning}
                />
                <div className="flex items-center justify-center gap-3 text-stone-500 group-hover:text-green-600 transition">
                  {isOCRRunning ? <Loader2 className="animate-spin text-green-600" size={24} /> : <Receipt size={24} />}
                  {imageFile ? (
                    <span className="font-bold text-sm text-green-600">{imageFile.name}</span>
                  ) : (
                    <span className="font-bold text-sm">Nahrát účtenku (AI automaticky vyplní údaje)</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => addMutation.mutate(formData)}
                disabled={!formData.title || !formData.amount || addMutation.isPending || isUploading}
                className="w-full bg-stone-900 text-white py-3 rounded-xl font-black uppercase tracking-widest hover:bg-green-600 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-xl"
              >
                {addMutation.isPending || isUploading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {dict.admin.budget?.btnSave}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Datum</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Položka</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Kategorie</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Částka</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {budget.map((item: any) => (
                <tr key={item.id} className="hover:bg-stone-50/50 transition">
                  <td className="px-6 py-4 text-sm font-medium text-stone-500">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-stone-900">{item.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-1 rounded-md">{item.category}</span>
                  </td>
                  <td className={`px-6 py-4 font-black text-right ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.type === 'income' ? '+' : '-'}{Number(item.amount).toLocaleString()} Kč
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-2 text-stone-300 hover:text-red-600 transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {budget.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-stone-400 font-bold uppercase tracking-widest text-xs">Žádné záznamy</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
      />
    </div>
  );
}
