"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { PLANS, getPlan } from "@/lib/plans";
import Link from "next/link";

type Platform = "x" | "facebook" | "instagram" | "linkedin";

interface Post {
  id: string;
  platform: Platform;
  // The Prisma model declares prompt as nullable, so this is null for posts
  // saved without one. There is no status field on the model or the API.
  prompt: string | null;
  content: string;
  createdAt: string;
}

const PLATFORM_ICONS: Record<Platform, string> = {
  x: "𝕏",
  facebook: "f",
  instagram: "◈",
  linkedin: "in",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"generate" | "saved">("generate");
  const [platform, setPlatform] = useState<Platform>("x");
  const [prompt, setPrompt] = useState("");
  const [generated, setGenerated] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [dailyUsed, setDailyUsed] = useState(0);

  const plan = getPlan(session?.user?.plan ?? "free", session?.user?.email);

  useEffect(() => {
    if (session) {
      fetch("/api/user").then(r => r.json()).then(d => {
        if (d?.user) setDailyUsed(d.user.dailyPostsUsed ?? 0);
      }).catch(() => {});
    }
  }, [session]);

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    const res = await fetch("/api/posts");
    const data = await res.json();
    setPosts(data.posts ?? []);
    setPostsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "saved") fetchPosts();
  }, [tab, fetchPosts]);

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGenError("");
    setGenerated("");
    setCopied(false);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setGenerated(data.post || data.content || "");
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generated || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, prompt, content: generated }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setGenError("Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4">Sign in to access your dashboard</h1>
          <Link href="/login" className="btn-teal text-sm px-6 py-3">Sign in</Link>
        </div>
      </div>
    );
  }

  const remaining = plan.dailyLimit === -1
    ? Infinity
    : Math.max(0, plan.dailyLimit - dailyUsed);

  return (
    <div className="min-h-screen bg-bg">
      <header className="glass">
        <div className="section-container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 text-bg text-xs font-black">T</div>
            <span className="text-lg font-bold">Teos <span className="text-gold-500">AI</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#8a88a0]">{plan.name}</span>
            <button onClick={() => signOut()} className="text-xs text-[#5a5870] hover:text-[#e8e6f0]">Sign out</button>
          </div>
        </div>
      </header>

      <div className="section-container py-8">
        <div className="flex gap-4 mb-8">
          <button onClick={() => setTab("generate")} className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all ${tab === "generate" ? "bg-gold-500/15 text-gold-500" : "text-[#5a5870]"}`}>Generate</button>
          <button onClick={() => setTab("saved")} className={`text-sm font-semibold px-4 py-2 rounded-lg transition-all ${tab === "saved" ? "bg-gold-500/15 text-gold-500" : "text-[#5a5870]"}`}>Saved Posts</button>
          <Link href="/pricing" className="text-sm font-semibold px-4 py-2 rounded-lg text-teal-400 ml-auto">Upgrade</Link>
        </div>

        {tab === "generate" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs px-2 py-1 rounded-full bg-gold-500/10 text-gold-500">
                {remaining === Infinity ? "Unlimited" : `${remaining} remaining today`}
              </span>
            </div>

            <div className="flex gap-2">
              {(["x", "linkedin", "instagram", "facebook"] as Platform[]).map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${platform === p ? "bg-gold-500/15 text-gold-500 border border-gold-500/30" : "text-[#5a5870] border border-white/[0.06]"}`}>
                  {PLATFORM_ICONS[p]} {p}
                </button>
              ))}
            </div>

            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="What do you want to post about?"
              rows={3}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm text-[#e8e6f0] placeholder-[#5a5870] outline-none focus:border-gold-500/40 resize-none" />

            <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
              className="btn-primary w-full text-sm py-3 disabled:opacity-40">
              {generating ? "Generating..." : "Generate Post"}
            </button>

            {genError && (
              <div className="p-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">{genError}</div>
            )}

            {generated && (
              <div className="rounded-xl border border-white/[0.08] bg-bg-card p-5">
                <pre className="text-sm text-[#e8e6f0] whitespace-pre-wrap font-sans leading-relaxed">{generated}</pre>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button onClick={() => { navigator.clipboard.writeText(generated); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gold-500/10 text-gold-500 border border-gold-500/20">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
                  </button>
                  <button onClick={() => {
                    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(generated)}`;
                    window.open(shareUrl, "_blank", "noopener,noreferrer");
                  }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Share on X
                  </button>
                  <button onClick={() => {
                    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(generated)}`;
                    window.open(shareUrl, "_blank", "noopener,noreferrer");
                  }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Share on LinkedIn
                  </button>
                  <button onClick={() => {
                    const shareUrl = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(generated)}`;
                    window.open(shareUrl, "_blank", "noopener,noreferrer");
                  }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Share on Facebook
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "saved" && (
          <div className="max-w-2xl mx-auto">
            {postsLoading ? (
              <p className="text-center text-sm text-[#5a5870]">Loading...</p>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[#5a5870]">No saved posts yet</p>
                <button onClick={() => setTab("generate")} className="btn-teal text-sm px-5 py-2 mt-4">Generate your first post</button>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <div key={post.id} className="rounded-xl border border-white/[0.08] bg-bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{PLATFORM_ICONS[post.platform]}</span>
                      <span className="text-xs text-[#8a88a0]">{post.platform}</span>
                      <span className="text-xs text-[#5a5870] ml-auto">{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-[#e8e6f0] line-clamp-3">{post.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
