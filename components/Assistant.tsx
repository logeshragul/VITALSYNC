import React, { useState, useRef, useEffect } from 'react';
import { Send, Zap, BrainCircuit, User, Bot, Loader2 } from 'lucide-react';
import { getFastHealthAdvice, getDeepThinkingAnalysis } from '../services/geminiService';
import { ChatMessage } from '../types';

const Assistant: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Hello! I can help you monitor your vitals. Ask me quick questions or use "Thinking Mode" for deep health analysis.' }
  ]);
  const [loading, setLoading] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let responseText = '';
      if (thinkingMode) {
        responseText = await getDeepThinkingAnalysis(userMsg.text);
      } else {
        responseText = await getFastHealthAdvice(userMsg.text);
      }

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        isThinking: thinkingMode
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Chat Header / Mode Toggle */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {thinkingMode ? <BrainCircuit className="text-purple-600" /> : <Zap className="text-amber-500" />}
          <div>
            <h3 className="font-semibold text-slate-800">{thinkingMode ? 'Deep Analysis' : 'Fast Assistant'}</h3>
            <p className="text-xs text-slate-500">
              {thinkingMode ? 'Gemini 3 Pro (Thinking Budget 32k)' : 'Gemini 2.5 Flash Lite'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-full border border-slate-200">
          <button
            onClick={() => setThinkingMode(false)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!thinkingMode ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Fast
          </button>
          <button
            onClick={() => setThinkingMode(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${thinkingMode ? 'bg-purple-100 text-purple-800 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Thinking
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-900 text-white' : (msg.isThinking ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600')}`}>
                {msg.role === 'user' ? <User size={14} /> : (msg.isThinking ? <BrainCircuit size={14} /> : <Bot size={14} />)}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
             <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 animate-pulse">
                   <Loader2 size={14} className="animate-spin text-slate-400" />
                </div>
                <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  </div>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={thinkingMode ? "Ask a complex question about your health trends..." : "Ask a quick question..."}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
