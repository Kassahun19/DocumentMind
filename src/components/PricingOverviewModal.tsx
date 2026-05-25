import React from 'react';
import { Check, X, Star, Coins, Sparkles, ExternalLink } from 'lucide-react';

interface PricingOverviewModalProps {
  onClose: () => void;
  onGetStarted: () => void;
}

export default function PricingOverviewModal({ onClose, onGetStarted }: PricingOverviewModalProps) {
  const plans = [
    {
      name: 'Basic',
      price: 'ETB 100',
      period: '1 month access',
      tagline: 'Ideal for short-term projects and research assignments.',
      features: [
        'Access to 1 month of unrestricted 50 Prompts',
        'Upload dense PDFs in the Document Vault',
        'Semantic indexing with text similarity matching',
        'Precise AI answers with grounded citations'
      ],
      color: 'border-slate-800 bg-slate-950/40 text-slate-300'
    },
    {
      name: 'Pro',
      price: 'ETB 500',
      period: '1 year access',
      tagline: 'Supercharge your daily studying & academic inquiries',
      features: [
        'Access to 1 full year of unrestricted 600 Prompts (limited only to 50 prompts/month for 12 months, monthly basis)',
        'Up to some dense PDF uploads simultaneously',
        'Faster token generation processing',
        'Interactive questions file PDF processor'
      ],
      popular: true,
      color: 'border-indigo-500/30 bg-indigo-500/5 text-slate-100'
    },
    {
      name: 'Premium',
      price: 'ETB 1000',
      period: 'lifetime access',
      tagline: 'Ultimate lifelong scholarly setup. One-time payment.',
      features: [
        'Access to lifetime of unlimited Prompts',
        'Three or more PDF uploads on the Document Vault',
        'Unrestricted features & zero latency throttling',
        'Highest priority indexing vector pipelines'
      ],
      color: 'border-cyan-500/30 bg-cyan-500/5 text-slate-100'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
      <div 
        className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-5xl overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2 text-indigo-400">
            <Coins className="h-5 w-5" />
            <h3 className="text-sm font-bold text-slate-205 text-slate-200">DocuMind AI Subscription Plans</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-8">
          <div>
            <h4 className="text-center text-lg md:text-xl font-bold text-slate-200 tracking-tight">
              Invest in Speed, Clarity, and Precision
            </h4>
            <p className="text-center text-slate-500 text-xs mt-1.5 max-w-md mx-auto leading-relaxed">
              No continuous auto-renewals or hidden billing. Pay secure manual transfers directly using any prominent Ethiopian banking institution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div 
                key={p.name}
                className={`p-6 rounded-2xl border flex flex-col justify-between space-y-5 relative ${p.color}`}
              >
                {p.popular && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-indigo-500 text-slate-950 text-[9px] font-bold uppercase tracking-wider">
                    Most Popular
                  </span>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h5 className="text-sm font-bold uppercase font-mono tracking-wider text-slate-400">{p.name}</h5>
                    <p className="text-2xl font-bold text-slate-100 mt-1">{p.price}</p>
                    <p className="text-[10px] text-slate-450 text-slate-550 italic font-medium">{p.period}</p>
                  </div>
                  
                  <p className="text-xs text-slate-400 leading-normal">{p.tagline}</p>

                  <ul className="space-y-2 text-xs text-slate-450">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex gap-2.5 items-start">
                        <Check className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <span className="leading-snug text-[11px] text-slate-300 font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onGetStarted();
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 select-none cursor-pointer ${
                    p.popular
                      ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 hover:from-indigo-600 hover:to-cyan-600'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <span>Select {p.name}</span>
                </button>
              </div>
            ))}
          </div>

          {/* Manual Checkout Options summary box */}
          <div className="p-5 rounded-2xl border border-indigo-500/10 bg-indigo-500/5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 font-mono">Manual Payment Supported</span>
              <h5 className="text-xs font-bold text-slate-200">Account Holder Name: Kassahun Mulatu Kebede</h5>
              <p className="text-slate-450 text-[11px] leading-relaxed">
                You can perform a direct bank deposit using any of the available options: CBE Account (1000183217198) or Telebirr (0915508167). Capture a screenshot of your transfer slip and log into your vault to upload the receipts for review.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
              <button
                onClick={() => {
                  onClose();
                  onGetStarted();
                }}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 font-bold text-xs cursor-pointer select-none transition"
              >
                Log In to Upgrade
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
