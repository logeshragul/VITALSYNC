import React, { useState } from 'react';
import { Image as ImageIcon, Wand2, Download, Loader2 } from 'lucide-react';
import { generateRelaxationImage } from '../services/geminiService';
import { AspectRatio } from '../types';

const AspectRatios: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];

const RelaxationZone: React.FC = () => {
  const [prompt, setPrompt] = useState("A peaceful zen garden with flowing water and cherry blossoms, soft lighting, photorealistic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedImage(null); // Clear previous
    try {
      const imgUrl = await generateRelaxationImage(prompt, aspectRatio);
      setGeneratedImage(imgUrl);
    } catch (error) {
      console.error("Failed to generate", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
            <ImageIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Relaxation Zone</h2>
            <p className="text-sm text-slate-500">Generate calming visuals to help lower stress and blood pressure</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Visual Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-400 outline-none resize-none h-32"
                placeholder="Describe a peaceful scene..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Aspect Ratio</label>
              <div className="grid grid-cols-4 gap-2">
                {AspectRatios.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-2 py-2 text-xs font-medium rounded-lg border transition-all ${
                      aspectRatio === ratio
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="w-full bg-teal-600 text-white py-3 rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Wand2 size={18} /> Generate Scene
                </>
              )}
            </button>
          </div>

          {/* Canvas */}
          <div className="lg:col-span-2 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden min-h-[400px] border border-slate-200 relative">
             {loading ? (
               <div className="text-center">
                 <Loader2 size={40} className="animate-spin text-teal-500 mx-auto mb-4" />
                 <p className="text-slate-500 font-medium">Gemini is painting your scene...</p>
                 <p className="text-xs text-slate-400 mt-2">Model: gemini-3-pro-image-preview</p>
               </div>
             ) : generatedImage ? (
               <div className="relative w-full h-full flex items-center justify-center p-4">
                 <img 
                   src={generatedImage} 
                   alt="Generated relaxation scene" 
                   className="max-w-full max-h-full rounded-lg shadow-lg object-contain"
                 />
                 <a 
                   href={generatedImage} 
                   download="relaxation-scene.png"
                   className="absolute bottom-6 right-6 bg-white/90 backdrop-blur text-slate-800 p-2 rounded-full shadow-lg hover:bg-white transition-all"
                   title="Download"
                 >
                   <Download size={20} />
                 </a>
               </div>
             ) : (
               <div className="text-center text-slate-400 p-8">
                 <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
                 <p>Your generated image will appear here.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelaxationZone;