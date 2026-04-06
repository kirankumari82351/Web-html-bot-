import { Bot, FileText, Code, CheckCircle2, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden"
      >
        <div className="bg-slate-900 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:20px_20px]"></div>
          </div>
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-block p-4 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm"
          >
            <Bot size={48} className="text-blue-400" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">HTML ↔ TXT Converter</h1>
          <p className="text-slate-400 mt-2">Telegram Bot is Active & Running</p>
        </div>

        <div className="p-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              How to use
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="text-blue-500" size={20} />
                  <h3 className="font-semibold text-slate-800">TXT to HTML</h3>
                </div>
                <p className="text-sm text-slate-600">Send any .txt file to the bot. It will automatically convert it to a styled HTML dashboard.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <Code className="text-purple-500" size={20} />
                  <h3 className="font-semibold text-slate-800">HTML to TXT</h3>
                </div>
                <p className="text-sm text-slate-600">Send /h2t command, then send your .html file to extract the links back to text format.</p>
              </div>
            </div>
          </section>

          <section className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-500 rounded-lg text-white">
                <HelpCircle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Bot Commands</h3>
                <ul className="mt-2 space-y-1 text-sm text-blue-700">
                  <li><code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">/start</code> - Initialize the bot</li>
                  <li><code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">/help</code> - View detailed format guide</li>
                  <li><code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">/t2h</code> - Switch to TXT to HTML mode</li>
                  <li><code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">/h2t</code> - Switch to HTML to TXT mode</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Running on Cloud Run • Port 3000 • Node.js
          </p>
        </div>
      </motion.div>
    </div>
  );
}
