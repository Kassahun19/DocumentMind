import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface ContactFormProps {
  onClose?: () => void;
}

export default function ContactForm({ onClose }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('Please provide values for all input fields.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to file credentials inquiry.');
      }

      setSuccess('Your secure feedback message has been transmitted successfully to Administrator kmulatu21@gmail.com! Thank you.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Error communicating with security network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left select-text">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-shake">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="space-y-4 py-2 text-center">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 animate-bounce mt-0.5" />
            <p className="leading-relaxed text-left">{success}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-md w-full select-none cursor-pointer"
            >
              Close Inquiry Console
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 text-slate-400">Your Full Name</label>
              <input
                type="text"
                placeholder="CEO mulatu client"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 px-3.5 py-2 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 text-slate-400">Your Secure Email</label>
              <input
                type="email"
                placeholder="client@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 px-3.5 py-2 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 text-slate-400">Message Subject</label>
            <input
              type="text"
              placeholder="Inquiry about Billing upgrade or tier level"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-850 px-3.5 py-2 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450 text-slate-400">Enter Detailed Message</label>
            <textarea
              placeholder="Give details about your transaction ID or custom requirements..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full bg-slate-950/80 border border-slate-850 px-3.5 py-2.5 rounded-xl text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition leading-relaxed resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 font-bold text-slate-950 text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer select-none"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{loading ? 'Transmitting to admin...' : 'Dispatch Message securely'}</span>
          </button>
        </>
      )}
    </form>
  );
}
