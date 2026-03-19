'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, FileText, Loader2, User, Mail, Phone, GraduationCap, Quote, FileCheck } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import SignaturePad from '../../../components/SignaturePad';
import Image from 'next/image';
import { SkeletonTabContent } from '../../../components/Skeleton';
import AdminModuleHeader from './ui/AdminModuleHeader';
import AdminEmptyState from './ui/AdminEmptyState';

export default function ApplicationsTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [chairSignature, setChairSignature] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => {
      const { data } = await supabase.from('applications').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, signature, reason }: any) => {
      const { error } = await supabase.from('applications').update({
        status,
        chairwoman_signature: signature,
        rejection_reason: reason
      }).eq('id', id);
      if (error) throw error;

      // Pokud schváleno, označíme uživatele v profiles jako člena (pokud tam je)
      if (status === 'approved') {
        const app = applications.find((a: any) => a.id === id);
        if (app) {
          await supabase.from('profiles').update({ is_member: true, member_since: new Date().toISOString() }).eq('email', app.email);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedApp(null);
      setChairSignature('');
      setRejectionReason('');
      showToast(dict.admin.alertStatusUpdated || 'Status aktualizován', 'success');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  if (isLoading) return <SkeletonTabContent />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AdminModuleHeader
        title={dict.admin.tabApplications}
        description="Správa a schvalování členských přihlášek"
        actions={
          <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-xl border border-stone-100">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
              {applications.filter((a: any) => a.status === 'pending').length} k vyřízení
            </span>
          </div>
        }
      />

      {applications.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title={dict.admin.emptyApplications || 'Žádné přihlášky'}
          description="Až někdo odešle přihlášku do členství, zobrazí se tady."
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {applications.map((app: any) => (
          <div 
            key={app.id} 
            onClick={() => setSelectedApp(app)}
            className={`group bg-white p-6 rounded-[2.5rem] border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
              selectedApp?.id === app.id 
                ? 'border-green-500 ring-4 ring-green-50' 
                : 'border-stone-100 shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 font-black text-xl border border-stone-100 group-hover:bg-white group-hover:scale-110 transition-all">
                {app.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                app.status === 'approved' ? 'bg-green-100 text-green-700' : 
                app.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                'bg-amber-100 text-amber-700'
              }`}>
                {app.status === 'approved' ? 'Schváleno' : app.status === 'rejected' ? 'Odmítnuto' : 'Čeká'}
              </span>
            </div>
            <h3 className="font-black text-stone-900 text-lg mb-1 group-hover:text-green-600 transition-colors">{app.full_name}</h3>
            <div className="flex items-center gap-3 mb-6">
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest flex items-center gap-1"><Clock size={12} /> {new Date(app.created_at).toLocaleDateString()}</p>
              <span className="w-1 h-1 bg-stone-200 rounded-full"></span>
              <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest truncate max-w-[100px]">{app.email.split('@')[0]}</p>
            </div>
            <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-50 group-hover:bg-white transition-all">
              <p className="text-stone-500 text-xs font-medium line-clamp-2 italic leading-relaxed">"{app.motivation}"</p>
            </div>
          </div>
          ))}
        </div>
      )}

      {selectedApp && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
            <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/20">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight">{dict.admin.appDetail || 'Detail přihlášky'}</h2>
                  <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mt-0.5">ID: {selectedApp.id.substring(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedApp(null)} className="p-3 hover:bg-stone-100 rounded-2xl transition text-stone-400 hover:text-stone-900">
                <XCircle size={28} />
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-8 lg:p-12 custom-scrollbar">
              <div className="grid lg:grid-cols-12 gap-12">
                <div className="lg:col-span-7 space-y-10">
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-stone-900 border-b border-stone-100 pb-2">
                      <User size={20} className="text-green-600" /> 
                      <h3 className="text-sm font-black uppercase tracking-widest">{dict.admin.personalData || 'Osobní údaje'}</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-8 bg-stone-50/50 p-6 rounded-[2rem] border border-stone-100">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Jméno</p>
                        <p className="text-xl font-black text-stone-900">{selectedApp.full_name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{dict.admin.birthDate || 'Narození'}</p>
                        <p className="text-xl font-black text-stone-900">{selectedApp.birth_date}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Email</p>
                        <p className="text-sm font-bold text-stone-700 flex items-center gap-2"><Mail size={14} className="text-stone-400" /> {selectedApp.email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Telefon</p>
                        <p className="text-sm font-bold text-stone-700 flex items-center gap-2"><Phone size={14} className="text-stone-400" /> {selectedApp.phone || '-'}</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-stone-900 border-b border-stone-100 pb-2">
                      <GraduationCap size={20} className="text-blue-600" /> 
                      <h3 className="text-sm font-black uppercase tracking-widest">Fakulta & Studium</h3>
                    </div>
                    <div className="bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100">
                      <p className="font-black text-blue-900 text-lg">{selectedApp.faculty_info}</p>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-stone-900 border-b border-stone-100 pb-2">
                      <Quote size={20} className="text-amber-600" /> 
                      <h3 className="text-sm font-black uppercase tracking-widest">{dict.admin.motivation || 'Motivace'}</h3>
                    </div>
                    <div className="bg-amber-50/30 p-8 rounded-[2rem] border border-amber-100 relative">
                      <Quote className="absolute top-4 left-4 text-amber-200" size={32} />
                      <p className="text-stone-700 leading-relaxed italic font-medium relative z-10 pl-4 text-lg">
                        "{selectedApp.motivation}"
                      </p>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-stone-900 border-b border-stone-100 pb-2">
                      <FileCheck size={20} className="text-stone-600" /> 
                      <h3 className="text-sm font-black uppercase tracking-widest">{dict.admin.applicantSignature || 'Podpis žadatele'}</h3>
                    </div>
                    <div className="border border-stone-100 rounded-[2rem] overflow-hidden bg-stone-50 shadow-inner flex items-center justify-center p-8">
                      <Image 
                        src={selectedApp.applicant_signature} 
                        alt="Podpis" 
                        width={400} 
                        height={150} 
                        className="max-w-full h-auto mix-blend-multiply opacity-80" 
                        unoptimized
                      />
                    </div>
                  </section>
                </div>

                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-stone-900 text-white p-10 rounded-[3rem] shadow-xl sticky top-0">
                    {selectedApp.status === 'pending' ? (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-2xl font-black mb-1">{dict.admin.decision || 'Rozhodnutí'}</h3>
                          <p className="text-stone-400 text-xs font-medium">Posouzení přihlášky a aktivace členství</p>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 px-1">{dict.admin.rejectionReason || 'Důvod odmítnutí (volitelné)'}</label>
                          <textarea 
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="w-full bg-stone-800 border-none rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-red-500 transition placeholder:text-stone-600 text-white"
                            placeholder={dict.admin.rejectionPlaceholder || 'Proč byla přihláška zamítnuta?'}
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 px-1">{dict.admin.chairwomanSignature || 'Podpis předsedkyně'}</label>
                          <div className="bg-white rounded-[2rem] overflow-hidden border-4 border-stone-800">
                            <SignaturePad 
                              onSave={dataUrl => setChairSignature(dataUrl)}
                              onClear={() => setChairSignature('')}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: selectedApp.id, status: 'approved', signature: chairSignature })}
                            disabled={!chairSignature || updateStatusMutation.isPending}
                            className="bg-green-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-500 disabled:opacity-50 transition-all flex flex-col items-center justify-center gap-2 shadow-lg shadow-green-900/40"
                          >
                            <CheckCircle size={24} />
                            {dict.admin.btnApprove || 'Schválit'}
                          </button>
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: selectedApp.id, status: 'rejected', signature: chairSignature, reason: rejectionReason })}
                            disabled={!chairSignature || updateStatusMutation.isPending}
                            className="bg-red-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500 disabled:opacity-50 transition-all flex flex-col items-center justify-center gap-2 shadow-lg shadow-red-900/40"
                          >
                            <XCircle size={24} />
                            {dict.admin.btnReject || 'Odmítnout'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 space-y-8">
                        <div className="relative inline-block">
                          <div className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center shadow-2xl rotate-3 ${
                            selectedApp.status === 'approved' ? 'bg-green-600' : 'bg-red-600'
                          }`}>
                            {selectedApp.status === 'approved' ? <CheckCircle size={48} /> : <XCircle size={48} />}
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-white text-stone-900 rounded-full p-2 shadow-lg">
                            <FileCheck size={16} />
                          </div>
                        </div>

                        <div>
                          <h3 className="text-3xl font-black uppercase tracking-tighter mb-1">{dict.admin.decided || 'Rozhodnuto'}</h3>
                          <p className={`font-black uppercase tracking-[0.2em] text-xs ${
                            selectedApp.status === 'approved' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {selectedApp.status === 'approved' ? (dict.admin.appApproved || 'Přihláška schválena') : (dict.admin.appRejected || 'Přihláška zamítnuta')}
                          </p>
                        </div>
                        
                        {selectedApp.rejection_reason && (
                          <div className="p-6 bg-red-900/30 text-red-200 rounded-[2rem] text-sm italic font-medium border border-red-800/50">
                            "{selectedApp.rejection_reason}"
                          </div>
                        )}

                        <div className="pt-8 border-t border-stone-800">
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 block mb-4">{dict.admin.chairwomanSignature || 'Podpis předsedkyně'}</span>
                          <div className="bg-white rounded-[2rem] p-6 border-4 border-stone-800 shadow-inner">
                            <Image 
                              src={selectedApp.chairwoman_signature} 
                              alt="Podpis předsedkyně" 
                              width={400} 
                              height={150} 
                              className="w-full h-auto mix-blend-multiply" 
                              unoptimized
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
