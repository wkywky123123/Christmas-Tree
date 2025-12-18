
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AppState } from '../types';

interface MagicWorkshopProps {
  photos: string[];
  setPhotos: (photos: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const MagicWorkshop: React.FC<MagicWorkshopProps> = ({ photos, setPhotos, isOpen, onClose }) => {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Helper: Convert File/Blob to Base64
  const toBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 1. Generate new image from prompt
  const handleGenerate = async () => {
    if (!prompt) return;
    setIsProcessing(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A beautiful festive Christmas themed photo of: ${prompt}. High quality, cinematic lighting, 4k.` }]
        },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });

      const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const newUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
        setPhotos([...photos, newUrl]);
        setPrompt("");
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("魔法施放失败，请稍后再试。");
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Edit existing image with AI
  const handleEdit = async (index: number) => {
    const editPrompt = window.prompt("你想如何改造这张照片？(例如: 加上雪花和圣诞帽)");
    if (!editPrompt) return;

    setIsProcessing(true);
    setEditingIndex(index);
    try {
      // Fetch the image data
      const responseImg = await fetch(photos[index]);
      const blob = await responseImg.blob();
      const base64Data = (await toBase64(blob)).split(',')[1];

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: blob.type } },
            { text: `Add magic Christmas elements to this image based on: ${editPrompt}. Keep the main subject recognizable but make it festive.` }
          ]
        }
      });

      const imagePart = result.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const newUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
        const newPhotos = [...photos];
        newPhotos[index] = newUrl;
        setPhotos(newPhotos);
      }
    } catch (error) {
      console.error("AI Edit Error:", error);
      alert("变换失败。");
    } finally {
      setIsProcessing(false);
      setEditingIndex(null);
    }
  };

  // 3. Simple upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await toBase64(file);
      setPhotos([...photos, url]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  return (
    <div className={`fixed right-0 top-0 h-full w-80 bg-black/80 backdrop-blur-2xl border-l border-amber-500/20 z-[60] transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full shadow-none'}`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-serif text-amber-400 tracking-widest">魔法工坊</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
        </div>

        {/* AI Generation Box */}
        <div className="mb-8 p-4 border border-amber-500/10 bg-amber-500/5 rounded-sm">
          <p className="text-[10px] text-amber-500/60 uppercase tracking-widest mb-3">AI 创造照片</p>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想要的节日画面..."
            className="w-full h-20 bg-black/50 border border-white/10 rounded-none p-2 text-xs focus:border-amber-500/50 outline-none transition-all placeholder:text-gray-700"
          />
          <button 
            disabled={isProcessing || !prompt}
            onClick={handleGenerate}
            className="w-full mt-2 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 disabled:text-gray-600 text-black text-[10px] font-bold tracking-widest uppercase transition-all"
          >
            {isProcessing ? "魔法编织中..." : "施法生成"}
          </button>
        </div>

        {/* Gallery */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
           <p className="text-[10px] text-gray-500 uppercase tracking-widest flex justify-between">
            <span>记忆画廊 ({photos.length})</span>
            <button onClick={() => fileInputRef.current?.click()} className="text-amber-500 hover:text-amber-400">+ 上传</button>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleUpload} />
           </p>
           
           <div className="grid grid-cols-2 gap-2">
             {photos.map((src, i) => (
               <div key={i} className="group relative aspect-square bg-gray-900 border border-white/5 overflow-hidden">
                  <img src={src} className="w-full h-full object-cover" alt="Memory" />
                  
                  {/* Processing Overlay */}
                  {isProcessing && editingIndex === i && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                       <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Hover Controls */}
                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <button 
                      onClick={() => handleEdit(i)}
                      className="text-[9px] bg-amber-500 text-black px-2 py-1 rounded-none font-bold hover:bg-amber-400"
                    >
                      魔法变换
                    </button>
                    <button 
                      onClick={() => removePhoto(i)}
                      className="text-[9px] text-red-500 hover:text-red-400 font-bold"
                    >
                      删除
                    </button>
                  </div>
               </div>
             ))}
           </div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/5">
           <p className="text-[9px] text-gray-600 italic leading-relaxed">
             * AI 修改会基于原始图像的构图进行节日化增强。
           </p>
        </div>
      </div>
    </div>
  );
};
