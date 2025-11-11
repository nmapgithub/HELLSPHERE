"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysisStore } from "@/stores/analysisStore";
import { getBackendUrl } from "@/lib/api";

const DEFAULT_HTTP_SERVER_PORT = 1339;

const sanitizeKey = (value: string | null | undefined) => {
  if (!value) return "";
  return value.replace(/^(\s*[A-Za-z0-9_]+\s*=\s*)+/, "").trim();
};

export function SettingsPanel() {
  const settingsOpen = useAnalysisStore((state) => state.settingsOpen);
  const setSettingsOpen = useAnalysisStore((state) => state.setSettingsOpen);
  const useSerpApi = useAnalysisStore((state) => state.useSerpApi);
  const setUseSerpApi = useAnalysisStore((state) => state.setUseSerpApi);
  const setError = useAnalysisStore((state) => state.setError);

  const [geminiKey, setGeminiKey] = useState("");
  const [serpKey, setSerpKey] = useState("");
  const [imgurKey, setImgurKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<string | null>(null);

  const keysEndpoint = useMemo(() => getBackendUrl("/api/keys"), []);

  useEffect(() => {
    if (!settingsOpen) return;
    let ignore = false;

    (async () => {
      setIsLoading(true);
      try {
        const response = await fetch(keysEndpoint, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load API keys");
        }
        const data = (await response.json()) as Record<string, string>;
        if (!ignore) {
          setGeminiKey(sanitizeKey(data.gemini_key));
          setSerpKey(sanitizeKey(data.serpapi_key));
          setImgurKey(sanitizeKey(data.imgur_client_id));
        }
      } catch (error) {
        console.error("Failed to load API keys", error);
        if (!ignore) {
          setSaveMessage("Unable to load API keys. Please verify the backend is reachable.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [settingsOpen, keysEndpoint]);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      const trimmedGemini = sanitizeKey(geminiKey);
      const trimmedSerp = sanitizeKey(serpKey);
      const trimmedImgur = sanitizeKey(imgurKey);

      if (trimmedGemini) {
        formData.append("gemini_key", trimmedGemini);
      }
      if (trimmedSerp) {
        formData.append("serpapi_key", trimmedSerp);
      }
      if (trimmedImgur) {
        formData.append("imgur_client_id", trimmedImgur);
      }

      const response = await fetch(keysEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to save API keys (${response.status})`);
      }

      setSaveMessage("API credentials saved. You can close this panel.");
      setError(undefined);
    } catch (error) {
      console.error("Failed to save API keys", error);
      setSaveMessage("Saving API keys failed. Check server logs for more detail.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearStoredKeys = async () => {
    setIsLoading(true);
    setSaveMessage(null);
    try {
      const formData = new FormData();
      formData.append("gemini_key", "");
      formData.append("serpapi_key", "");
      formData.append("imgur_client_id", "");

      const response = await fetch(keysEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to clear API keys (${response.status})`);
      }

      setSaveMessage("Stored API keys cleared.");
    } catch (error) {
      console.error("Failed to clear API keys", error);
      setSaveMessage("Clearing API keys failed. Check server logs for more detail.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartHttpServer = async () => {
    setHttpStatus(null);
    try {
      const response = await fetch("/api/http-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: DEFAULT_HTTP_SERVER_PORT }),
      });
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(payload.message as string);
      }
      const status = payload.status as string | undefined;
      if (status === "already_running") {
        setHttpStatus(`HTTP server already running on port ${payload.port ?? DEFAULT_HTTP_SERVER_PORT}.`);
      } else {
        setHttpStatus(`HTTP server started on port ${payload.port ?? DEFAULT_HTTP_SERVER_PORT}.`);
      }
    } catch (error) {
      console.error("Failed to start HTTP server", error);
      setHttpStatus("Unable to start HTTP server. Confirm Python is available on the host.");
    }
  };

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          key="settings-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-lg"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative w-full max-w-xl rounded-2xl border border-cyan-400/20 bg-[#070714]/95 p-8 text-left shadow-[0_0_45px_rgba(0,255,255,0.25)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg uppercase tracking-[0.4em] text-cyan-200">
                  Settings Console
                </h2>
                <p className="mt-2 text-xs font-mono uppercase tracking-[0.25em] text-cyan-200/60">
                  Configure API credentials and auxiliary services
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-200 transition hover:border-magenta-400/50 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-5 text-sm">
              <label className="block">
                <span className="font-mono uppercase tracking-[0.25em] text-cyan-300/80">Gemini API Key</span>
                <input
                  value={geminiKey}
                  onChange={(event) => setGeminiKey(event.target.value)}
                  type="password"
                  className="mt-2 w-full rounded-lg border border-cyan-400/20 bg-black/40 px-3 py-2 font-mono text-xs tracking-[0.2em] text-cyan-100 outline-none focus:border-cyan-300"
                  placeholder="Enter Gemini API Key"
                />
              </label>

              <label className="block">
                <span className="font-mono uppercase tracking-[0.25em] text-cyan-300/80">SerpAPI Key</span>
                <input
                  value={serpKey}
                  onChange={(event) => setSerpKey(event.target.value)}
                  type="password"
                  className="mt-2 w-full rounded-lg border border-cyan-400/20 bg-black/40 px-3 py-2 font-mono text-xs tracking-[0.2em] text-cyan-100 outline-none focus:border-cyan-300"
                  placeholder="Enter SerpAPI Key"
                />
              </label>

              <label className="block">
                <span className="font-mono uppercase tracking-[0.25em] text-cyan-300/80">Imgur Client ID</span>
                <input
                  value={imgurKey}
                  onChange={(event) => setImgurKey(event.target.value)}
                  type="password"
                  className="mt-2 w-full rounded-lg border border-cyan-400/20 bg-black/40 px-3 py-2 font-mono text-xs tracking-[0.2em] text-cyan-100 outline-none focus:border-cyan-300"
                  placeholder="Optional Imgur Client ID"
                />
              </label>

              <div className="flex items-center justify-between rounded-lg border border-cyan-400/20 bg-black/40 px-4 py-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-200/80">
                    SerpAPI Augmentation
                  </p>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-200/50">
                    Toggle satellite searches using live web reconnaissance
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseSerpApi(!useSerpApi)}
                  className={`rounded-full border px-4 py-2 text-xs font-mono uppercase tracking-[0.3em] transition ${
                    useSerpApi
                      ? "border-cyan-400/70 text-cyan-200 hover:border-magenta-400/70 hover:text-white"
                      : "border-cyan-400/20 text-cyan-200/50 hover:border-magenta-400/50 hover:text-white"
                  }`}
                >
                  {useSerpApi ? "Enabled" : "Disabled"}
                </button>
              </div>

              <button
                type="button"
                onClick={handleStartHttpServer}
                className="w-full rounded-lg border border-cyan-400/40 bg-black/40 px-4 py-3 font-display text-xs uppercase tracking-[0.4em] text-cyan-200 transition hover:border-magenta-400/60 hover:text-white"
              >
                Start HTTP Server for SerpAPI
              </button>

              {httpStatus && (
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-200/60">
                  {httpStatus}
                </p>
              )}
            </div>

            {saveMessage && (
              <p className="mt-6 text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-200/70">
                {saveMessage}
              </p>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSave}
                disabled={isLoading}
                className="rounded-full border border-cyan-400/50 px-5 py-2 font-display text-xs uppercase tracking-[0.4em] text-cyan-200 transition disabled:opacity-50 hover:border-magenta-400/60 hover:text-white"
              >
                {isLoading ? "Saving…" : "Save API Keys"}
              </button>
              <button
                type="button"
                onClick={handleClearStoredKeys}
                className="rounded-full border border-magenta-400/40 px-5 py-2 font-display text-xs uppercase tracking-[0.4em] text-magenta-200 transition hover:border-magenta-400/70 hover:text-white"
              >
                Clear Stored Keys
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
