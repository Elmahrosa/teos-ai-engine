"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [messages, setMessages] = useState<Array<TextMessage | VideoMessage>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [officialSources, setOfficialSources] = useState(false);
  const [mode, setMode] = useState<'text' | 'search' | 'video'>('text');

  const videoEngineUrl = process.env.NEXT_PUBLIC_VIDEO_ENGINE_URL || "";

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput("");
    // Add user message
    setMessages(prev => [...prev, { role: 'user', type: 'text', content: userMessage }]);
    setLoading(true);
    try {
      let response;
      if (mode === 'video') {
        // Call video engine
        if (!videoEngineUrl) {
          throw new Error("Video engine URL not configured");
        }
        const res = await fetch(`${videoEngineUrl}/api/v1/video/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: userMessage }),
        });
        if (!res.ok) {
          throw new Error(`Video engine error: ${res.status}`);
        }
        response = await res.json();
        // Railway returns { video_url, audio_url, subtitles_url, visibility: { score, grade, ... } }
        const data = response.data ?? response; // fallback if format differs
        const visibility = data.visibility ?? {};
        const videoMessage: VideoMessage = {
          role: 'assistant',
          type: 'video',
          videoUrl: data.video_url || data.videoUrl || "",
          audioUrl: data.audio_url || data.audioUrl || "",
          subtitlesUrl: data.subtitles_url || data.subtitlesUrl || "",
          visibilityScore: visibility.score ?? data.visibility_score ?? 0,
          visibilityGrade: visibility.grade || getVisibilityGrade(visibility.score ?? 0),
        };
        setMessages(prev => [...prev, videoMessage]);
      } else {
        // Call existing generate endpoint (text/search)
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userMessage, platform: "linkedin" }),
        });
        if (!res.ok) {
          throw new Error(`Generation error: ${res.status}`);
        }
        const data = await res.json();
        let reply = data.post || "Sorry, something went wrong.";
        if (officialSources) {
          reply = "[Official Sources Mode] " + reply;
        }
        setMessages(prev => [...prev, { role: 'assistant', type: 'text', content: reply }]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', type: 'text', content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Optional: fetch initial stats or welcome message
    setMessages(prev => [
      ...prev,
      { role: 'assistant', type: 'text', content: "Welcome to Ask-Teos-AI Engine. How can I assist you today?" },
    ]);
  }, []);

  // Helper to format visibility score with grade
  const getVisibilityGrade = (score: number): string => {
    if (score >= 90) return "A+";
    if (score >= 85) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    return "D";
  };

  return (
    <main className="min-h-screen bg-[#050505] text-[#e8e6f0] flex flex-col">
      {/* Header */}
      <header className="bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-[#1a1a1a]/40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-[#C9A84C] to-[#9B6FDF] rounded-xl flex items-center justify-center text-white font-bold text-xs">
              A-I
            </div>
            <div>
              <h1 className="text-lg font-bold">Ask-Teos-AI Engine</h1>
              <p className="text-xs text-[#8a88a0]">Secure AI. Official Sources. Competitive Edge.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setOfficialSources(!officialSources)} className="flex items-center gap-2 text-sm font-medium hover:text-[#C9A84C]">
                <span className="w-3 h-3 rounded-full" style={{backgroundColor: officialSources ? "#C9A84C" : "#4a4a4a"}}></span>
                <span>Official Sources</span>
              </button>
              {officialSources && (
                <div className="absolute -top-2 -right-2 w-2 h-2 bg-[#ff4444] rounded-full animate-pulse"></div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => {
                const m = mode === 'text' ? 'search' : mode === 'search' ? 'video' : 'text';
                setMode(m);
              }} className="flex items-center gap-2 text-sm font-medium hover:text-[#C9A84C]">
                <span className="w-3 h-3 rounded-full" style={{backgroundColor: mode === 'text' ? "#8a88a0" : mode === 'search' ? "#C9A84C" : "#9B6FDF"}}></span>
                <span>{mode === 'text' ? 'Text' : mode === 'search' ? 'Search' : 'Video'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'user' ? "ml-auto max-w-[80%] bg-[#1a1a1a]/30 rounded-xl px-4 py-2" : "max-w-[80%] bg-[#0a0a0a]/40 rounded-xl px-4 py-2"}>
            {msg.type === 'text' ? (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            ) : (
              <VideoBubble message={msg} />
            )}
          </div>
        ))}
        {loading && (
          <div className="ml-auto max-w-[80%] bg-[#1a1a1a]/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[#C9A84C]/50 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-[#8a88a0]">
              {mode === 'video' ? "Generating sovereign video... (This may take a minute)" : "Thinking..."}
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <footer className="border-t border-[#1a1a1a]/40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about strategy, content, or market insights..."
            className="flex-1 min-h-[60px] rounded-xl border border-[#1a1a1a]/30 bg-[#0a0a0a]/40 text-[#e8e6f0] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#9B6FDF] text-[#050505] font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (mode === 'video' ? "Generating…" : "…") : "Send"}
          </button>
        </div>
      </footer>
    </main>
  );
}

// Video message bubble: plays the generated MP4 and shows the reach forecast.
function VideoBubble({ message }: { message: VideoMessage }) {
  const [failed, setFailed] = useState(false);

  if (!message.videoUrl) {
    return (
      <div className="rounded-lg border border-[#1a1a1a]/40 bg-[#0a0a0a]/80 p-4 text-center">
        <p className="text-sm text-[#e8e6f0]">The video engine returned no video URL.</p>
      </div>
    );
  }

  return (
    <>
      {failed ? (
        <div className="rounded-lg border border-[#1a1a1a]/40 bg-[#0a0a0a]/80 p-4 text-center">
          <p className="text-sm text-[#e8e6f0] mb-2">Video could not be loaded.</p>
          <a href={message.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[#C9A84C] underline text-xs">
            Download video instead
          </a>
        </div>
      ) : (
        <video
          controls
          autoPlay
          muted
          loop
          playsInline
          className="max-w-full rounded-lg border border-[#1a1a1a]/40"
          src={message.videoUrl}
          onError={() => setFailed(true)}
        />
      )}
      <div className="mt-3 text-center text-xs text-[#8a88a0]">
        Predicted Visibility Score: {message.visibilityScore}/100
        {message.visibilityGrade ? ` (Grade ${message.visibilityGrade})` : ""}
      </div>
    </>
  );
}

// Type definitions
interface TextMessage {
  role: 'user' | 'assistant';
  type: 'text';
  content: string;
}

interface VideoMessage {
  role: 'assistant';
  type: 'video';
  videoUrl: string;
  audioUrl: string;
  subtitlesUrl: string;
  visibilityScore: number;
  visibilityGrade: string;
}