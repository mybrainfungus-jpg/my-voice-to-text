import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logout } from "./lib/firebaseAuth";
import {
  getOrCreateSpreadsheetId,
  appendRow,
  fetchSheetRows,
  SheetRow,
} from "./lib/googleApi";
import AudioRecorder from "./components/AudioRecorder";
import {
  LogOut,
  Sparkles,
  Sheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  User as UserIcon,
  Mic,
  PenTool,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App States
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [sheetStatus, setSheetStatus] = useState<"checking" | "connected" | "error">("checking");
  const [history, setHistory] = useState<SheetRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Recording Draft / Process State
  const [draftText, setDraftText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>("");
  const [processError, setProcessError] = useState<string | null>(null);

  // Toggle for Input Mode (Voice vs Manual Text)
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [manualText, setManualText] = useState("");

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setIsLoading(false);
        setAuthError(null);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync Google Sheet when token changes
  useEffect(() => {
    if (token) {
      syncSpreadsheet();
    } else {
      setSpreadsheetId(null);
      setSheetStatus("checking");
      setHistory([]);
    }
  }, [token]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setAuthError("Failed to authenticate with Google. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await logout();
      setUser(null);
      setToken(null);
      setDraftText("");
      setManualText("");
    }
  };

  const syncSpreadsheet = async (force = false) => {
    if (!token) return;
    setSheetStatus("checking");
    try {
      const id = await getOrCreateSpreadsheetId(token, force);
      setSpreadsheetId(id);
      setSheetStatus("connected");
      loadHistory(id);
    } catch (err: any) {
      console.error("Sheet sync error:", err);
      setSheetStatus("error");
    }
  };

  const loadHistory = async (id: string) => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const rows = await fetchSheetRows(token, id);
      // Reverse history to show newest first
      setHistory(rows.reverse());
    } catch (err) {
      console.error("Load history error:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Callback when recording transcriber completes
  const handleTranscriptComplete = (text: string) => {
    setDraftText(text);
    // Smooth scroll to draft
    setTimeout(() => {
      document.getElementById("draft-container")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleManualSubmit = () => {
    if (manualText.trim()) {
      setDraftText(manualText.trim());
      setManualText("");
      setTimeout(() => {
        document.getElementById("draft-container")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleSaveToSheet = async () => {
    if (!draftText.trim()) return;
    if (!token || !spreadsheetId) {
      setProcessError("No active connection to Google Sheets.");
      return;
    }

    setIsProcessing(true);
    setProcessError(null);

    try {
      // Step 1: Generate summary from backend Express server
      setProcessStep("Generating AI summary with Gemini...");
      const summaryResponse = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: draftText }),
      });

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate summary from Gemini");
      }

      const { summary } = await summaryResponse.json();

      // Step 2: Append to Spreadsheet
      setProcessStep("Writing entry to Google Sheet...");
      await appendRow(token, spreadsheetId, draftText, summary);

      // Step 3: Reload history and clear draft
      setProcessStep("Syncing history list...");
      await loadHistory(spreadsheetId);

      setDraftText("");
      setProcessStep("");
    } catch (err: any) {
      console.error("Save workflow failed:", err);
      setProcessError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to extract first initials for user avatar
  const getUserInitials = () => {
    if (!user?.displayName) return "U";
    return user.displayName
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#4A443F] font-sans flex flex-col selection:bg-[#8BA88E]/20">
      {/* 1. Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 bg-[#F9F6F2] flex flex-col items-center justify-center z-50"
            exit={{ opacity: 0 }}
          >
            <div className="w-12 h-12 bg-[#8BA88E] rounded-2xl flex items-center justify-center shadow-lg animate-bounce mb-4">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-[#2D2A26] tracking-tight">EchoSync</h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-[#7D766F]">
              <Loader2 className="w-4 h-4 animate-spin text-[#8BA88E]" />
              Initializing secure session...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Authentication Screen */}
      {!isLoading && !user && (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-sm border border-[#E6E0D9]"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#8BA88E] rounded-[24px] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#8BA88E]/20">
                <Mic className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-[#2D2A26] tracking-tight">EchoSync</h1>
              <p className="text-[#7D766F] mt-2">
                Record your voice notes, automatically transcribe them to a Google Sheet, and synthesize with Gemini.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-white border border-[#E6E0D9] hover:bg-[#F9F6F2] text-[#2D2A26] font-medium py-3 px-4 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#8BA88E]/30 touch-none"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#8BA88E]" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                )}
                <span>{isLoggingIn ? "Signing in..." : "Sign in with Google"}</span>
              </button>

              {authError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-[#E6E0D9] text-center text-xs text-[#7D766F]">
              EchoSync uses official Google Workspace APIs to securely create and append data to your sheets.
            </div>
          </motion.div>
        </div>
      )}

      {/* 3. Main Dashboard Application */}
      {!isLoading && user && (
        <>
          {/* Header */}
          <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-[#E6E0D9] z-20 transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#8BA88E] rounded-xl flex items-center justify-center shadow-sm">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[#2D2A26] flex items-center gap-1.5">
                    EchoSync
                  </h1>
                  <span className="text-[10px] uppercase tracking-wider text-[#7D766F] font-bold">Voice-To-Sheet</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Connection Badge */}
                {sheetStatus === "checking" && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#F0EDE9] rounded-full text-xs font-medium text-[#7D766F]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8BA88E]" />
                    Linking Sheet...
                  </div>
                )}
                {sheetStatus === "connected" && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#8BA88E]/10 rounded-full text-xs font-medium text-[#5C7A5E]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#8BA88E]" />
                    Sheet Synced
                  </div>
                )}
                {sheetStatus === "error" && (
                  <button
                    onClick={() => syncSpreadsheet(true)}
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-full text-xs font-medium text-red-700 transition-colors"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    Sync Failed (Retry)
                  </button>
                )}

                {/* User profile / Logout */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#E6D5C3] border border-[#D9C5B2] flex items-center justify-center text-[#4A443F] font-semibold text-xs shadow-inner">
                    {getUserInitials()}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 hover:bg-[#F0EDE9] text-[#7D766F] hover:text-[#2D2A26] rounded-full transition-all touch-none"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Workspace Grid */}
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Side: Recording/Drafting Engine */}
            <section className="lg:col-span-7 flex flex-col gap-6">
              {/* Input Mode Toggle */}
              <div className="flex p-1 bg-[#E6E0D9]/50 rounded-xl max-w-xs self-start border border-[#E6E0D9]">
                <button
                  onClick={() => setInputMode("voice")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    inputMode === "voice"
                      ? "bg-white text-[#2D2A26] shadow-sm"
                      : "text-[#7D766F] hover:text-[#2D2A26]"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" /> Voice Rec
                </button>
                <button
                  onClick={() => setInputMode("text")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    inputMode === "text"
                      ? "bg-white text-[#2D2A26] shadow-sm"
                      : "text-[#7D766F] hover:text-[#2D2A26]"
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" /> Manual Draft
                </button>
              </div>

              {/* Toggle panels */}
              <AnimatePresence mode="wait">
                {inputMode === "voice" ? (
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AudioRecorder onTranscriptComplete={handleTranscriptComplete} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-[#E6E0D9] flex flex-col"
                  >
                    <div className="mb-4 text-left">
                      <span className="text-[#8BA88E] font-medium uppercase tracking-widest text-xs">Manual Entry</span>
                      <h2 className="text-2xl font-bold mt-1 text-[#2D2A26]">Type your thought</h2>
                      <p className="text-[#7D766F] mt-1 text-sm">
                        Enter your thoughts directly, then save. Gemini will summarize it automatically.
                      </p>
                    </div>

                    <textarea
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Type anything you want to save..."
                      className="w-full h-36 p-4 rounded-2xl bg-[#F9F6F2] border border-[#E6E0D9] text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8BA88E]/30 focus:border-[#8BA88E] resize-none"
                    />

                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        onClick={() => setManualText("")}
                        disabled={!manualText}
                        className="px-4 py-2 text-xs font-semibold text-[#7D766F] hover:text-[#2D2A26] transition-colors disabled:opacity-40"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleManualSubmit}
                        disabled={!manualText.trim()}
                        className="px-4 py-2 text-xs font-bold bg-[#8BA88E] text-white hover:bg-[#7A997D] rounded-xl transition-all disabled:opacity-40 shadow-sm"
                      >
                        Create Draft
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Draft Box and Google Sheet Save Workflow */}
              <AnimatePresence>
                {draftText && (
                  <motion.div
                    id="draft-container"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-[#E6E0D9] text-left flex flex-col gap-4 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[#8BA88E] font-bold uppercase tracking-widest text-xs block">Active Draft</span>
                        <h3 className="text-lg font-bold text-[#2D2A26] mt-1">Review & Save Entry</h3>
                      </div>
                      <button
                        onClick={() => setDraftText("")}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                      >
                        Discard
                      </button>
                    </div>

                    <p className="text-xs text-[#7D766F] italic">
                      Tip: You can edit or rewrite this transcript directly before saving.
                    </p>

                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      className="w-full min-h-[120px] p-4 bg-[#F9F6F2] border border-[#E6E0D9] rounded-2xl text-sm text-[#2D2A26] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#8BA88E]/30 focus:border-[#8BA88E] resize-y"
                    />

                    {processError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{processError}</span>
                      </div>
                    )}

                    <div className="mt-2">
                      <button
                        onClick={handleSaveToSheet}
                        disabled={isProcessing || !draftText.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-[#8BA88E] hover:bg-[#7A997D] text-white font-bold py-3 px-6 rounded-2xl shadow-md shadow-[#8BA88E]/20 transition-all disabled:opacity-50 touch-none text-sm"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>{isProcessing ? "Processing entry..." : "Save with Gemini summary"}</span>
                      </button>
                    </div>

                    {/* Progress Overlay during save workflow */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 z-10 transition-all">
                        <div className="w-12 h-12 bg-[#8BA88E]/10 rounded-2xl flex items-center justify-center text-[#8BA88E] mb-4">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                        <p className="font-bold text-[#2D2A26] text-center">Saving Entry</p>
                        <p className="text-xs text-[#7D766F] text-center mt-1 animate-pulse">
                          {processStep || "Structuring content..."}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Right Side: Recent Summaries History */}
            <section className="lg:col-span-5 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#2D2A26] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#8BA88E]" />
                  Recent Summaries
                </h3>
                {spreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#8BA88E] hover:text-[#5C7A5E] flex items-center gap-1 hover:underline touch-none"
                  >
                    <Sheet className="w-3.5 h-3.5" /> View Spreadsheet
                  </a>
                )}
              </div>

              {/* History Container */}
              <div className="flex flex-col gap-4">
                {historyLoading ? (
                  <div className="bg-white p-12 rounded-3xl border border-[#E6E0D9] flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#8BA88E] mb-3" />
                    <p className="text-sm font-medium text-[#2D2A26]">Fetching entries...</p>
                    <p className="text-xs text-[#7D766F] mt-1">Connecting to your Google Sheet</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl border border-[#E6E0D9] flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-[#E6D5C3]/30 rounded-2xl flex items-center justify-center text-[#7D766F] mb-3">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-[#2D2A26]">No entries synced yet</p>
                    <p className="text-xs text-[#7D766F] mt-1 max-w-xs mx-auto">
                      Your recordings or manual text will be automatically summarized and appended as rows.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
                    {history.map((row, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-[#E6E0D9] hover:shadow-md transition-all flex flex-col gap-3 group text-left"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-[#7D766F] bg-[#F0EDE9] px-2 py-1 rounded tracking-wider">
                            {row.timestamp}
                          </span>
                          <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <div className="w-1.5 h-1.5 bg-[#8BA88E] rounded-full"></div>
                            <div className="w-1.5 h-1.5 bg-[#D9C5B2] rounded-full"></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 mb-1 text-[#8BA88E]">
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            <h4 className="font-bold text-xs uppercase tracking-wider">Gemini Summary</h4>
                          </div>
                          <p className="text-sm font-semibold text-[#2D2A26] leading-relaxed">
                            {row.summary}
                          </p>
                        </div>

                        <div className="border-t border-[#E6E0D9]/60 pt-2.5">
                          <span className="text-[10px] font-bold text-[#7D766F] uppercase tracking-wider block mb-1">
                            Original Transcript
                          </span>
                          <p className="text-xs text-[#7D766F] line-clamp-3 leading-relaxed whitespace-pre-wrap italic">
                            "{row.transcript}"
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Connection Status Box */}
              {spreadsheetId && (
                <div className="mt-auto p-4 bg-[#E6D5C3]/30 rounded-2xl border border-[#D9C5B2]/40 text-center">
                  <p className="text-[10px] text-[#7D766F] uppercase tracking-widest font-bold">Auto-Save Active</p>
                  <p className="text-xs text-[#2D2A26] mt-1 break-all px-2 font-mono">
                    Sheet ID: {spreadsheetId.slice(0, 8)}...{spreadsheetId.slice(-8)}
                  </p>
                </div>
              )}
            </section>
          </main>
        </>
      )}
    </div>
  );
}
