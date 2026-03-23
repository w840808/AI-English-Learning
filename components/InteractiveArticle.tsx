"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Loader2 } from "lucide-react";

interface GrammarPoint {
  sentence: string;
  explanation: string;
}

interface ParagraphData {
  english: string;
  chinese: string;
}

interface InteractiveArticleProps {
  paragraphs: ParagraphData[];
  grammarPoints: GrammarPoint[];
  showTranslation: boolean;
  playbackSpeed?: number;
  selectedVoiceUri?: string;
  onSelection?: (text: string) => void;
}

export default function InteractiveArticle({
  paragraphs,
  grammarPoints,
  showTranslation,
  playbackSpeed = 1,
  selectedVoiceUri,
  onSelection
}: InteractiveArticleProps) {
  const articleRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingParaIndex, setPlayingParaIndex] = useState<number | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  // Handle Text Selection
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        if (onSelection) {
          onSelection(selection.toString().trim());
        }
      }
    };
    
    // warm up voices so they are loaded when needed
    window.speechSynthesis.getVoices();

    const node = articleRef.current;
    if (node) {
      node.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      if (node) node.removeEventListener("mouseup", handleMouseUp);
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [onSelection]);

  // TTS Read-along Function
  const playParagraph = async (text: string, paraIdx: number) => {
    // 1. Stop any currently playing
    stopPlaying();
    
    // 2. Determine if it's Cloud or Local
    const isCloud = selectedVoiceUri?.startsWith("cloud:");

    if (isCloud) {
       setIsCloudLoading(true);
       setPlayingParaIndex(paraIdx);
       try {
         const voiceName = selectedVoiceUri?.replace("cloud:", "");
         const res = await fetch("/api/tts", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ text, voice: voiceName })
         });
         
         const responseData = await res.json();
         
         if (!res.ok) {
           throw new Error(responseData.error || responseData.details?.error?.message || "Cloud TTS API 請求失敗");
         }
         
         const { audioContent } = responseData;
         
         if (!audioContent) throw new Error("No audio content received from API");

         console.log("Audio content received, creating blob...");
         const binaryString = atob(audioContent);
         const bytes = new Uint8Array(binaryString.length);
         for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
         }
         
         const audioBlob = new Blob([bytes], { type: "audio/mp3" });
         const audioUrl = URL.createObjectURL(audioBlob);
         
         console.log("Audio URL created, starting playback...");
         const audio = new Audio(audioUrl);
         audioRef.current = audio;
         audio.playbackRate = playbackSpeed;
         
         audio.onended = () => {
            stopPlaying();
            URL.revokeObjectURL(audioUrl);
         };
         
         audio.onerror = (e) => {
            console.error("Audio Playback Error:", e);
            stopPlaying();
         };
         
         await audio.play();
         setIsCloudLoading(false);
       } catch (err: any) {
         console.error("Cloud TTS Playback Error:", err);
         setIsCloudLoading(false);
         setPlayingParaIndex(null);
       }
       return;
    }

    // --- Local Web Speech API Fallback ---
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    let enVoice;
    
    if (selectedVoiceUri) {
       enVoice = voices.find(v => v.voiceURI === selectedVoiceUri);
    }
    
    if (!enVoice) {
      enVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Online')) && v.lang.startsWith('en'))
             || voices.find(v => v.lang.startsWith('en-US')) 
             || voices.find(v => v.lang.startsWith('en'));
    }
                 
    if (enVoice) utterance.voice = enVoice;
    
    utterance.pitch = 1.1; 
    utterance.lang = "en-US";
    utterance.rate = playbackSpeed;

    setPlayingParaIndex(paraIdx);
    setCurrentWordIndex(0);

    let words = text.split(/(\s+)/);
    let charCounts: number[] = [];
    let currentLength = 0;
    words.forEach(w => {
      charCounts.push(currentLength);
      currentLength += w.length;
    });

    utterance.onboundary = (event) => {
      if (event.name === "word") {
        const wIdx = charCounts.findIndex(c => c >= event.charIndex);
        if (wIdx !== -1) setCurrentWordIndex(wIdx);
      }
    };

    utterance.onend = () => stopPlaying();
    utterance.onerror = () => stopPlaying();

    window.speechSynthesis.speak(utterance);
  };

  const stopPlaying = () => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingParaIndex(null);
    setCurrentWordIndex(null);
    setIsCloudLoading(false);
  };

  // Helper to render text with grammar tooltips
  const renderAnnotatedText = (text: string, paraIdx: number) => {
    let result: React.ReactNode[] = [text];

    grammarPoints.forEach((point, pointIdx) => {
      let newResult: React.ReactNode[] = [];
      result.forEach((chunk, chunkIdx) => {
        if (typeof chunk === "string") {
          const parts = chunk.split(point.sentence);
          for (let i = 0; i < parts.length; i++) {
            newResult.push(parts[i]);
            if (i < parts.length - 1) {
              newResult.push(
                <Tooltip.Provider key={`tooltip-${pointIdx}-${i}`}>
                  <Tooltip.Root delayDuration={200}>
                    <Tooltip.Trigger asChild>
                      <span className="underline decoration-indigo-400 decoration-dotted decoration-2 cursor-help text-indigo-900 dark:text-indigo-300">
                        {point.sentence}
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content 
                        className="max-w-xs bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-sm p-3 rounded shadow-lg z-50 font-sans" 
                        sideOffset={5}>
                        {point.explanation}
                        <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              );
            }
          }
        } else {
          newResult.push(chunk);
        }
      });
      result = newResult;
    });

    // If this paragraph is playing, we ignore grammar tooltip injection and just render words
    // to avoid complex DOM conflicts with TTS highlighting for now. 
    // In a fully robust version, we'd merge them.
    if (playingParaIndex === paraIdx) {
      const tokens = text.split(/(\\s+)/);
      return tokens.map((token, idx) => (
        <span key={idx} className={currentWordIndex === idx ? "bg-yellow-200 dark:bg-yellow-900/50 rounded" : ""}>
          {token}
        </span>
      ));
    }

    return result;
  };

  return (
    <div ref={articleRef} className="space-y-8">
      {paragraphs.map((para, idx) => {
        if (!para.english.trim()) return null;
        
        const isPlaying = playingParaIndex === idx;

        return (
          <div key={idx} className={`grid ${showTranslation ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto'} gap-6 md:gap-8 group relative`}>
             
            {/* Play Button - responsive positioning */}
            <div className="absolute -left-12 lg:-left-10 top-1 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                disabled={isCloudLoading && isPlaying}
                onClick={() => isPlaying ? stopPlaying() : playParagraph(para.english, idx)}
                className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50">
                {isCloudLoading && isPlaying ? (
                   <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                ) : isPlaying ? (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
            </div>

            {/* Mobile Play Button - shown inline */}
            <div className="lg:hidden flex items-center gap-2 mb-1">
               <button 
                disabled={isCloudLoading && isPlaying}
                onClick={() => isPlaying ? stopPlaying() : playParagraph(para.english, idx)}
                className="flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 disabled:opacity-50">
                {isCloudLoading && isPlaying ? (
                   <><Loader2 className="w-3 h-3 animate-spin" /> Preparing...</>
                ) : isPlaying ? (
                   <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop</>
                ) : (
                   <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Listen</>
                )}
              </button>
            </div>

            {/* English Side */}
            <div className={`font-serif text-zinc-900 dark:text-zinc-100 leading-relaxed text-base md:text-lg`}>
              {renderAnnotatedText(para.english, idx)}
            </div>

            {/* Chinese Side */}
            {showTranslation && (
              <div className="font-serif text-zinc-500 dark:text-zinc-400 leading-relaxed text-[0.9em] md:text-[0.95em] border-l-2 border-indigo-100 dark:border-indigo-900/50 pl-4 md:pl-6 flex items-center">
                  {para.chinese}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
