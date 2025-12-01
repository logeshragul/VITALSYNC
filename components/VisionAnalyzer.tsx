import React, { useState } from 'react';
import { Upload, Camera, FileText, CheckCircle2, Loader2, ScanEye } from 'lucide-react';
import { analyzeHealthImage } from '../services/geminiService';

const VisionAnalyzer: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("Analyze this image for sugar content and health impact.");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setAnalysis(null); // Reset analysis on new image
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;

    setLoading(true);
    // Remove Data URL prefix for API
    const base64Data = image.split(',')[1];
    
    try {
      const result = await analyzeHealthImage(base64Data, prompt);
      setAnalysis(result);
    } catch (error) {
      setAnalysis("Failed to analyze image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
            <ScanEye size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Vision Lab</h2>
            <p className="text-sm text-slate-500">Upload meal photos or medical reports for analysis</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {image ? (
                <div className="relative h-64 w-full rounded-lg overflow-hidden">
                   <img src={image} alt="Preview" className="w-full h-full object-contain" />
                   <button 
                     onClick={(e) => {
                       e.preventDefault();
                       setImage(null);
                       setAnalysis(null);
                     }}
                     className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                   >
                     <Upload size={16} className="rotate-45" /> 
                   </button>
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center text-slate-400">
                  <Camera size={48} className="mb-4 text-slate-300" />
                  <p className="font-medium text-slate-600">Tap to upload or take a photo</p>
                  <p className="text-sm mt-1">Supports JPG, PNG</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">What should I look for?</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none resize-none h-24"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!image || loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <ScanEye size={18} /> Analyze with Gemini
                </>
              )}
            </button>
          </div>

          {/* Results Section */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 h-full min-h-[300px]">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-slate-400" /> Analysis Results
            </h3>
            
            {analysis ? (
              <div className="prose prose-sm prose-slate max-w-none animate-fade-in">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {analysis}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-medium bg-green-50 w-fit px-3 py-1 rounded-full">
                  <CheckCircle2 size={14} /> Processed by gemini-3-pro-preview
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                 {loading ? (
                   <div className="space-y-3">
                     <Loader2 size={32} className="animate-spin text-blue-400 mx-auto" />
                     <p>Interpreting visual data...</p>
                   </div>
                 ) : (
                   <>
                     <ScanEye size={32} className="mb-2 opacity-20" />
                     <p>Upload an image and hit analyze to see results here.</p>
                   </>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionAnalyzer;
