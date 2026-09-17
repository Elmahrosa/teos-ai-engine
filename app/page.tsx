"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant'; content: string}>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [officialSources, setOfficialSources] = useState(false);
  const [mode, setMode] = useState<'text' | 'search' | 'video'>('text');

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, {role: 'user', content: userMessage}]);
    setLoading(true);
    try {
      // Call existing generate endpoint (adapt as needed)
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt: userMessage, platform: "linkedin"}),
      });
      const data = await res.json();
      let reply = data.post || "Sorry, something went wrong.";
      if (officialSources) {
        reply = "[Official Sources Mode] " + reply;
      }
      setMessages(prev => [...prev, {role: 'assistant', content: reply}]);
    } catch (err) {
      setMessages(prev => [...prev, {role: 'assistant', content: "Error: " + err}]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Optional: fetch initial stats or welcome message
    setMessages(prev => [
      ...prev,
      {role: 'assistant', content: "Welcome to Ask-Teos-AI Engine. How can I assist you today?"}
    ]);
  }, []);

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
                <span>{mode === 'text' ? 'Text' : mode === 'search' ? 'Search' : 'Video (Coming Soon)'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role === 'user' ? "ml-auto max-w-[80%] bg-[#1a1a1a]/30 rounded-xl px-4 py-2" : "max-w-[80%] bg-[#0a0a0a]/40 rounded-xl px-4 py-2"}>
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {loading && (
          <div className="ml-auto max-w-[80%] bg-[#1a1a1a]/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[#C9A84C]/50 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-[#8a88a0]">Thinking...</span>
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
            {loading ? "…" : "Send"}
          </button>
        </div>
      </footer>
    </main>
  );
}