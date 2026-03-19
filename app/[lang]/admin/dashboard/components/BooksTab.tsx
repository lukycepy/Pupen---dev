'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, BookOpen, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/app/context/ToastContext';
import Skeleton from '@/app/[lang]/components/Skeleton';

export default function BooksTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', author: '', price: '', contact: '' });

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['admin_books'],
    queryFn: async () => {
      const { data } = await supabase.from('book_exchange').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        price: parseFloat(data.price) || 0,
        status: 'active'
      };
      const { error } = await supabase.from('book_exchange').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_books'] });
      setIsAdding(false);
      setFormData({ title: '', author: '', price: '', contact: '' });
      showToast(dict.books.saveSuccess, 'success');
    },
    onError: (err: any) => {
      console.error(err);
      showToast(err.message || 'Chyba při ukládání', 'error');
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('book_exchange').update({ status: 'active' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_books'] }),
    onError: (err: any) => showToast(err.message, 'error')
  });

  const toggleSoldMutation = useMutation({
    mutationFn: async ({ id, is_sold }: { id: string, is_sold: boolean }) => {
      const { error } = await supabase.from('book_exchange').update({ is_sold: !is_sold }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_books'] }),
    onError: (err: any) => showToast(err.message, 'error')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('book_exchange').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_books'] });
      showToast(dict.admin.confirmDeleteSuccess, 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black flex items-center gap-3"><BookOpen className="text-green-600" /> {dict.admin.tabBooks}</h2>
        <button onClick={() => setIsAdding(!isAdding)} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2">
          <Plus size={18} /> {dict.books.newAd}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border shadow-sm grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <input type="text" placeholder={dict.books.bookTitle} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
            <input type="text" placeholder={dict.books.author} value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input type="number" placeholder={dict.books.price} value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
              <input type="text" placeholder={dict.books.contact} value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full bg-stone-50 p-4 rounded-xl font-bold" />
            </div>
            <button onClick={() => saveMutation.mutate(formData)} className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold">{dict.books.btnSave}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b">
            <tr>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.books.bookTitle}</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.books.contact}</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.books.price}</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.books.status}</th>
              <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-stone-400">{dict.admin.tabMessages.includes('Zprávy') ? 'Akce' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-8 py-4"><Skeleton className="h-10 w-48 rounded-lg" /></td>
                  <td className="px-8 py-4"><Skeleton className="h-6 w-32 rounded-lg" /></td>
                  <td className="px-8 py-4"><Skeleton className="h-6 w-16 rounded-lg" /></td>
                  <td className="px-8 py-4"><Skeleton className="h-8 w-24 rounded-full" /></td>
                  <td className="px-8 py-4"><Skeleton className="h-8 w-8 rounded-lg" /></td>
                </tr>
              ))
            ) : books.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-stone-400 font-medium">
                  {dict.books.noBooks || 'No books found'}
                </td>
              </tr>
            ) : (
              books.map((book: any) => (
              <tr key={book.id} className={book.is_sold ? 'opacity-50' : ''}>
                <td className="px-8 py-4">
                  <div className="font-bold text-stone-900">{book.title}</div>
                  <div className="text-xs text-stone-400">{book.author}</div>
                  {book.status === 'pending' && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded">
                      {dict.books.pending}
                    </span>
                  )}
                </td>
                <td className="px-8 py-4 font-medium text-stone-600 text-sm">{book.contact}</td>
                <td className="px-8 py-4 font-black text-green-600">{book.price} {dict.books.priceLabel}</td>
                <td className="px-8 py-4">
                  {book.status === 'pending' ? (
                    <button 
                      onClick={() => approveMutation.mutate(book.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase hover:bg-green-700 transition"
                    >
                      {dict.admin.btnApprove}
                    </button>
                  ) : (
                    <button onClick={() => toggleSoldMutation.mutate(book)} className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${book.is_sold ? 'bg-stone-100 text-stone-400' : 'bg-green-100 text-green-700'}`}>
                      {book.is_sold ? <XCircle size={12} /> : <CheckCircle size={12} />}
                      {book.is_sold ? dict.books.sold : dict.books.active}
                    </button>
                  )}
                </td>
                <td className="px-8 py-4">
                  <button onClick={() => deleteMutation.mutate(book.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
