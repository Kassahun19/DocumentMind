import React, { useState } from 'react';
import { 
  CreditCard, Sparkles, Check, ArrowRight, CornerDownRight, 
  ExternalLink, Send, ShieldAlert, BadgePercent, Coins, HelpCircle,
  Upload, X, FileText
} from 'lucide-react';
import { User } from '../types';

interface BillingTabProps {
  user: User;
  authToken: string;
  onRefreshUser: () => void;
}

export default function BillingTab({ user, authToken, onRefreshUser }: BillingTabProps) {
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'premium'>('basic');
  const [txId, setTxId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('Receipt file size is too large (max 10MB limit).');
        return;
      }
      setReceiptFile(file);
      setError('');
      
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptBase64(reader.result as string);
      };
      reader.onerror = () => {
        setError('Failed to process image file.');
      };
      reader.readAsDataURL(file);
    }
  };

  // Plans details mapped
  const plans = [
    {
      id: 'basic' as const,
      name: 'Basic',
      price: 'ETB 100',
      period: 'per month',
      tagline: 'Ideal for short-term projects and research assignments.',
      features: [
        'Get access to 1 month of unrestricted 50 Prompts',
        'Only one PDF upload on the Document Vault',
        'Semantic Embeddings indexing',
        'Accurate Q&A with grounded text citations'
      ],
      linkText: 'Go Basic',
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      price: 'ETB 500',
      period: 'per year',
      tagline: 'Supercharge your daily studying & academic inquiries',
      features: [
        'Get access to 1 full year of unrestricted 600 Prompts (limited only to 50 prompts/month for 12 months, monthly basis)',
        'Two PDF uploads on the Document Vault',
        'Faster token generation processing',
        'Interactive questions file PDF processor'
      ],
      linkText: 'Go Pro',
      popular: true,
    },
    {
      id: 'premium' as const,
      name: 'Premium',
      price: 'ETB 1000',
      period: 'for ever',
      tagline: 'Ultimate lifelong scholarly setup. One-time payment.',
      features: [
        'Get access to lifetime of unlimited Prompts',
        'Three or more PDF uploads on the Document Vault',
        'Unrestricted features & zero latency throttling',
        'Highest priority indexing vector pipelines'
      ],
      linkText: 'Go Premium',
    }
  ];

  const handleUpgradeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txId.trim()) {
      setError('Please provide a valid transaction reference or payment code.');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          plan: selectedPlan,
          txId: txId.trim(),
          paymentReceiptName: receiptFile?.name || null,
          paymentReceiptData: receiptBase64 || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit billing proof');
      }

      setSuccess('Your upgrade receipt request has been submitted successfully! An admin will approve your payment shortly.');
      setTxId('');
      setReceiptFile(null);
      setReceiptBase64(null);
      onRefreshUser(); // Sync central App.tsx state with new pending properties
    } catch (err: any) {
      setError(err.message || 'Billing exception occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const getPlanDetails = (id: string) => {
    return plans.find(p => p.id === id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 select-none">
      
      {/* 1. Account Subscription Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-400" />
            Billing &amp; Subscription Portal
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor prompt counts, pick packages, and complete transaction registrations.
          </p>
        </div>

        {/* Dynamic status pill */}
        <div className="flex flex-wrap gap-2">
          <div className="px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Current Tier</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              {user.tier || 'free'}
            </p>
          </div>

          <div className="px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Quota Used</p>
            <p className="text-sm font-bold text-slate-200 mt-0.5">
              {user.promptCount || 0} / <span className="text-indigo-400">5</span> Free Prompts
            </p>
          </div>

          <div className="px-4 py-2 bg-slate-950 border border-slate-900 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Payment Status</p>
            <p className="text-sm font-bold mt-0.5 uppercase">
              {user.paymentStatus === 'approved' && (
                <span className="text-emerald-400">● APPROVED</span>
              )}
              {user.paymentStatus === 'pending' && (
                <span className="text-amber-400 animate-pulse">● PENDING APPROVAL</span>
              )}
              {(user.paymentStatus === 'none' || !user.paymentStatus) && (
                <span className="text-slate-500">● NO PAYMENT</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Three Plans Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const isSelected = selectedPlan === p.id;
          return (
            <div 
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              className={`relative p-6 rounded-2xl cursor-pointer border transition-all flex flex-col justify-between ${
                p.popular 
                  ? 'bg-slate-900/40 border-indigo-505/40 hover:border-indigo-500/60 shadow-[0_0_20px_-5px_rgba(99,102,241,0.15)]' 
                  : 'bg-slate-950/60 border-slate-900 hover:border-slate-800'
              } ${isSelected ? 'ring-2 ring-indigo-500 border-transparent bg-slate-950' : ''}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] font-extrabold tracking-widest bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 rounded-full shadow-lg uppercase">
                  Most Popular
                </span>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 h-8">{p.tagline}</p>
                </div>

                <div className="py-2 border-y border-slate-900">
                  <span className="text-2xl font-extrabold text-slate-100">{p.price}</span>
                  <span className="text-[11px] text-slate-500 font-medium ml-1.5">{p.period}</span>
                </div>

                {/* Features list */}
                <ul className="space-y-2.5 text-xs text-slate-400">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Secure payment link Button */}
              <div className="mt-8 pt-4 border-t border-slate-900">
                <a 
                  href="https://ye-buna.com/kassahunmulatu" 
                  target="_blank" 
                  referrerPolicy="no-referrer"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-bold text-slate-150 border border-slate-800 hover:border-slate-705 bg-slate-950 hover:bg-slate-900 hover:text-white transition rounded-xl"
                  title="Make safe payment on Ye-Buna gateway"
                  onClick={(e) => e.stopPropagation()} // Avoid triggering parent plan selection card
                >
                  {p.linkText} <ExternalLink className="h-3 w-3 text-cyan-400" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Transaction Submission Proof Interface */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 bg-slate-950 border border-slate-900 rounded-2xl p-6 md:p-8">
        
        {/* Left column explanation */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-200 tracking-tight flex items-center gap-2">
              <Coins className="h-5 w-5 text-indigo-400" />
              Upgrade Verification
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complete your payment using either our digital external checkout links or the direct manual bank deposit options listed below. Once you complete the transaction, take a screenshot of the confirmation SMS or bank receipt and submit the proof form to reactivate your plan.
            </p>
          </div>

          {/* Majestic Manual Bank Account Details Box */}
          <div className="p-4 rounded-xl border border-indigo-505 border-indigo-500/20 bg-indigo-500/5 space-y-3">
            <div className="border-b border-indigo-500/10 pb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Manual Wire Options</span>
              <h4 className="text-xs font-bold text-slate-350 mt-1">Full Beneficiary Name:</h4>
              <p className="text-xs font-semibold text-white select-all">Kassahun Mulatu Kebede</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-slate-950/70 p-2 border border-slate-900 rounded-lg">
                <span className="text-slate-400 text-[11px]">Commercial Bank of Ethiopia (CBE)</span>
                <span className="font-mono text-cyan-400 font-bold select-all">1000183217198</span>
              </div>
              
              <div className="flex justify-between items-center bg-slate-950/70 p-2 border border-slate-900 rounded-lg">
                <span className="text-slate-400 text-[11px]">Bank of Abyssinia (BOA)</span>
                <span className="font-mono text-cyan-400 font-bold select-all">32419186</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/70 p-2 border border-slate-900 rounded-lg">
                <span className="text-slate-400 text-[11px]">Bunna Bank (BB)</span>
                <span className="font-mono text-cyan-400 font-bold select-all">3609501002452</span>
              </div>

              <div className="flex justify-between items-center bg-indigo-500/10 p-2 border border-indigo-500/10 rounded-lg">
                <span className="text-slate-300 text-[11px] font-bold">Telebirr (Mobile)</span>
                <span className="font-mono text-indigo-300 font-bold select-all">0915508167</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic leading-snug">
              Note: Capture a screenshot of your transfer confirmation message or paper receipt, then upload it to your document proof below.
            </p>
          </div>

          <div className="space-y-3.5 text-xs text-slate-400 pl-1">
            <div className="flex gap-2.5">
              <span className="h-5 w-5 rounded bg-slate-900 text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-800">
                1
              </span>
              <p>
                Transfer the exact plan price fee in ETB (ETB 100, ETB 500, or ETB 1000).
              </p>
            </div>

            <div className="flex gap-2.5">
              <span className="h-5 w-5 rounded bg-slate-900 text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-800">
                2
              </span>
              <p>
                Save your Transfer Confirmation details. Max proof attachment size is <strong className="text-indigo-400">10 MB</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Right column form */}
        <div className="md:col-span-3">
          {user.paymentStatus === 'pending' ? (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3.5 h-full flex flex-col justify-center items-center">
              <ShieldAlert className="h-8 w-8 text-amber-400 animate-pulse" />
              <div>
                <h4 className="font-bold text-amber-400 text-sm">Upgrade Under Secure Review</h4>
                <div className="text-xs text-slate-400 mt-2 max-w-md mx-auto space-y-2">
                  <p>
                    You requested an upgrade to <strong className="text-slate-200 uppercase">{user.paymentPlanRequested}</strong>. 
                  </p>
                  <p>
                    Our team is cross-checking reference proof <strong className="text-slate-200 font-mono select-all">{user.paymentTxId}</strong>.
                  </p>
                  {user.paymentReceiptName && (
                    <div className="p-2 border border-slate-800 bg-slate-950/70 rounded-xl flex items-center justify-center gap-2 text-indigo-300">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[170px] text-[11px] font-semibold">{user.paymentReceiptName}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    An admin will approve this within a few hours. Thank you for your patience!
                  </p>
                </div>
              </div>
            </div>
          ) : user.paymentStatus === 'approved' ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3.5 h-full flex flex-col justify-center items-center">
              <Check className="h-8 w-8 text-emerald-400" />
              <div>
                <h4 className="font-bold text-emerald-400 text-sm">Premium Account Active</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Your billing transaction log has has been securely verified. 
                  Enjoy unrestricted lifetime database queries under the premium layout!
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpgradeRequest} className="space-y-5 h-full flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1.5 uppercase tracking-wider text-[10px]">
                    1. Target Package Selection
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {plans.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => setSelectedPlan(pl.id)}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition cursor-pointer ${
                          selectedPlan === pl.id
                            ? 'bg-indigo-505/10 border-indigo-500 text-indigo-400'
                            : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-350'
                        }`}
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      2. Transaction Reference/ID
                    </label>
                    <span className="text-[10px] text-slate-505 font-medium">
                      Price: <strong className="text-indigo-400">{getPlanDetails(selectedPlan)?.price}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter receipt ID, reference, or bank confirm code..."
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-650 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1.5 uppercase tracking-wider text-[10px]">
                    3. Upload Receipt File (Optional)
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="receipt-file-input"
                    />
                    <label
                      htmlFor="receipt-file-input"
                      className="w-full py-4 px-4 bg-slate-950/50 hover:bg-slate-950 border border-dashed border-slate-850 hover:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition text-center text-xs"
                    >
                      {receiptFile ? (
                        <div className="flex items-center gap-2 text-indigo-400">
                          <FileText className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                          <span className="font-semibold text-slate-200 max-w-[180px] truncate">{receiptFile.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setReceiptFile(null);
                              setReceiptBase64(null);
                            }}
                            className="p-1 hover:bg-slate-900 hover:text-red-400 rounded-full transition cursor-pointer shrink-0"
                            title="Remove attachment"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-4.5 w-4.5 text-slate-500 group-hover:text-indigo-400 transition" />
                          <p className="text-[11px] text-slate-400">
                            Upload payment screenshot / receipt (Image or PDF)
                          </p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 font-medium py-1">{error}</p>
              )}

              {success && (
                <p className="text-xs text-emerald-400 font-medium py-1">{success}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !txId.trim()}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition hover:opacity-95 text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <Send className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" />
                {submitting ? 'Transmitting Reference...' : 'Submit Upgrade Proof'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
