'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, Play, CheckCircle2, XCircle, RefreshCw, Trophy } from 'lucide-react';
import Skeleton, { SkeletonGrid } from '../components/Skeleton';

import { getDictionary } from '@/lib/get-dictionary';

export default function QuizzesPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'cs';
  
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [dict, setDict] = useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    getDictionary(lang).then(d => {
      if (isMounted) setDict(d.quizzes);
    });
    return () => { isMounted = false; };
  }, [lang]);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['public_quizzes'],
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const handleStart = (quiz: any) => {
    setActiveQuiz(quiz);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);
    setSelectedOption(null);
  };

  const handleAnswer = (index: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(index);
    
    if (index === activeQuiz.questions[currentQuestion].correct) {
      setScore(score + 1);
    }

    setTimeout(() => {
      if (currentQuestion + 1 < activeQuiz.questions.length) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
      } else {
        setShowResult(true);
      }
    }, 1500);
  };

  if (isLoading || !dict) {
    return (
      <div className="min-h-screen bg-stone-50 pt-24 pb-32">
        <div className="max-w-4xl mx-auto px-6">
          <header className="text-center mb-16">
            <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
              <BrainCircuit size={32} />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-12 w-72 mx-auto rounded-2xl" />
              <Skeleton className="h-6 w-96 mx-auto rounded-xl" />
            </div>
          </header>
          <SkeletonGrid count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-32">
      <div className="max-w-4xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex p-3 bg-green-100 text-green-600 rounded-2xl mb-6">
            <BrainCircuit size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-stone-900 tracking-tighter mb-4">{dict.title}</h1>
          <p className="text-stone-500 text-lg font-medium">{dict.subtitle}</p>
        </header>

        {!activeQuiz ? (
          <div className="grid md:grid-cols-2 gap-8">
            {quizzes.map((quiz: any) => (
              <div key={quiz.id} className="bg-white p-8 rounded-[3rem] shadow-xl border border-stone-100 flex flex-col group">
                <h3 className="text-2xl font-black text-stone-900 mb-4 group-hover:text-green-600 transition">
                  {lang === 'en' && quiz.title_en ? quiz.title_en : quiz.title}
                </h3>
                <p className="text-stone-500 font-medium mb-8 flex-grow">
                  {lang === 'en' && quiz.description_en ? quiz.description_en : quiz.description}
                </p>
                <button 
                  onClick={() => handleStart(quiz)}
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-600 transition flex items-center justify-center gap-3 shadow-lg"
                >
                  <Play size={18} /> {dict.startBtn}
                </button>
              </div>
            ))}
          </div>
        ) : showResult ? (
          <div className="bg-stone-900 text-white p-12 md:p-20 rounded-[4rem] shadow-2xl text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-transparent" />
             </div>
             
             <Trophy className="mx-auto text-green-500 mb-8" size={80} />
             <h2 className="text-4xl md:text-6xl font-black mb-4">{dict.resultTitle}</h2>
             <div className="text-7xl md:text-9xl font-black text-green-500 mb-8">
               {Math.round((score / activeQuiz.questions.length) * 100)}%
             </div>
             <p className="text-xl font-bold text-stone-400 mb-12">
               {dict.resultText.replace('{score}', score).replace('{total}', activeQuiz.questions.length)}
             </p>
             
             <button 
               onClick={() => setActiveQuiz(null)}
               className="bg-white text-stone-900 px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-500 hover:text-white transition shadow-xl"
             >
               <RefreshCw className="inline-block mr-2" size={20} /> {dict.tryAgain}
             </button>
          </div>
        ) : (
          <div className="bg-white p-8 md:p-16 rounded-[4rem] shadow-2xl border border-stone-100">
            <div className="flex items-center justify-between mb-12">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
                {dict.questionCount.replace('{current}', currentQuestion + 1).replace('{total}', activeQuiz.questions.length)}
              </span>
              <div className="h-2 w-32 bg-stone-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500" 
                  style={{ width: `${((currentQuestion + 1) / activeQuiz.questions.length) * 100}%` }}
                />
              </div>
            </div>

            <h2 className="text-2xl md:text-4xl font-black text-stone-900 mb-12 leading-tight">
              {lang === 'en' && activeQuiz.questions[currentQuestion].question_en 
                ? activeQuiz.questions[currentQuestion].question_en 
                : activeQuiz.questions[currentQuestion].question}
            </h2>

            <div className="grid gap-4">
              {activeQuiz.questions[currentQuestion].options.map((opt: string, i: number) => {
                const optText = lang === 'en' && activeQuiz.questions[currentQuestion].options_en 
                  ? activeQuiz.questions[currentQuestion].options_en[i] 
                  : opt;
                return (
                  <button 
                    key={i}
                    disabled={selectedOption !== null}
                    onClick={() => handleAnswer(i)}
                    className={`w-full text-left p-6 rounded-3xl font-bold transition-all border-2 flex items-center justify-between group ${
                      selectedOption === i 
                        ? (i === activeQuiz.questions[currentQuestion].correct ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700')
                        : (selectedOption !== null && i === activeQuiz.questions[currentQuestion].correct ? 'bg-green-50 border-green-500 text-green-700' : 'bg-stone-50 border-transparent text-stone-600 hover:border-stone-200 hover:bg-white')
                    }`}
                  >
                    {optText}
                    {selectedOption === i && (
                      i === activeQuiz.questions[currentQuestion].correct ? <CheckCircle2 size={24} /> : <XCircle size={24} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
