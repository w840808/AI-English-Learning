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

    setPlayingParaIndex(paraIdx);
    setCurrentWordIndex(0);

    if (isCloud) {
       setIsCloudLoading(true);
       try {
         const voiceName = selectedVoiceUri?.replace("cloud:", "");
         const res = await fetch("/api/tts", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ text, voice: voiceName })
         });
         
         const responseData = await res.json();
         if (!res.ok) throw new Error(responseData.error || "Cloud TTS 請求失敗");
         
         const { audioContent } = responseData;
         if (!audioContent) throw new Error("No audio content");

         const binaryString = atob(audioContent);
         const bytes = new Uint8Array(binaryString.length);
         for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
         }
         
         const audioBlob = new Blob([bytes], { type: "audio/mp3" });
         const audioUrl = URL.createObjectURL(audioBlob);
         const audio = new Audio(audioUrl);
         audioRef.current = audio;
         audio.playbackRate = playbackSpeed;

         // Estimated word highlighting for Cloud TTS
         const tokens = text.split(/(\s+)/);
         audio.ontimeupdate = () => {
           if (!audio.duration) return;
           const progress = audio.currentTime / audio.duration;
           const targetTokenIndex = Math.floor(progress * tokens.length);
           if (targetTokenIndex !== currentWordIndex) {
             setCurrentWordIndex(targetTokenIndex);
           }
         };
         
         audio.onended = () => {
            stopPlaying();
            URL.revokeObjectURL(audioUrl);
         };
         
         audio.onerror = () => stopPlaying();
         
         await audio.play();
         setIsCloudLoading(false);
       } catch (err) {
         console.error("Cloud TTS Error:", err);
         setIsCloudLoading(false);
         setPlayingParaIndex(null);
       }
       return;
    }

    // --- Local Web Speech API Fallback ---
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    let enVoice = voices.find(v => v.voiceURI === selectedVoiceUri);
    
    if (!enVoice) {
      enVoice = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    }
                 
    if (enVoice) utterance.voice = enVoice;
    utterance.rate = playbackSpeed;

    const tokens = text.split(/(\s+)/);
    let charCounts: number[] = [];
    let currentLength = 0;
    tokens.forEach(w => {
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

  // Helper to render text with grammar tooltips AND sync highlights
  const renderAnnotatedText = (text: string, paraIdx: number) => {
    // 1. Split text into words and non-word characters for exact mapping
    // We use a regex that captures words vs non-words to maintain indices
    const tokens: string[] = text.split(/(\s+)/);
    
    // Calculate character offsets for each token
    let offset = 0;
    const tokenOffsets = tokens.map(t => {
      const start = offset;
      offset += t.length;
      return { start, end: offset };
    });

    const isPlayingPara = playingParaIndex === paraIdx;

    // First, identify which parts are grammar points
    let segments: { text: string; grammarIdx: number | null; start: number; end: number }[] = [{ text, grammarIdx: null, start: 0, end: text.length }];

    grammarPoints.forEach((point, gIdx) => {
      const newSegments: typeof segments = [];
      segments.forEach(seg => {
        if (seg.grammarIdx === null && seg.text.includes(point.sentence)) {
          const parts = seg.text.split(point.sentence);
          let currentSegOffset = seg.start;
          for (let i = 0; i < parts.length; i++) {
            // Even if parts[i] is empty, we must add it to maintain segment boundaries
            newSegments.push({ text: parts[i], grammarIdx: null, start: currentSegOffset, end: currentSegOffset + parts[i].length });
            currentSegOffset += parts[i].length;
            
            if (i < parts.length - 1) {
              newSegments.push({ text: point.sentence, grammarIdx: gIdx, start: currentSegOffset, end: currentSegOffset + point.sentence.length });
              currentSegOffset += point.sentence.length;
            }
          }
        } else {
          newSegments.push(seg);
        }
      });
      segments = newSegments;
    });

    // Now render each segment, and within each segment, render tokens if we are playing
    return segments.map((seg, sIdx) => {
      const content = tokens.map((token, tIdx) => {
        const tOffset = tokenOffsets[tIdx];
        // If token is within this segment
        if (tOffset.start >= seg.start && tOffset.end <= seg.end) {
          const isHighlighted = isPlayingPara && currentWordIndex === tIdx;
          return (
            <span 
              key={`tok-${tIdx}`} 
              className={`${isHighlighted ? "bg-yellow-200 dark:bg-yellow-900/60 rounded px-0.5 transition-colors duration-150" : ""} selection:bg-indigo-300 dark:selection:bg-indigo-800`}
            >
              {token}
            </span>
          );
        }
        return null;
      }).filter(Boolean);

      if (seg.grammarIdx !== null) {
        const point = grammarPoints[seg.grammarIdx];
        return (
          <Tooltip.Provider key={`seg-${sIdx}`}>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger asChild>
                <span className="underline decoration-indigo-400 decoration-dotted decoration-2 cursor-help text-indigo-900 dark:text-indigo-300">
                  {content}
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content 
                  className="max-w-xs bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-sm p-3 rounded shadow-lg z-50 font-sans bounce-in" 
                  sideOffset={5}>
                  {point.explanation}
                  <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        );
      }

      return <span key={`seg-${sIdx}`}>{content}</span>;
    });
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
            <div 
              onMouseUp={() => {
                const selection = window.getSelection();
                if (selection && selection.toString().trim()) {
                   onSelection?.(selection.toString().trim());
                }
              }}
              className={`font-serif text-zinc-900 dark:text-zinc-100 leading-relaxed text-base md:text-lg`}
            >
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
