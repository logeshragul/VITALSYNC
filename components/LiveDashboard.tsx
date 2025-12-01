import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { HealthDataPoint, HealthAlert } from '../types';
import { Activity, Droplet, Video, VideoOff, SwitchCamera, AlertTriangle, Wifi, Battery, Cpu, CheckCircle2, Mic, MicOff, Zap, FileText, Download, X, HeartPulse, ShieldAlert, Signal, Heart, Volume2 } from 'lucide-react';
import { connectToLiveSession, float32To16BitPCMBase64, base64ToAudioBuffer } from '../services/geminiService';

const MAX_DATA_POINTS = 30;

const LiveDashboard: React.FC = () => {
  const [data, setData] = useState<HealthDataPoint[]>([]);
  const [currentBP, setCurrentBP] = useState({ systolic: 120, diastolic: 80 });
  const [currentSugar, setCurrentSugar] = useState(95);
  const [currentHeartRate, setCurrentHeartRate] = useState(72);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  
  // Refs to access latest state inside intervals/callbacks without dependencies
  const bpRef = useRef({ systolic: 120, diastolic: 80 });
  const sugarRef = useRef(95);
  const hrRef = useRef(72);

  // Camera State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Live API State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // For visualization
  
  // Report State
  const [showReport, setShowReport] = useState(false);

  // Refs for Live API
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null); // LiveSession
  const nextStartTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  // Initialize/Manage Camera
  useEffect(() => {
    const startCamera = async () => {
      if (!isCameraActive) {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        setCameraError(null);
        // Ensure Live session disconnects if camera turns off
        disconnectLive();
        return;
      }

      // Stop existing tracks before switching
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: facingMode,
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          },
          audio: true // Request audio for Live API
        });
        setStream(mediaStream);
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.muted = true; 
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setCameraError("Camera & Microphone access required.");
        setStream(null);
      }
    };

    startCamera();

    return () => {
       disconnectLive();
    };
  }, [isCameraActive, facingMode]);

  // Ensure video element gets stream if it remounts or stream updates
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Live API Logic
  const connectLive = async () => {
    if (!stream || isLiveConnected || isLiveConnecting) return;
    
    setIsLiveConnecting(true);
    try {
      // Setup Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      
      // Connect to Gemini
      const sessionPromise = connectToLiveSession({
        onOpen: () => {
          console.log("Live Session Opened");
          setIsLiveConnected(true);
          setIsLiveConnecting(false);
          nextStartTimeRef.current = ctx.currentTime;
          
          // Start Audio Streaming
          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const source = inputCtx.createMediaStreamSource(stream);
          // Reduced buffer size from 4096 to 2048 to lower latency (~128ms)
          const processor = inputCtx.createScriptProcessor(2048, 1, 1);
          
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Calculate basic volume level for visualization
            let sum = 0;
            for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / inputData.length);
            setAudioLevel(Math.min(100, Math.round(rms * 400)));

            const base64Audio = float32To16BitPCMBase64(inputData);
            sessionPromise.then(session => {
                session.sendRealtimeInput({ 
                    media: { 
                        mimeType: 'audio/pcm;rate=16000', 
                        data: base64Audio 
                    } 
                });
            });
          };

          source.connect(processor);
          processor.connect(inputCtx.destination);
          
          inputSourceRef.current = source;
          processorRef.current = processor;
          sessionRef.current = sessionPromise;
        },
        onMessage: async (msg) => {
           // Handle Audio Output
           const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
           if (base64Audio && ctx) {
               try {
                   const buffer = await base64ToAudioBuffer(base64Audio, ctx);
                   const source = ctx.createBufferSource();
                   source.buffer = buffer;
                   source.connect(ctx.destination);
                   
                   const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
                   source.start(startTime);
                   nextStartTimeRef.current = startTime + buffer.duration;
               } catch (e) {
                   console.error("Error decoding audio", e);
               }
           }
        },
        onClose: () => {
            console.log("Live Session Closed");
            disconnectLive();
        },
        onError: (err) => {
            console.error("Live Session Error", err);
            disconnectLive();
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to connect", e);
      setIsLiveConnecting(false);
    }
  };

  const disconnectLive = () => {
    setIsLiveConnected(false);
    setIsLiveConnecting(false);
    setAudioLevel(0);
    
    // Close Audio Contexts
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    
    // Close Session
    if (sessionRef.current) {
        sessionRef.current.then((s: any) => s.close());
        sessionRef.current = null;
    }
  };

  // Video Frame Streaming Loop with Data Overlay
  useEffect(() => {
      let intervalId: number;
      
      if (isLiveConnected && videoRef.current && sessionRef.current) {
          // Send frames every 500ms
          intervalId = window.setInterval(() => {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              if (!video || !canvas) return;

              // Draw video frame to canvas
              const ctx = canvas.getContext('2d');
              canvas.width = video.videoWidth * 0.5; // Scale down for bandwidth
              canvas.height = video.videoHeight * 0.5;
              
              if (ctx) {
                  // 1. Draw Video
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // 2. Overlay Health Data (Context for AI)
                  // We draw this onto the frame sent to Gemini so it can "read" the vitals
                  ctx.font = "bold 24px Arial";
                  ctx.fillStyle = "white";
                  ctx.shadowColor = "black";
                  ctx.shadowBlur = 4;
                  ctx.lineWidth = 2;
                  
                  const bp = bpRef.current;
                  const sugar = sugarRef.current;
                  const hr = hrRef.current;
                  
                  // Top Left Info
                  ctx.strokeText(`BP: ${bp.systolic}/${bp.diastolic}`, 20, 40);
                  ctx.fillText(`BP: ${bp.systolic}/${bp.diastolic}`, 20, 40);
                  
                  ctx.strokeText(`HR: ${hr} BPM`, 20, 80);
                  ctx.fillText(`HR: ${hr} BPM`, 20, 80);
                  
                  ctx.strokeText(`Sugar: ${sugar} mg/dL`, 20, 120);
                  ctx.fillText(`Sugar: ${sugar} mg/dL`, 20, 120);

                  const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                  
                  // Send frame
                  sessionRef.current.then((session: any) => {
                      session.sendRealtimeInput({
                          media: { mimeType: 'image/jpeg', data: base64Data }
                      });
                  });
              }
          }, 500); 
      }

      return () => clearInterval(intervalId);
  }, [isLiveConnected]);


  // Simulate Live Data & Diagnostics
  useEffect(() => {
    if (!isCameraActive) return;

    const interval = setInterval(() => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Simulate slight fluctuations
      const newSystolic = Math.floor(115 + Math.random() * 20); 
      const newDiastolic = Math.floor(75 + Math.random() * 15);
      const newGlucose = Math.floor(90 + Math.random() * 30);
      const newHeartRate = Math.floor(60 + Math.random() * 30);

      // Update State
      setCurrentBP({ systolic: newSystolic, diastolic: newDiastolic });
      setCurrentSugar(newGlucose);
      setCurrentHeartRate(newHeartRate);

      // Update Refs for Live API Loop
      bpRef.current = { systolic: newSystolic, diastolic: newDiastolic };
      sugarRef.current = newGlucose;
      hrRef.current = newHeartRate;

      setData(prev => {
        const newData = [...prev, {
          timestamp: timeString,
          systolic: newSystolic,
          diastolic: newDiastolic,
          glucose: newGlucose,
          heartRate: newHeartRate
        }];
        return newData.slice(-MAX_DATA_POINTS);
      });

      // Randomly trigger Health Alerts for simulation
      if (Math.random() > 0.85) {
          const diagnostics = [
              { msg: "Detected: Slight Tremor", type: 'warning' },
              { msg: "Detected: Pale Complexion", type: 'info' },
              { msg: "Diagnostic: Pulse Irregularity", type: 'critical' },
              { msg: "Signs of Fatigue", type: 'warning' },
              { msg: "Respiration: Elevated", type: 'info' }
          ];
          const diag = diagnostics[Math.floor(Math.random() * diagnostics.length)];
          const newAlert: HealthAlert = {
              id: Date.now().toString(),
              type: diag.type as any,
              message: diag.msg,
              timestamp: timeString
          };
          setAlerts(prev => [newAlert, ...prev].slice(0, 4)); // Keep last 4
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [isCameraActive]);

  const getBPStatus = (sys: number) => {
    if (sys > 140) return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'High' };
    if (sys > 120) return { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Elevated' };
    return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Normal' };
  };

  const getSugarStatus = (gluc: number) => {
    if (gluc > 140) return { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'High' };
    return { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Optimal' };
  };

  const getHeartRateStatus = (hr: number) => {
    if (hr > 100) return { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Elevated' };
    if (hr < 60) return { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Low' };
    return { color: 'text-rose-400', bg: 'bg-rose-500/20', label: 'Normal' };
  };

  const downloadReport = () => {
    const reportData = {
        sessionDate: new Date().toLocaleDateString(),
        metrics: data,
        alerts: alerts
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VitalSync_Report_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const bpStatus = getBPStatus(currentBP.systolic);
  const sugarStatus = getSugarStatus(currentSugar);
  const heartRateStatus = getHeartRateStatus(currentHeartRate);

  const toggleCamera = () => setIsCameraActive(!isCameraActive);
  const switchCamera = () => setFacingMode(prev => prev === 'user' ? 'environment' : 'user');

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* Controls Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm gap-3 sm:gap-0">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <Activity size={18} className="text-slate-400" /> Real-time Feed
        </h2>
        <div className="flex gap-2 w-full sm:w-auto">
             <button 
                onClick={() => setShowReport(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
                <FileText size={16} /> <span className="hidden sm:inline">Report</span>
            </button>

            <div className="w-px bg-slate-200 mx-1"></div>

             <button
                onClick={isLiveConnected ? disconnectLive : connectLive}
                disabled={!isCameraActive || isLiveConnecting}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
                    isLiveConnected 
                    ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' 
                    : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-sm'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {isLiveConnecting ? <Zap size={16} className="animate-spin" /> : (isLiveConnected ? <MicOff size={16} /> : <Mic size={16} />)}
                <span className="hidden sm:inline">{isLiveConnecting ? 'Connecting...' : (isLiveConnected ? 'End Voice Session' : 'Voice Doctor (Fast)')}</span>
                <span className="sm:hidden">{isLiveConnected ? 'Stop' : 'Voice Doc'}</span>
            </button>

            <button 
                onClick={switchCamera}
                disabled={!isCameraActive}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <SwitchCamera size={16} /> 
            </button>
            <button 
                onClick={toggleCamera}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isCameraActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
            >
                {isCameraActive ? <VideoOff size={16} /> : <Video size={16} />}
            </button>
        </div>
      </div>

      {/* Main HUD Interface */}
      <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-200 group">
        
        {/* Camera Feed */}
        {isCameraActive ? (
            cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                <AlertTriangle size={48} className="mb-4 opacity-50 text-amber-500" />
                <p>{cameraError}</p>
            </div>
            ) : (
            <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className={`w-full h-full object-cover transition-opacity duration-500 ${stream ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            )
        ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                <VideoOff size={48} className="mb-4 opacity-30" />
                <p>Camera is paused</p>
            </div>
        )}

        {/* HUD Overlay */}
        {isCameraActive && !cameraError && (
          <>
            {/* Top Bar with Status Icons */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-red-500 font-mono text-xs uppercase tracking-widest">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    LIVE MONITOR
                </div>
                {isLiveConnected && (
                    <div className="flex items-center gap-2 text-indigo-400 font-mono text-[10px] uppercase tracking-widest animate-fade-in">
                        <Volume2 size={12} className={audioLevel > 10 ? 'animate-pulse' : ''} />
                        Gemini Doctor Active
                    </div>
                )}
              </div>
              
              {/* Status Icons Overlay */}
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 shadow-lg">
                       <Signal size={14} className={isCameraActive ? "text-emerald-400" : "text-slate-500"} />
                       <span className="text-[10px] font-mono font-bold tracking-wider">{isCameraActive ? '12ms' : '--'}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 shadow-lg">
                       <Battery size={14} className="text-amber-400" />
                       <span className="text-[10px] font-mono font-bold tracking-wider">92%</span>
                  </div>
              </div>
            </div>

            {/* Diagnostics Panel (Left Side) */}
            <div className="absolute top-20 left-4 w-64 space-y-2">
                 <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 drop-shadow-md">Live Diagnostics</div>
                 {alerts.map((alert, idx) => (
                     <div key={alert.id} className={`hud-overlay p-2 rounded-lg border-l-2 flex items-center gap-2 animate-fade-in ${
                         alert.type === 'critical' ? 'border-red-500 text-red-100 bg-red-900/40' : 
                         alert.type === 'warning' ? 'border-amber-500 text-amber-100 bg-amber-900/40' : 'border-blue-400 text-blue-100 bg-blue-900/40'
                     }`}>
                         {alert.type === 'critical' && <ShieldAlert size={14} className="text-red-500" />}
                         {alert.type === 'warning' && <AlertTriangle size={14} className="text-amber-500" />}
                         {alert.type === 'info' && <Activity size={14} className="text-blue-400" />}
                         <div>
                             <p className="text-xs font-medium leading-tight">{alert.message}</p>
                             <p className="text-[9px] opacity-70 font-mono">{alert.timestamp}</p>
                         </div>
                     </div>
                 ))}
                 {alerts.length === 0 && (
                     <div className="hud-overlay p-2 rounded-lg border-l-2 border-emerald-500 text-emerald-100 flex items-center gap-2 bg-emerald-900/30">
                         <CheckCircle2 size={14} className="text-emerald-500" />
                         <span className="text-xs">No visible anomalies detected</span>
                     </div>
                 )}
            </div>

            {/* Unified Bottom Metrics Overlay */}
            <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-4 flex items-center justify-between relative overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    
                     {/* BP Section */}
                    <div className="flex items-center gap-4 flex-1 justify-center border-r border-white/10">
                        <div className={`p-2.5 rounded-full ${bpStatus.bg} bg-opacity-20`}>
                            <Activity size={24} className={bpStatus.color} />
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Blood Pressure</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-mono font-bold text-white tracking-tighter drop-shadow-sm">{currentBP.systolic}</span>
                                <span className="text-xl text-slate-500 font-mono">/</span>
                                <span className="text-3xl font-mono font-bold text-white tracking-tighter drop-shadow-sm">{currentBP.diastolic}</span>
                                <span className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${bpStatus.color} bg-white/5 border border-white/5`}>{bpStatus.label}</span>
                            </div>
                        </div>
                    </div>

                    {/* Heart Rate Section */}
                    <div className="flex items-center gap-4 flex-1 justify-center border-r border-white/10">
                        <div className={`p-2.5 rounded-full ${heartRateStatus.bg} bg-opacity-20`}>
                            <Heart size={24} className={`${heartRateStatus.color} animate-pulse`} fill="currentColor" fillOpacity={0.2} />
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Heart Rate</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-mono font-bold text-white tracking-tighter drop-shadow-sm">{currentHeartRate}</span>
                                <span className="text-xs text-slate-400 font-medium">BPM</span>
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${heartRateStatus.color} bg-white/5 border border-white/5`}>{heartRateStatus.label}</span>
                            </div>
                        </div>
                    </div>

                    {/* Glucose Section */}
                    <div className="flex items-center gap-4 flex-1 justify-center">
                         <div className={`p-2.5 rounded-full ${sugarStatus.bg} bg-opacity-20`}>
                            <Droplet size={24} className={sugarStatus.color} />
                        </div>
                         <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Glucose Level</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-mono font-bold text-white tracking-tighter drop-shadow-sm">{currentSugar}</span>
                                <span className="text-xs text-slate-400 font-medium">mg/dL</span>
                                 <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${sugarStatus.color} bg-white/5 border border-white/5`}>{sugarStatus.label}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Status Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isCameraActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                 <Wifi size={18} />
              </div>
              <div>
                 <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">System Status</div>
                 <div className={`text-sm font-semibold ${isCameraActive ? 'text-slate-800' : 'text-slate-400'}`}>
                    {isCameraActive ? 'Calibrated' : 'Standby'}
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
             <div className={`p-2 rounded-lg ${isLiveConnected ? 'bg-purple-50 text-purple-600' : (isCameraActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400')}`}>
                <Cpu size={18} />
             </div>
             <div className="flex-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">AI Doctor</div>
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                   {isLiveConnected ? (
                       <div className="flex items-center gap-2 w-full">
                           <span className="truncate">Listening</span>
                           <div className="flex items-end gap-0.5 h-4">
                               <div className="w-1 bg-purple-500 rounded-full animate-bounce" style={{height: `${Math.max(20, audioLevel)}%`, animationDuration: '0.4s'}}></div>
                               <div className="w-1 bg-purple-500 rounded-full animate-bounce" style={{height: `${Math.max(30, audioLevel * 0.8)}%`, animationDuration: '0.5s'}}></div>
                               <div className="w-1 bg-purple-500 rounded-full animate-bounce" style={{height: `${Math.max(20, audioLevel * 0.5)}%`, animationDuration: '0.3s'}}></div>
                           </div>
                       </div>
                   ) : (
                       isCameraActive ? <>Scanning <CheckCircle2 size={14} className="text-indigo-500" /></> : <span className="text-slate-400">Idle</span>
                   )}
                </div>
             </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
             <div className="bg-amber-50 p-2 rounded-lg text-amber-500">
                <Battery size={18} />
             </div>
             <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                   <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Device Power</div>
                   <div className="text-xs font-bold text-slate-800">92%</div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-100">
                   <div className="bg-amber-500 h-full w-[92%] rounded-full"></div>
                </div>
             </div>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity size={16} className="text-slate-400" /> 
            Live Telemetry History {isCameraActive ? <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse ml-2"/> : <span className="text-xs font-normal text-slate-400 ml-2">(Paused)</span>}
        </h3>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="bp" domain={[60, 160]} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="sugar" orientation="right" domain={[70, 150]} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#0f172a' }} itemStyle={{ fontSize: '12px' }} labelStyle={{ color: '#64748b', fontSize: '10px' }} />
              <Line yAxisId="bp" type="step" dataKey="systolic" stroke={isCameraActive ? "#ef4444" : "#cbd5e1"} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#ef4444' }} isAnimationActive={false} />
              <Line yAxisId="bp" type="monotone" dataKey="heartRate" stroke={isCameraActive ? "#fb7185" : "#cbd5e1"} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4, fill: '#fb7185' }} isAnimationActive={false} />
              <Line yAxisId="sugar" type="monotone" dataKey="glucose" stroke={isCameraActive ? "#3b82f6" : "#cbd5e1"} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Colorful Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
              {/* Report Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white relative">
                 <button onClick={() => setShowReport(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors text-white">
                    <X size={20} />
                 </button>
                 <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><HeartPulse size={24} /></div>
                    <span className="text-sm font-medium opacity-90 uppercase tracking-widest">Medical Telemetry</span>
                 </div>
                 <h2 className="text-3xl font-bold mb-1">Session Report</h2>
                 <p className="opacity-80">Generated on {new Date().toLocaleString()}</p>
              </div>

              {/* Report Content */}
              <div className="p-8 space-y-8">
                 
                 {/* Key Stats Cards */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                        <p className="text-red-600 text-xs font-bold uppercase tracking-wider mb-2">Avg Systolic BP</p>
                        <p className="text-4xl font-bold text-slate-800">{data.length > 0 ? Math.round(data.reduce((a, b) => a + b.systolic, 0) / data.length) : '--'}</p>
                        <p className="text-sm text-slate-500 mt-1">Target: &lt;120</p>
                    </div>
                    <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
                        <p className="text-rose-600 text-xs font-bold uppercase tracking-wider mb-2">Avg Heart Rate</p>
                        <p className="text-4xl font-bold text-slate-800">{data.length > 0 ? Math.round(data.reduce((a, b) => a + b.heartRate, 0) / data.length) : '--'}</p>
                        <p className="text-sm text-slate-500 mt-1">BPM</p>
                    </div>
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                        <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">Avg Glucose</p>
                        <p className="text-4xl font-bold text-slate-800">{data.length > 0 ? Math.round(data.reduce((a, b) => a + b.glucose, 0) / data.length) : '--'}</p>
                        <p className="text-sm text-slate-500 mt-1">mg/dL</p>
                    </div>
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                        <p className="text-amber-600 text-xs font-bold uppercase tracking-wider mb-2">Anomalies</p>
                        <p className="text-4xl font-bold text-slate-800">{alerts.length}</p>
                        <p className="text-sm text-slate-500 mt-1">Alerts</p>
                    </div>
                 </div>

                 {/* Detailed Graph */}
                 <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6">Detailed Vitals Timeline</h3>
                    <div className="h-[300px] w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={data}>
                            <defs>
                              <linearGradient id="colorBp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorSugar" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="timestamp" />
                            <YAxis orientation="left" domain={[50, 180]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="systolic" stroke="#ef4444" fillOpacity={1} fill="url(#colorBp)" strokeWidth={3} />
                            <Area type="monotone" dataKey="heartRate" stroke="#fb7185" fillOpacity={1} fill="url(#colorHr)" strokeWidth={3} strokeDasharray="4 4" />
                            <Area type="monotone" dataKey="glucose" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSugar)" strokeWidth={3} />
                         </AreaChart>
                       </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Action Bar */}
                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button onClick={() => setShowReport(false)} className="px-6 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        Close View
                    </button>
                    <button onClick={downloadReport} className="px-6 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-900/20">
                        <Download size={20} /> Download Data (JSON)
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default LiveDashboard;