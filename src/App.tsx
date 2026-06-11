import React, { useState, useEffect, useRef } from "react";
import { 
  FileVideo, 
  Upload, 
  Settings, 
  CheckCircle, 
  Languages, 
  Terminal, 
  Clock, 
  Video, 
  AlertCircle, 
  Play, 
  RotateCcw, 
  Sparkles,
  ExternalLink,
  Cpu,
  BookmarkCheck,
  FileCheck2
} from "lucide-react";

interface JobLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface JobState {
  jobId: string;
  stage: "idle" | "uploading" | "gemini_translating" | "heygen_processing" | "rendering" | "completed" | "failed";
  progress: number;
  statusText: string;
  translatedScript?: string;
  videoUrl?: string;
  languageLabel: string;
  originalFilename: string;
  publicOriginalUrl: string;
  error?: string;
  logs: JobLog[];
}

export default function App() {
  // Main states
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("tamil");
  
  // Pipeline tracking
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // System credentials diagnostics
  const [config, setConfig] = useState<{ hasGemini: boolean; hasHeyGen: boolean; appUrl: string } | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<any>(null);

  // Fetch API diagnostics on mount
  useEffect(() => {
    fetch("/api/config-check")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("Error looking up diagnostics config:", err));
  }, []);

  // Poll status when jobId changes
  useEffect(() => {
    if (!jobId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/job-status/${jobId}`);
        if (!res.ok) {
          throw new Error("Job tracking failed");
        }
        const data = await res.json();
        setJob(data);

        // Auto Scroll Terminal to bottom
        if (terminalEndRef.current) {
          terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
        }

        if (data.stage === "completed" || data.stage === "failed") {
          setIsLoading(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err: any) {
        console.error("Polling status error:", err);
        setErrorMessage("Connection lost with translation process thread.");
        setIsLoading(false);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    };

    // Initial check
    fetchStatus();

    // Start polling interval
    pollingRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobId]);

  // Trigger localization process
  const startLocalization = async () => {
    const targetUrl = videoUrl.trim();
    if (!targetUrl) {
      setErrorMessage("Please enter or select a valid video link to begin.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setJobId(null);
    setJob(null);

    try {
      const response = await fetch("/api/process-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: targetUrl,
          targetLanguage: selectedLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server failed to queue the job.");
      }

      const data = await response.json();
      setJobId(data.jobId);
    } catch (err: any) {
      console.error("Orchestration error:", err);
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // Preset loading option helper
  const loadPresetUrl = (preset: string) => {
    setVideoUrl(preset);
    setErrorMessage(null);
  };

  const resetAll = () => {
    setVideoUrl("");
    setJobId(null);
    setJob(null);
    setIsLoading(false);
    setErrorMessage(null);
  };

  // Language mapping options
  const LANGUAGES = [
    { value: "tamil", label: "Tamil", style: "Tanglish (Tamil + English)", region: "Chennai/TN" },
    { value: "hindi", label: "Hindi", style: "Hinglish (Hindi + English)", region: "Mumbai/NCR" },
    { value: "telugu", label: "Telugu", style: "Telemix (Telugu + English)", region: "Hyderabad/AP" },
    { value: "malayalam", label: "Malayalam", style: "Manglish (Malayalam + English)", region: "Kerala/KL" },
    { value: "kannada", label: "Kannada", style: "Kanglish (Kannada + English)", region: "Bengaluru/KA" },
    { value: "tulu", label: "Tulu", style: "Tulunglish (Tulu + English)", region: "Mangaluru/KA" },
    { value: "bengali", label: "Bengali", style: "Bonglish (Bengali + English)", region: "Kolkata/WB" },
    { value: "marathi", label: "Marathi", style: "Marathinglish (Marathi + English)", region: "Mumbai/MH" },
    { value: "gujarati", label: "Gujarati", style: "Gujlish (Gujarati + English)", region: "Ahmedabad/GJ" },
    { value: "punjabi", label: "Punjabi", style: "Punglish (Punjabi + English)", region: "Amritsar/PB" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-600 selection:text-white" id="main_root">
      
      {/* Sleek Header Banner */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-50 backdrop-blur-md" id="header_section">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Languages className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-lg tracking-tight text-white">Linguist<span className="text-indigo-400">Pro</span></span>
              <span className="hidden md:inline text-xs text-slate-500 font-medium border-l border-slate-800 pl-3">
                Video-to-Video Localization Orchestrator
              </span>
            </div>
          </div>

          {/* System status display badges */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-950 rounded-full border border-slate-805 text-[10px] sm:text-xs">
              <span className={`h-2 w-2 rounded-full ${config?.hasGemini ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <span className="text-slate-400 font-medium">Gemini: {config?.hasGemini ? "Active" : "Not Set"}</span>
            </div>

            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-950 rounded-full border border-slate-805 text-[10px] sm:text-xs">
              <span className={`h-2 w-2 rounded-full ${config?.hasHeyGen ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-slate-400 font-medium">{config?.hasHeyGen ? "HeyGen Live" : "Sandbox"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6" id="app_viewport">
        
        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="bg-red-950/20 border border-red-900/55 p-4 rounded-xl text-red-200 flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-top-4 duration-300" id="error_alert">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Operation Blocked</h4>
              <p className="text-xs text-red-300/90 mt-1">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200 text-xs font-semibold px-2 py-1 rounded hover:bg-red-900/30 transition">
              Dismiss
            </button>
          </div>
        )}

        {/* Credentials Sandbox Notice (If HeyGen key is missing) */}
        {config && !config.hasHeyGen && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-slate-300 flex items-start gap-4 shadow-sm" id="sandbox_banner">
            <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-1 animate-bounce" />
            <div>
              <h3 className="font-semibold text-sm text-indigo-300">Running in Developer Sandbox Simulation Mode</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                We've established a seamless **high-fidelity preview workflow**. We will use real Gemini AI to translate and re-script your audio colloquially. Since no `HEYGEN_API_KEY` was found in `.env.local` yet, we'll demonstrate the exact request payload and render the localization path in sandbox mode with interactive subtitles overlaying high quality Indian demographic media templates.
              </p>
            </div>
          </div>
        )}

        {/* Core Layout Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="pipeline_workspace">
          
          {/* Left Column: controls + settings (5 Columns) */}
          <div className="lg:col-span-5 flex flex-col gap-6" id="configuration_column">
            
            {/* Box 1: Public Web URL pasting container */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition" id="upload_card">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-400" />
                1. Original Video URL
              </h2>
              <p className="text-xs text-slate-400 mb-4 leading-normal">
                Avoid slow local uploads of massive 100MB+ classes. Paste any public video link below (Google Drive public view, Dropbox direct download, YouTube, or raw MP4 web addresses).
              </p>

              {/* URL Input Box */}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="https://example.com/lecture-video.mp4"
                    disabled={isLoading}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-4 pr-10 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  {videoUrl && (
                    <button
                      onClick={() => setVideoUrl("")}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Training Presets click tags */}
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-805 text-left">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Quick-Load Sample educational links:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {[
                      {
                        name: "📖 Cloud Dev Tech Lecture",
                        url: "https://assets.mixkit.co/videos/preview/mixkit-holding-a-smartphone-next-to-a-laptop-42171-large.mp4",
                      },
                      {
                        name: "💡 Entrepreneurship Case-Study",
                        url: "https://assets.mixkit.co/videos/preview/mixkit-startup-team-working-on-a-creative-office-42111-large.mp4",
                      },
                      {
                        name: "📊 Business Finance Seminar",
                        url: "https://assets.mixkit.co/videos/preview/mixkit-man-working-on-a-laptop-in-a-coffee-shop-41829-large.mp4",
                      },
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => loadPresetUrl(preset.url)}
                        disabled={isLoading}
                        className={`text-left text-xs p-1.5 rounded-md hover:bg-slate-900 border transition-all ${
                          videoUrl === preset.url
                            ? "border-indigo-600/50 bg-indigo-600/5 text-indigo-300"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Box 2: Target Language configuration selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm" id="language_card">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">2. Target Language</h2>

              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Select Indian Colloquial Tone
              </label>
              
              <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-800" id="language_selectors_grid">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => setSelectedLanguage(lang.value)}
                    type="button"
                    disabled={isLoading}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      selectedLanguage === lang.value
                        ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500 text-white"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold">{lang.label}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{lang.style}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-900 rounded text-[9px] font-bold uppercase tracking-wide border border-slate-800 text-slate-400 shrink-0">
                      {lang.region}
                    </span>
                  </button>
                ))}
              </div>

              {/* Submit trigger button */}
              <button
                onClick={startLocalization}
                disabled={isLoading || !videoUrl.trim()}
                className={`w-full mt-6 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isLoading || !videoUrl.trim()
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 active:scale-98"
                }`}
                id="submit_orchestrator_btn"
              >
                {isLoading ? (
                  <>
                    <Cpu className="h-4 w-4 animate-spin text-white/85" />
                    <span>Processing & Localizing...</span>
                  </>
                ) : (
                  <>
                    <span>Process & Localize</span>
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {/* Instruction Panel */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 leading-relaxed" id="instructions_card">
              <h4 className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-indigo-400" />
                Orchestration Checklist
              </h4>
              <ul className="list-disc pl-4 space-y-1.5 mt-2">
                <li>Under the hood, Gemini transcribes original voice content.</li>
                <li>The translated Hinglish/Tanglish script ensures modern social media tone.</li>
                <li>HeyGen performs real lip sync translation directly over the target video.</li>
              </ul>
            </div>

          </div>

          {/* Right Column: Monitors / Terminals / Video outputs (7 Columns) */}
          <div className="lg:col-span-7 flex flex-col gap-6" id="monitoring_column">
            
            {/* Realtime progress tracker */}
            {isLoading || job ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 flex flex-col gap-6" id="progress_dashboard">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="font-bold text-sm text-slate-200">
                      Live Localization Thread
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Job Ref: {jobId || "Establishing connection..."}</p>
                  </div>
                  <div className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-[10px] font-bold uppercase text-indigo-400">
                    Stage: {job?.stage || "queueing"}
                  </div>
                </div>

                {/* Progress bar tracking */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">{job?.statusText || "Uploading source data..."}</span>
                    <span className="text-indigo-400">{job?.progress || 10}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${job?.progress || 10}%` }}
                    />
                  </div>
                </div>

                {/* Vertical Stage pipeline milestone diagram */}
                <div className="flex flex-col gap-3">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest text-left">Localization Pipeline Status</h2>
                  
                  <div className="flex items-center justify-between gap-1 w-full" id="pipeline_timeline">
                    {[
                      { key: "uploading", label: "1. Uploaded" },
                      { key: "gemini_translating", label: "2. Translating" },
                      { key: "heygen_processing", label: "3. Lip-Sync" },
                      { key: "rendering", label: "4. Render" },
                    ].map((stageItem, index, arr) => {
                      const isCompleted = 
                        stageItem.key === "uploading" && job?.stage !== "uploading" ||
                        stageItem.key === "gemini_translating" && !["uploading", "gemini_translating"].includes(job?.stage || "") ||
                        stageItem.key === "heygen_processing" && ["rendering", "completed"].includes(job?.stage || "") ||
                        stageItem.key === "rendering" && job?.stage === "completed";

                      const isCurrent = job?.stage === stageItem.key || (stageItem.key === "uploading" && !job && isLoading);
                      
                      return (
                        <React.Fragment key={stageItem.key}>
                          <div className="flex flex-col items-center gap-2 flex-1">
                            {isCompleted ? (
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : isCurrent ? (
                              <div className="w-10 h-10 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center text-white animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                                <Clock className="h-4.5 w-4.5" />
                              </div>
                            )}
                            <span className={`text-[11px] font-semibold ${isCompleted ? 'text-emerald-500' : isCurrent ? 'text-white' : 'text-slate-500'}`}>
                              {stageItem.label}
                            </span>
                          </div>
                          {index < arr.length - 1 && (
                            <div className="h-px bg-slate-800 flex-1 -mt-6"></div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Text Panel showing the localized text that Gemini translated */}
                {job?.translatedScript && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-905 pb-2 mb-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        Localized Script (Draft)
                      </span>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                        {job.languageLabel} Custom Casual Tone
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300 italic select-all">
                      "{job.translatedScript}"
                    </p>
                  </div>
                )}

                {/* Console Log Terminal */}
                <div className="flex flex-col gap-1.5 text-left" id="terminal_box">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-semibold flex items-center gap-1.5 text-slate-400">
                      <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                      Pipeline Live Execution Logs
                    </span>
                    <span className="text-[10px] text-slate-605 font-mono">STREAM</span>
                  </div>
                  
                  {/* Outer terminal */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed h-44 overflow-y-auto text-left shadow-inner flex flex-col gap-1">
                    {job?.logs && job.logs.length > 0 ? (
                      job.logs.map((log, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-2 ${
                            log.type === "success" 
                              ? "text-emerald-400" 
                              : log.type === "warning" 
                                ? "text-amber-450" 
                                : log.type === "error" 
                                  ? "text-red-400" 
                                  : "text-slate-450"
                          }`}
                        >
                          <span className="text-slate-600 shrink-0 font-medium">[{log.timestamp}]</span>
                          <span className="break-all whitespace-pre-wrap">{log.message}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-600 italic">Awaiting backend job start triggers...</span>
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </div>

                {/* Final localized Video Player render (completed state only) */}
                {job?.stage === "completed" && job?.videoUrl && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-4 text-left animate-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                      <div className="flex items-center gap-2">
                        <BookmarkCheck className="h-5 w-5 text-indigo-400 shrink-0" />
                        <div>
                          <h4 className="font-bold text-sm text-slate-100">Localized Video Dub Ready</h4>
                          <p className="text-[11px] text-slate-500">Original script re-rendered with facial lip sync</p>
                        </div>
                      </div>
                      <button 
                        onClick={resetAll} 
                        className="p-1 px-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </button>
                    </div>

                    {/* Standard player view with Preview header */}
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video border border-slate-900 group">
                      <div className="absolute top-4 left-4 z-10 flex gap-2">
                        <span className="bg-indigo-600/95 text-white text-[10px] font-bold px-2 py-1 rounded uppercase backdrop-blur-sm shadow-md">Live Dubbed Preview</span>
                        <span className="bg-slate-950/80 text-slate-300 text-[10px] font-bold px-2 py-1 rounded uppercase backdrop-blur-sm border border-slate-800">1080p | 30fps</span>
                      </div>
                      <video 
                        src={job.videoUrl} 
                        controls 
                        className="w-full h-full object-cover"
                        poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=640"
                      />
                      
                      {/* Integrated script-subtitle overlay indicator overlay */}
                      <div className="absolute bottom-12 left-0 right-0 pointer-events-none px-4 flex justify-center text-center">
                        <span className="bg-slate-950/90 border border-slate-800 text-indigo-300 text-xs px-3.5 py-2 rounded-xl max-w-sm shadow-2xl">
                          🗣️ Dubted Translate: "{job.translatedScript}"
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-400 leading-normal bg-slate-900 p-3.5 rounded-lg border border-slate-800 flex items-center justify-between gap-4">
                      <span>Congratulations! Video translation pipeline ran fully. Lip synced video served directly.</span>
                      <a 
                        href={job.videoUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 font-bold hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        Open Source Url
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Job Crash fallback */}
                {job?.stage === "failed" && (
                  <div className="bg-red-950/15 border border-red-900/40 rounded-xl p-4 text-left">
                    <h4 className="font-bold text-sm text-red-200">Pipeline Execution Halted</h4>
                    <p className="text-xs text-red-400 mt-1">{job.error || "The processing cluster failed to synthesize assets. Check your keys."}</p>
                    <button 
                      onClick={resetAll} 
                      className="mt-4 px-4 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Try different file or reset context
                    </button>
                  </div>
                )}

              </div>
            ) : (
              /* State 2: Prompt state (Empty state) */
              <div 
                className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl flex flex-col items-center justify-center text-center gap-6 min-h-[460px] relative overflow-hidden group"
                id="empty_prompt_state"
              >
                {/* Decorative glowing gradient backdrop */}
                <div className="absolute -top-16 -right-16 w-52 h-52 bg-indigo-600/10 blur-3xl rounded-full" />
                <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-slate-600/10 blur-3xl rounded-full" />

                <div className="p-5 bg-slate-950 rounded-full border border-slate-800 select-none relative z-10 text-indigo-400 ring-4 ring-slate-950/50 group-hover:scale-105 transition duration-300">
                  <Play className="h-10 w-10 text-indigo-400 translate-x-0.5" />
                </div>

                <div className="max-w-md relative z-10">
                  <h3 className="font-semibold text-slate-200 text-base">Pipeline Inactive</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Upload an English marketing video file and select your targeted street dialect overlay on the left, then click **Process & Localize** to launch our full-stack extraction and translation orchestrator.
                  </p>
                </div>

                <div className="text-[10px] text-slate-500 select-none flex items-center gap-2 relative z-10 font-mono">
                  <span>LinguistPro Dubbing Orchestration v1.0.4</span>
                  <span>•</span>
                  <span>STATUS: READY</span>
                </div>
              </div>
            )}

            {/* Quick Developer Credentials Config Setup Guide */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm text-left" id="developer_guide_card">
              <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-indigo-400" />
                API Key Configuration Guide
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                This applet uses secure high-speed Node.js Express server routes to run the Gemini multi-modal transcriber and call the HeyGen lip-sync cloud renderer. To configure actual production environments, add your credentials inside a `.env.local` or `.env` in the root workspace of your exported project.
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-[10.5px] leading-relaxed text-slate-400 select-all space-y-1.5">
                <div><span className="text-slate-600"># Required for video audio analysis & street translation output:</span></div>
                <div><span className="text-indigo-400 font-medium">GEMINI_API_KEY</span>=your_gemini_api_key_here</div>
                <div className="pt-2"><span className="text-slate-600 font-sans"># Required for automated lip-synced video output translation (optional, sandbox fallback active):</span></div>
                <div><span className="text-indigo-400 font-medium">HEYGEN_API_KEY</span>=your_heygen_api_key_here</div>
                <div className="pt-2"><span className="text-slate-600"># Set to your hosting web server URL to enable HeyGen public file fetch:</span></div>
                <div><span className="text-cyan-400">APP_URL</span>={config?.appUrl || "your_public_cloudrun_or_tunnel_url"}</div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Decorative clean footer */}
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-500 py-6 px-6 sm:px-8 text-center text-xs mt-auto" id="footer_section">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>
            Designed with desktop-first precision for marketing localization workflows.
          </p>
          <p className="font-mono text-[10px]">
            &copy; 2026 LinguistPro Orchestrator • Build v1.0.4
          </p>
        </div>
      </footer>

    </div>
  );
}
