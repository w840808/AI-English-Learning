"use client";

import { useState, useEffect, useRef } from "react";
import { BookOpen, Settings, PlayCircle, Loader2, BookMarked, X, LogOut, User } from "lucide-react";
import InteractiveArticle from "./InteractiveArticle";
import { createSupabaseClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ReaderApp() {
  const [difficulty, setDifficulty] = useState("TOEFL iBT (80-100)");
  const [topic, setTopic] = useState("Trending News");
  const [keywords, setKeywords] = useState("");
  const [wordCount, setWordCount] = useState("~300 words");
  const [showTranslation, setShowTranslation] = useState(false);
  
  const defaultArticle = {
    title: "The Rise of Artificial Intelligence in Education",
    paragraphs: [
      {
        english: "Artificial Intelligence (AI) is rapidly transforming the educational landscape. It offers unprecedented opportunities for personalized learning and tailored instruction. Students can now access intelligent tutoring systems that adapt to their individual pace and learning style, providing instant feedback and support.",
        chinese: "人工智慧（AI）正在迅速改變教育面貌。它為個人化學習和量身定制的指導提供了前所未有的機會。學生現在可以使用智慧家教系統，這些系統能適應他們各自的步調和學習風格，提供即時回饋與支援。"
      },
      {
        english: "However, the integration of AI in classrooms also presents significant challenges. Educators must ensure equitable access to these technologies to avoid widening the digital divide. Furthermore, it is crucial to address privacy concerns and maintain the human element in teaching, as AI should complement, not replace, human educators.",
        chinese: "然而，將 AI 整合到教室中也帶來了重大挑戰。教育工作者必須確保這些技術的公平存取，以避免擴大數位落差。此外，解決隱私問題並保持教學中的人為因素至關重要，因為 AI 應該補充而非取代人類教育者。"
      }
    ],
    grammar_analysis: [
      {
        sentence: "It offers unprecedented opportunities for personalized learning and tailored instruction.",
        explanation: "這裡的主詞 It 代指前一句的 Artificial Intelligence。「offer opportunities for...」是常見搭配，表示「為...提供機會」。unprecedented 形容詞意為「史無前例的」，強調 AI 帶來的影響程度深遠。"
      },
      {
        sentence: "Students can now access intelligent tutoring systems that adapt to their individual pace and learning style, providing instant feedback and support.",
        explanation: "這個長句中包含了一個由 that 引導的關係子句修飾 systems，說明系統的作用是適應學生進度。句尾的 providing... 則是現在分詞片語作為補充說明（或者說伴隨狀態），補充說明這些系統在適應進度的同時提供了什麼功能。"
      },
      {
        sentence: "Furthermore, it is crucial to address privacy concerns and maintain the human element in teaching, as AI should complement, not replace, human educators.",
        explanation: "這是一個使用了「虛主詞 It」的句型（It is + 形容詞 + to VR...），真正的主詞是後面的 to address... and maintain...。後面的 as 做連接詞使用，表示「因為」，引出補充說明的理由。"
      }
    ]
  };

  const [isLoading, setIsLoading] = useState(false);
  const [articleData, setArticleData] = useState<any>(defaultArticle);
  const [error, setError] = useState("");

  // UI Tabs & Features
  const [activeTab, setActiveTab] = useState<"generator" | "notebook">("generator");
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Notebook States
  const [savedWords, setSavedWords] = useState<any[]>([]);
  const [savedArticles, setSavedArticles] = useState<any[]>([]);

  // TTS Voice State
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>("");

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const enVoices = voices.filter(v => v.lang.startsWith('en'));
      setAvailableVoices(enVoices);
      
      if (!selectedVoiceUri && enVoices.length > 0) {
         const goodVoice = enVoices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Online')) && v.lang.startsWith('en'))
             || enVoices.find(v => v.lang.startsWith('en-US')) 
             || enVoices[0];
         if (goodVoice) setSelectedVoiceUri(goodVoice.voiceURI);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceUri]);

  // Auth & DB
  const [user, setUser] = useState<any>(null);
  const supabase = createSupabaseClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) fetchData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) fetchData(session.user.id);
      else { setSavedWords([]); setSavedArticles([]); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async (userId: string) => {
    const { data: articles } = await supabase.from('saved_articles').select('*').order('created_at', { ascending: false });
    if (articles) setSavedArticles(articles.map(a => a.article_data));

    const { data: words } = await supabase.from('saved_vocabulary').select('*').order('created_at', { ascending: false });
    if (words) {
       // map to the same shape as local data
       setSavedWords(words.map(w => ({
          wordOrPhrase: w.word,
          pos: w.pos,
          ipa: w.ipa,
          definition: w.definition,
          usage_in_context: w.usage_in_context
       })));
    }
  };

  const saveWord = async (wordData: any) => {
    if (!user) return router.push("/login");
    if (!savedWords.find(w => w.wordOrPhrase === wordData.wordOrPhrase)) {
        const updated = [wordData, ...savedWords];
        setSavedWords(updated);
        await supabase.from('saved_vocabulary').insert({
           user_id: user.id,
           word: wordData.wordOrPhrase,
           pos: wordData.pos,
           ipa: wordData.ipa,
           definition: wordData.definition,
           usage_in_context: wordData.usage_in_context
        });
    }
  };

  const removeWord = async (wordStr: string) => {
    const updated = savedWords.filter(w => w.wordOrPhrase !== wordStr);
    setSavedWords(updated);
    if (user) {
       await supabase.from('saved_vocabulary').delete().eq('word', wordStr).eq('user_id', user.id);
    }
  };
  
  const saveArticle = async (article: any) => {
    if (!user) return router.push("/login");
    if (!savedArticles.find(a => a.title === article.title)) {
       const updated = [article, ...savedArticles];
       setSavedArticles(updated);
       await supabase.from('saved_articles').insert({
           user_id: user.id,
           title: article.title,
           article_data: article
       });
    }
  };

  const removeArticle = async (title: string) => {
    const updated = savedArticles.filter(a => a.title !== title);
    setSavedArticles(updated);
    if (user) {
       await supabase.from('saved_articles').delete().eq('title', title).eq('user_id', user.id);
    }
  };

  // Dictionary Selection State
  const [isDefining, setIsDefining] = useState(false);
  const [definitionData, setDefinitionData] = useState<any>(null);

  const handleGenerate = async () => {
    setError("");
    setIsLoading(true);
    setArticleData(null);
    setDefinitionData(null);
    
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, topic, wordCount, keywords })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate");
      }
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let completeText = "";
      
      if (reader) {
          while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              completeText += decoder.decode(value, { stream: true });
          }
      }
      
      const parsedData = JSON.parse(completeText);
      setArticleData(parsedData);
      
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelection = async (text: string) => {
    if (!articleData) return;
    
    setIsDefining(true);
    setDefinitionData(null);

    try {
      const contextStr = articleData.paragraphs.map((p: any) => p.english).join('\\n\\n');
      const res = await fetch("/api/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           selection: text, 
           context: contextStr
        })
      });

      if (res.ok) {
         const data = await res.json();
         setDefinitionData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDefining(false);
    }
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-stone-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50 relative selection:bg-indigo-200 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100">
      
      {/* Left Sidebar - Controls */}
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full shrink-0 z-10 shadow-sm relative">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <PlayCircle className="w-6 h-6 text-indigo-500" />
            AI Radio
          </h1>
          <p className="text-sm text-zinc-500 mt-1 dark:text-zinc-400">Your tailored English lessons</p>
          
          <div className="mt-4 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
             {user ? (
               <>
                 <div className="flex items-center gap-2 overflow-hidden">
                    <User className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{user.email}</span>
                 </div>
                 <button onClick={() => supabase.auth.signOut()} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors" title="Sign out">
                   <LogOut className="w-3.5 h-3.5" />
                 </button>
               </>
             ) : (
                <button 
                  onClick={() => router.push("/login")}
                  className="w-full text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 py-1"
                >
                  Sign in to save progress &rarr;
                </button>
             )}
          </div>

          <div className="flex gap-2 mt-4 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
             <button 
                onClick={() => setActiveTab("generator")}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${activeTab === "generator" ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                Radio
             </button>
             <button 
                onClick={() => setActiveTab("notebook")}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${activeTab === "notebook" ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                Notebook
             </button>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {activeTab === "generator" ? (
             <>
                {error && <div className="text-xs text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded">{error}</div>}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Difficulty (TOEFL)</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option>TOEFL Junior</option>
              <option>TOEFL iBT (60-80)</option>
              <option>TOEFL iBT (80-100)</option>
              <option>TOEFL iBT (100+)</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
            <select value={topic} onChange={e => setTopic(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option>Trending News</option>
              <option>Science & Discovery</option>
              <option>Tech & AI</option>
              <option>Business & Economy</option>
              <option>Pop Culture & Arts</option>
              <option>Lifestyle & Travel</option>
              <option>Academic</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Keywords (Optional)</label>
            <input 
               type="text" 
               placeholder="e.g. Olympics, Space X..."
               value={keywords}
               onChange={e => setKeywords(e.target.value)}
               className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400"
            />
            <p className="text-[10px] text-zinc-500">Tailor the story with specific words</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Length</label>
            <select value={wordCount} onChange={e => setWordCount(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option>~100 words (Quick)</option>
              <option>~300 words (Standard)</option>
              <option>~500 words (Detailed)</option>
              <option>~800 words (Long)</option>
              <option>~1000 words (In-depth)</option>
            </select>
          </div>
          
          <div className="space-y-2">
             <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Speaking Speed</label>
             <select value={playbackSpeed} onChange={e => setPlaybackSpeed(parseFloat(e.target.value))} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
               <option value={0.8}>0.8x (Slow)</option>
               <option value={0.9}>0.9x (Normal)</option>
               <option value={1.0}>1.0x (Slightly Fast)</option>
               <option value={1.2}>1.2x (Fast)</option>
             </select>
          </div>
          
          <div className="space-y-2">
             <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Voice Engine</label>
             <select value={selectedVoiceUri} onChange={e => setSelectedVoiceUri(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]" title={availableVoices.find(v => v.voiceURI === selectedVoiceUri)?.name}>
               {availableVoices.length === 0 && <option value="">Loading voices...</option>}
               {availableVoices.map((voice) => (
                 <option key={voice.voiceURI} value={voice.voiceURI}>
                   {voice.name.replace('Microsoft', 'MS').replace('Google', 'G-')}
                 </option>
               ))}
             </select>
          </div>
          </>
          ) : (
            <div className="space-y-4">
               <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Saved Articles</h3>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                     {savedArticles.length} articles saved
                  </div>
               </div>
               <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Vocabulary</h3>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                     {savedWords.length} words saved
                  </div>
               </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <button 
            disabled={isLoading}
            onClick={handleGenerate}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            {isLoading ? "Generating..." : "Generate"}
          </button>
        </div>
      </aside>

      {/* Main Content - Reader / Notebook */}
      <main className="flex-1 overflow-y-auto relative bg-stone-50 dark:bg-zinc-950">
        {activeTab === "notebook" ? (
          <div className="max-w-5xl mx-auto py-12 px-8 sm:px-12">
            <h1 className="text-3xl font-bold font-serif mb-12 text-zinc-900 dark:text-zinc-50">Your Learning Notebook</h1>
            
            <section className="mb-16">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-500"/> Saved Articles & Stories</h2>
              {savedArticles.length === 0 ? (
                 <p className="text-zinc-500 text-sm">No articles saved yet.</p>
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedArticles.map((article, i) => (
                        <div key={i} 
                             onClick={() => { setArticleData(article); setActiveTab("generator"); }}
                             className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-md group">
                           <div className="flex justify-between items-start mb-3">
                             <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{article.title}</h3>
                             <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeArticle(article.title);
                                }}
                                className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-4 h-4"/>
                             </button>
                           </div>
                           <p className="text-sm text-zinc-500 line-clamp-2">{article.paragraphs?.[0]?.english || "No preview available..."}</p>
                        </div>
                    ))}
                 </div>
              )}
            </section>
        
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><BookMarked className="w-5 h-5 text-indigo-500"/> Vocabulary Bank</h2>
              {savedWords.length === 0 ? (
                 <p className="text-zinc-500 text-sm">No vocabulary saved yet.</p>
              ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedWords.map((word, i) => (
                        <div key={i} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl relative group hover:shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-900">
                            <button 
                                onClick={() => removeWord(word.wordOrPhrase)}
                                className="absolute top-3 right-3 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-4 h-4"/>
                            </button>
                            <div className="flex items-baseline gap-2 mb-1 pr-6">
                                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">{word.wordOrPhrase}</h3>
                                <span className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{word.pos}</span>
                            </div>
                            <p className="text-xs font-serif text-indigo-500 mb-4">{word.ipa}</p>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200 mb-4 line-clamp-3">{word.definition}</p>
                            <div className="text-xs text-zinc-500 italic line-clamp-3 border-l-2 border-indigo-200 dark:border-indigo-900/50 pl-2">
                                "{word.usage_in_context}"
                            </div>
                        </div>
                    ))}
                 </div>
              )}
            </section>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto py-12 px-8 sm:px-12">
            {/* Header Controls */}
            <div className="flex justify-between items-center mb-12 pb-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-stone-50/90 dark:bg-zinc-950/90 py-4 z-10 backdrop-blur-sm -mt-4">
               <div className="flex gap-4">
                   <button className="text-sm px-2 py-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">Aa</button>
               </div>
               <div className="flex gap-4 items-center">
                   <span className="text-sm font-medium whitespace-nowrap">Show Translation</span>
                   <button 
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showTranslation ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                      <span className="sr-only">Toggle translation display</span>
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showTranslation ? 'translate-x-[8px]' : 'translate-x-[-8px]'}`} />
                   </button>
               </div>
            </div>

            {/* Article Area */}
            <article className="prose prose-zinc dark:prose-invert prose-lg max-w-none pt-4 pb-32">
              {isLoading && !articleData && (
                 <div className="flex flex-col items-center justify-center mt-32 opacity-50 space-y-4">
                    <PlayCircle className="w-12 h-12 text-indigo-500 animate-pulse" />
                    <h1 className="font-serif text-zinc-400">Tuning in...</h1>
                 </div>
              )}
              
              {!isLoading && !articleData && (
                  <div className="text-center font-serif text-zinc-500 mt-20">
                      <p>Configure settings on the left.</p>
                      <p>Click "Generate" to start your daily English learning session.</p>
                  </div>
              )}

              {articleData && (
                  <>
                    <div className="flex justify-between items-start mb-12">
                       <h1 className="text-3xl md:text-5xl font-bold font-serif text-zinc-900 dark:text-zinc-50 leading-tight flex-1">
                         {articleData.title}
                       </h1>
                       <button 
                         onClick={() => saveArticle(articleData)}
                         className="ml-4 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                         title="Save to Notebook">
                           <BookMarked className="w-5 h-5"/>
                       </button>
                    </div>
                    
                    <InteractiveArticle 
                      paragraphs={articleData.paragraphs}
                      grammarPoints={articleData.grammar_analysis || []}
                      showTranslation={showTranslation}
                      playbackSpeed={playbackSpeed}
                      selectedVoiceUri={selectedVoiceUri}
                      onSelection={handleSelection}
                    />
                  </>
              )}
            </article>
          </div>
        )}
      </main>

      {/* Right Sidebar - Grammar */}
      <aside className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full shrink-0 shadow-sm relative z-10">
         <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="font-semibold flex items-center gap-2">
             <BookOpen className="w-5 h-5 text-indigo-500" />
             Grammar & Dictionary
          </h2>
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-8">
            {isDefining && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">Analyzing term...</span>
                </div>
            )}

            {!isDefining && definitionData && (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden shadow-sm relative">
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <button onClick={() => saveWord(definitionData)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-indigo-500" title="Save word">
                          <BookMarked className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDefinitionData(null)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-500">
                          <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-baseline mb-1 pr-16">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mr-2">{definitionData.wordOrPhrase}</h3>
                            <span className="text-xs font-mono text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">{definitionData.pos}</span>
                        </div>
                        <p className="text-sm font-serif text-indigo-600 dark:text-indigo-400">{definitionData.ipa}</p>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Definition</h4>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200">{definitionData.definition}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">In Context</h4>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{definitionData.usage_in_context}</p>
                        </div>
                    </div>
                </div>
            )}

            {!articleData ? (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 pt-10">
                    Generated grammar points will appear here. Highlight any text to get instant definitions!
                </div>
            ) : (
                <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 pb-2">Article Highlights</h3>
                    {articleData.grammar_analysis?.map((item: any, i: number) => (
                        <div key={i} className="space-y-2">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-indigo-50 dark:bg-indigo-900/30 p-2.5 rounded-md leading-snug border border-indigo-100 dark:border-indigo-800/50">
                                {item.sentence}
                            </p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed pl-2 border-l-2 border-zinc-200 dark:border-zinc-700">
                                {item.explanation}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </aside>

    </div>
  );
}
