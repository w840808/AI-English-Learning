"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

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
  const [playingParaIndex, setPlayingParaIndex] = useState<number | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);

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
    };
  }, [onSelection]);

  // TTS Read-along Function
  const playParagraph = (text: string, paraIdx: number) => {
    window.speechSynthesis.cancel(); // Stop current playing
    
    // We roughly tokenize text by words for highlighting map
    // TTS onboundary gives charIndex, we will map it to word index
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to select a better Google or native English voice
    const voices = window.speechSynthesis.getVoices();
    
    let enVoice;
    if (selectedVoiceUri) {
       enVoice = voices.find(v => v.voiceURI === selectedVoiceUri);
    }
    
    if (!enVoice) {
      // Fallback prioritized list
      enVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Online')) && v.lang.startsWith('en'))
             || voices.find(v => v.lang.startsWith('en-US')) 
             || voices.find(v => v.lang.startsWith('en'));
    }
                 
    if (enVoice) {
      utterance.voice = enVoice;
    }
    
    // Slight tuning to pitch and rate can make default voices sound slightly more natural
    utterance.pitch = 1.1; 
    utterance.lang = "en-US";
    utterance.rate = playbackSpeed;
    utterance.volume = 1;

    setPlayingParaIndex(paraIdx);
    setCurrentWordIndex(0);

    let words = text.split(/(\\s+)/); // split by keeping whitespaces so we can render them properly
    // To map char index to word piece index:
    let charCounts: number[] = [];
    let currentLength = 0;
    words.forEach(w => {
      charCounts.push(currentLength);
      currentLength += w.length;
    });

    utterance.onboundary = (event) => {
      if (event.name === "word") {
        // find which word index this charIndex falls into
        const wIdx = charCounts.findIndex(c => c >= event.charIndex);
        if (wIdx !== -1) {
            // Check if we hit whitespace, push index forward if needed
            setCurrentWordIndex(wIdx);
        }
      }
    };

    utterance.onend = () => {
      setPlayingParaIndex(null);
      setCurrentWordIndex(null);
    };
    
    utterance.onerror = (e) => {
      console.warn("Speech Synthesis Error:", e);
      setPlayingParaIndex(null);
      setCurrentWordIndex(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopPlaying = () => {
    window.speechSynthesis.cancel();
    setPlayingParaIndex(null);
    setCurrentWordIndex(null);
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
          <div key={idx} className={`grid ${showTranslation ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto'} gap-8 group relative`}>
             
            {/* Play Button - shown on hover next to paragraph */}
            <div className="absolute -left-10 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => isPlaying ? stopPlaying() : playParagraph(para.english, idx)}
                className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400">
                {isPlaying ? (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
            </div>

            {/* English Side */}
            <div className={`font-serif text-zinc-900 dark:text-zinc-100 leading-relaxed text-lg ${isPlaying ? '' : ''}`}>
              {renderAnnotatedText(para.english, idx)}
            </div>

            {/* Chinese Side */}
            {showTranslation && (
              <div className="font-serif text-zinc-500 dark:text-zinc-400 leading-relaxed text-[0.95em] border-l-2 border-indigo-100 dark:border-indigo-900/50 pl-6 flex items-center">
                  {para.chinese}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
