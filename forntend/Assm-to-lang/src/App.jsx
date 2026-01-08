import TranslationInterface from "./components/TranslationInterface.jsx";

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3 text-sm">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs text-emerald-950">
              AST
            </span>
            <span>AI Powered - Assamese-to-English Speech Translator</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#home" className="text-slate-200 hover:text-white">
              Home
            </a>
            {/* <a href="#history" className="text-slate-200 hover:text-white">
              History
            </a>
            <a href="#settings" className="text-slate-200 hover:text-white">
              Settings
            </a>
            <button
              type="button"
              className="flex items-center rounded-full border border-slate-600 bg-slate-800 px-1 py-0.5"
            >
              <span className="sr-only">Toggle theme (visual only)</span>
              <span className="h-4 w-4 rounded-full bg-slate-200" />
            </button> */}
          </div>
        </nav>
      </header>

      <main
        id="home"
        className="flex-1 max-w-6xl mx-auto px-4 py-10 flex flex-col gap-8"
      >
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-slate-50">
            Speak in Assamese. Hear it in English.
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Tap the mic, speak naturally, and let AI translate your voice
            instantly.
          </p>
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <TranslationInterface />
        </div>
      </main>

      <footer
        id="settings"
        className="border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400"
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2025 AI Powered - Assamese-to-English Speech Translator</span>
          <span>Contact: assamese-speech-translator@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
