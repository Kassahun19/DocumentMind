import React, { useState, useEffect } from 'react';
import { 
  Users, Check, X, Shield, RefreshCw, AlertCircle, Sparkles, 
  Search, Terminal, Crown, CheckCircle2, Star, Coins, FileText,
  Eye, Zap, ShieldAlert, Award, Hash, BarChart3, HelpCircle
} from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  promptCount: number;
  tier: 'free' | 'basic' | 'pro' | 'premium';
  paymentStatus: 'none' | 'pending' | 'approved';
  paymentPlanRequested: 'basic' | 'pro' | 'premium' | null;
  paymentTxId: string | null;
  paymentDate: string | null;
  paymentReceiptName?: string | null;
  paymentReceiptData?: string | null;
}

interface AdminMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

interface AdminTabProps {
  authToken: string;
  currentUserEmail: string;
  onRefreshCurrentUser: () => void;
}

type FilterType = 'all' | 'pending' | 'premium' | 'free';

export default function AdminTab({ authToken, currentUserEmail, onRefreshCurrentUser }: AdminTabProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'messages'>('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Modal preview states for receipt proof
  const [previewReceipt, setPreviewReceipt] = useState<{ name: string; data: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch user list');
      }
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Error loading security logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/admin/messages', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching admin messages:', err);
    }
  };

  const handleSyncData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchMessages()]);
    setLoading(false);
  };

  useEffect(() => {
    handleSyncData();
  }, [authToken]);

  // General field updater to make the admin panel extremely flexible
  const handleUpdateUser = async (userId: string, body: any, successMsgDetail: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          userId,
          ...body
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user property');
      }
      setSuccessMsg(`Admin change succeeded: ${successMsgDetail}`);
      fetchUsers();
      onRefreshCurrentUser(); // Sync high level user state
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Quick Action triggers
  const handleApprovePayment = (userId: string, requestedPlan: 'basic' | 'pro' | 'premium' | null) => {
    handleUpdateUser(userId, { approved: true, tier: requestedPlan }, 'Subscribed plan approved!');
  };

  const handleDeclinePayment = (userId: string) => {
    handleUpdateUser(userId, { approved: false }, 'Pending upgrade declined & reset.');
  };

  const handleRoleToggle = (userId: string, currentRole: 'user' | 'admin') => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    handleUpdateUser(userId, { role: newRole }, `Role adjusted to ${newRole.toUpperCase()}!`);
  };

  const handleTierChange = (userId: string, newTier: 'free' | 'basic' | 'pro' | 'premium') => {
    handleUpdateUser(userId, { tier: newTier }, `Client plan changed to ${newTier.toUpperCase()}`);
  };

  const handlePromptReset = (userId: string) => {
    handleUpdateUser(userId, { promptCount: 0 }, 'Prompt logs reset back to zero.');
  };

  const handlePromptAdjust = (userId: string, newCount: number) => {
    if (newCount < 0) return;
    handleUpdateUser(userId, { promptCount: newCount }, `Prompt total updated to ${newCount}.`);
  };

  // Computations for premium stats cards
  const totalUsers = users.length;
  const pendingCount = users.filter(u => u.paymentStatus === 'pending').length;
  const premiumCount = users.filter(u => u.tier !== 'free').length;
  const totalSystemQueries = users.reduce((acc, curr) => acc + (curr.promptCount || 0), 0);

  // Apply filters and searches
  const filteredUsers = users.filter(u => {
    // 1. Search Query
    const query = searchQuery.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(query) || 
                          u.email.toLowerCase().includes(query) ||
                          (u.paymentTxId && u.paymentTxId.toLowerCase().includes(query));
    
    if (!matchesSearch) return false;

    // 2. Active Tab Filters
    if (activeFilter === 'pending') return u.paymentStatus === 'pending';
    if (activeFilter === 'premium') return u.tier !== 'free';
    if (activeFilter === 'free') return u.tier === 'free';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Information Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 md:p-6 rounded-2xl bg-slate-900/40 border border-slate-850 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" />
              Administrative Command Center
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase tracking-wider border border-amber-500/20">
              System Level
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Override active tier levels, manage quotas, approve bank screenshots, and configure credentials instantly.
          </p>
        </div>

        <button
          onClick={handleSyncData}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-950 hover:from-slate-850 hover:to-slate-900 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-800 cursor-pointer w-full sm:w-auto shrink-0 select-none shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync Database Values
        </button>
      </div>

      {/* 2. Key Metrics Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Accounts</p>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-200 mt-2">{totalUsers}</p>
          <div className="text-[10px] text-slate-500 mt-1">Registered clients in memory</div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl relative overflow-hidden">
          {pendingCount > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-400 animate-ping" />
          )}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Review Queue</p>
            <ShieldAlert className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-200 mt-2">
            {pendingCount} <span className="text-xs font-normal text-slate-500">pending</span>
          </p>
          <div className="text-[10px] text-amber-500/80 font-medium mt-1">
            {pendingCount > 0 ? 'Needs immediate approval' : 'All upgraded requests clear'}
          </div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Paid Members</p>
            <Star className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-200 mt-2">
            {premiumCount} <span className="text-xs font-normal text-slate-500">active</span>
          </p>
          <div className="text-[10px] text-slate-500 mt-1">Basic, Pro, or Premium partners</div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total AI Inquiries</p>
            <BarChart3 className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-200 mt-2">{totalSystemQueries}</p>
          <div className="text-[10px] text-slate-500 mt-1">Queries processed successfully</div>
        </div>
      </div>

      {/* Admin Module Sub-Tabs selection */}
      <div className="flex border-b border-slate-900 gap-6">
        <button
          onClick={() => setAdminSubTab('users')}
          className={`pb-3 text-xs font-bold tracking-wider uppercase border-b-2 px-1 transition cursor-pointer select-none ${
            adminSubTab === 'users'
              ? 'border-indigo-500 text-slate-100'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          User Accounts &amp; Payments ({users.length})
        </button>
        <button
          onClick={() => setAdminSubTab('messages')}
          className={`pb-3 text-xs font-bold tracking-wider uppercase border-b-2 px-1 transition relative cursor-pointer select-none ${
            adminSubTab === 'messages'
              ? 'border-indigo-500 text-slate-100'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Contact Messages Received ({messages.length})
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-indigo-500 text-slate-950 text-[8px] font-extrabold font-mono">
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 animate-bounce" />
          <span>{successMsg}</span>
        </div>
      )}

      {adminSubTab === 'users' ? (
        <>
          {/* 3. Filtering Controls & Quick-Search Grid */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 rounded-2xl bg-slate-900/20 border border-slate-900">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Accounts
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center gap-1.5 cursor-pointer ${
              activeFilter === 'pending'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            Action Required
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 ml-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold shrink-0">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveFilter('premium')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center gap-1 cursor-pointer ${
              activeFilter === 'premium'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow'
                : 'text-slate-400 hover:text-cyan-450'
            }`}
          >
            Premium Clients
          </button>
          <button
            onClick={() => setActiveFilter('free')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
              activeFilter === 'free'
                ? 'bg-slate-850 text-slate-350 border border-slate-800 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Free Plan Users
          </button>
        </div>

        <div className="relative flex items-center gap-2 p-1.5 bg-slate-950 border border-slate-900 rounded-xl md:max-w-xs w-full">
          <Search className="h-3.5 w-3.5 text-slate-500 ml-2" />
          <input
            type="text"
            placeholder="Search credentials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-slate-300 text-xs placeholder-slate-650 focus:outline-none w-full py-0.5"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 px-1.5 bg-slate-900 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 4. Table view */}
      <div className="bg-slate-955 border border-slate-900 rounded-2xl overflow-hidden bg-slate-950/40 backdrop-blur-md">
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-16 text-center text-slate-505 text-xs space-y-3">
              <Users className="h-10 w-10 text-slate-800 mx-auto" />
              <p className="text-slate-400 font-medium">No matching client entries found.</p>
              <p className="text-[11px] text-slate-600 max-w-sm mx-auto">Try selecting another filter level above or revising your text keywords.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs sm:min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 font-semibold bg-slate-950 uppercase tracking-widest text-[9px] font-mono">
                  <th className="p-4 pl-6">Registered Identity</th>
                  <th className="p-4">Requested Upgrade Plan</th>
                  <th className="p-4">Active Plan (Tier Indicator)</th>
                  <th className="p-4">Prompt Count (Requests)</th>
                  <th className="p-4">Reference/Proof Receipt</th>
                  <th className="p-4 pr-6 text-right">Instant Management Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 font-sans">
                {filteredUsers.map((u) => {
                  const isPending = u.paymentStatus === 'pending';
                  const isCurrent = u.email === currentUserEmail;

                  return (
                    <tr key={u.id} className="hover:bg-slate-900/20 transition group">
                      {/* Identity Details */}
                      <td className="p-4 pl-6">
                        <div>
                          <p className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                            {u.name}
                            {u.role === 'admin' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/15">
                                <Crown className="h-2.5 w-2.5" /> ADMIN
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-505 font-mono text-slate-450 mt-0.5 group-hover:text-slate-300 transition">{u.email}</p>
                          <p className="text-[9px] text-slate-600 font-mono mt-1">ID: {u.id}</p>
                        </div>
                      </td>

                      {/* Requested Upgrade */}
                      <td className="p-4">
                        {u.paymentPlanRequested ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-indigo-400 bg-indigo-501/10 px-1.2 py-0.5 rounded border border-indigo-500/15">
                              <Zap className="h-3 w-3 text-indigo-400" /> {u.paymentPlanRequested}
                            </span>
                            {isPending && (
                              <span className="block text-[10px] font-bold text-amber-400 animate-pulse">
                                Under Review
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-700 font-mono">—</span>
                        )}
                      </td>

                      {/* Active Tier Level - Direct selector upgrade option to make it fully practical */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={u.tier || 'free'}
                            onChange={(e) => handleTierChange(u.id, e.target.value as any)}
                            className={`px-2 py-1 rounded bg-slate-950 border text-[11px] font-bold transition focus:outline-none focus:border-indigo-500 ${
                              u.tier === 'premium' ? 'text-purple-400 border-purple-900' :
                              u.tier === 'pro' ? 'text-cyan-400 border-cyan-900' :
                              u.tier === 'basic' ? 'text-indigo-400 border-indigo-900' :
                              'text-slate-450 border-slate-800'
                            }`}
                          >
                            <option value="free" className="text-slate-350">FREE</option>
                            <option value="basic" className="text-indigo-400">BASIC</option>
                            <option value="pro" className="text-cyan-400">PRO</option>
                            <option value="premium" className="text-purple-400">PREMIUM</option>
                          </select>
                        </div>
                      </td>

                      {/* Prompt Q&A logs - Level controller */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-col">
                            <input
                              type="number"
                              value={u.promptCount}
                              onChange={(e) => handlePromptAdjust(u.id, parseInt(e.target.value) || 0)}
                              className="w-14 px-1.5 py-0.5 bg-slate-950 text-center border border-slate-850 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                              min="0"
                              title="Override prompts directly"
                            />
                            {u.tier === 'free' && (
                              <span className="text-[9px] text-slate-500 text-center mt-0.5">
                                limit: 5
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => handlePromptAdjust(u.id, u.promptCount + 5)}
                              className="px-1 py-0.2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded text-[9px] cursor-pointer"
                              title="Add 5 Credits"
                            >
                              +5
                            </button>
                            <button
                              onClick={() => handlePromptReset(u.id)}
                              className="px-1 py-0.2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 rounded text-[9px] font-bold cursor-pointer"
                              title="Reset prompts to zero"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Receipts & Screen captures uploaded */}
                      <td className="p-4">
                        {u.paymentTxId ? (
                          <div className="max-w-[210px] space-y-1 bg-slate-950/70 p-2 rounded-xl border border-slate-900">
                            <div className="flex items-center justify-between gap-2.5">
                              <span className="font-mono text-[10px] text-slate-350 font-bold select-all truncate">
                                {u.paymentTxId}
                              </span>
                            </div>
                            {u.paymentDate && (
                              <p className="text-[9px] text-slate-505 font-mono text-slate-500">
                                {new Date(u.paymentDate).toLocaleString()}
                              </p>
                            )}

                            {/* View & Download Actions */}
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-900 flex-wrap">
                              {u.paymentReceiptName && u.paymentReceiptData ? (
                                <>
                                  {/* Direct Image Viewer triggers */}
                                  <button
                                    onClick={() => setPreviewReceipt({ 
                                      name: u.paymentReceiptName || 'receipt', 
                                      data: u.paymentReceiptData || '' 
                                    })}
                                    className="inline-flex items-center gap-1 px-2 py-0.8 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/15 text-[9px] font-semibold cursor-pointer transition select-none tracking-wide"
                                    title="View receipt proof inline"
                                  >
                                    <Eye className="h-3 w-3 shrink-0" />
                                    <span>Preview Proof</span>
                                  </button>

                                  <a
                                    href={u.paymentReceiptData}
                                    download={u.paymentReceiptName}
                                    className="inline-flex items-center gap-1 px-2 py-0.8 rounded text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-850 hover:bg-slate-800 hover:border-slate-700 text-[9px] font-semibold cursor-pointer transition select-none"
                                    title="Download receipt to local storage"
                                  >
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span>Download</span>
                                  </a>
                                </>
                              ) : (
                                <p className="text-[9px] text-slate-650 italic">Receipt reference only</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-700 font-mono">—</span>
                        )}
                      </td>

                      {/* Managing payment review status & permissions */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2 text-xs flex-wrap">
                          {/* If review state is pending, show quick Approve or Reject buttons */}
                          {isPending && (
                            <div className="flex items-center gap-1.5 bg-indigo-500/5 p-1 rounded-xl border border-indigo-500/10 shrink-0">
                              <button
                                onClick={() => handleApprovePayment(u.id, u.paymentPlanRequested)}
                                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-500 hover:text-slate-950 text-emerald-400 rounded-lg flex items-center gap-1 transition cursor-pointer text-[10px] font-bold"
                                title="Approve manual upgrade request"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => handleDeclinePayment(u.id)}
                                className="px-2.5 py-1 bg-red-400/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 hover:text-white text-red-400 rounded-lg flex items-center gap-1 transition cursor-pointer text-[10px] font-bold"
                                title="Reject and reset client request references"
                              >
                                <X className="h-3.5 w-3.5" /> Decline
                              </button>
                            </div>
                          )}

                          {/* Reset approved payment status manually back to free */}
                          {u.paymentStatus === 'approved' && (
                            <button
                              onClick={() => handleUpdateUser(u.id, { approved: false }, 'Upgrade plan status revoked.')}
                              className="px-2 py-1 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 hover:border-red-900/30 text-[10px] font-semibold rounded-lg transition"
                            >
                              Revoke Sub
                            </button>
                          )}

                          {/* Toggle active roles on accounts */}
                          <button
                            onClick={() => handleRoleToggle(u.id, u.role)}
                            disabled={isCurrent}
                            className={`px-2 py-1 text-[10px] font-semibold rounded-lg border transition shrink-0 ${
                              isCurrent 
                                ? 'bg-slate-950/50 border-slate-900/60 text-slate-700 cursor-not-allowed'
                                : u.role === 'admin'
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/15 hover:border-amber-500/25'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-450 border-slate-850 hover:text-slate-200 hover:border-slate-750 font-medium'
                            }`}
                            title={isCurrent ? "Self protection: Admin cannot demote themselves" : "Adjust administrator status"}
                          >
                            {u.role === 'admin' ? 'Demote Admin' : 'Make Admin'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  ) : (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 bg-slate-900/20 border border-slate-900 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-200">
            DocuMind AI Feedback Inbox ({messages.length})
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Real-time messages submitted by visitors and clients
          </p>
        </div>
        <div className="text-xs text-slate-500 bg-slate-955 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-900 flex items-center gap-2">
          <span>Forwarding Destination:</span>
          <span className="text-indigo-400 font-mono font-medium underline">kmulatu21@gmail.com</span>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-slate-900 rounded-2xl bg-slate-950/20">
          <FileText className="h-10 w-10 text-slate-800 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No contact messages received yet.</p>
          <p className="text-[11px] text-slate-600 mt-1">When users fill out the "Contact Us" form, their submissions appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {[...messages].reverse().map((m) => (
            <div 
              key={m.id} 
              className="p-5 bg-slate-900/30 border border-slate-900 rounded-2xl space-y-3 hover:border-slate-800 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-950 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-indigo-400">
                    Subject: {m.subject}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-100 mt-1">
                    From: {m.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Email: <a href={`mailto:${m.email}`} className="text-cyan-400 hover:underline">{m.email}</a>
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-900">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              
              <div className="text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-900/80 leading-relaxed whitespace-pre-wrap select-text">
                {m.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}

      {/* 5. Direct Lightbox Modal Image Receipt Viewer */}
      {previewReceipt && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setPreviewReceipt(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2 text-indigo-400">
                <FileText className="h-4 w-4" />
                <span className="font-bold text-slate-205 text-xs text-slate-200 select-all truncate max-w-[400px]">
                  {previewReceipt.name}
                </span>
              </div>
              <button
                onClick={() => setPreviewReceipt(null)}
                className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Image Renderer */}
            <div className="p-6 flex items-center justify-center bg-slate-950 max-h-[70vh] overflow-y-auto">
              {previewReceipt.data.startsWith('data:image/') ? (
                <img 
                  src={previewReceipt.data} 
                  alt="Receipt Screenshot Preview" 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg border border-slate-850 shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="p-8 text-center bg-slate-900 border border-slate-850 rounded-2xl max-w-sm space-y-4">
                  <ShieldAlert className="h-10 w-10 text-amber-400 mx-auto animate-bounce" />
                  <p className="text-slate-350 text-xs font-bold font-sans">Non-Image Receipt Format Preview</p>
                  <p className="text-slate-500 text-[11px] leading-normal font-medium">This verification attachment is stored as a custom binary or a PDF document. Click below to download and view using a local reader.</p>
                  <a
                    href={previewReceipt.data}
                    download={previewReceipt.name}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-slate-950 text-xs font-bold cursor-pointer transition select-none shadow"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Download {previewReceipt.name.split('.').pop()?.toUpperCase() || 'Document'}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-850 bg-slate-950/20 text-center">
              <p className="text-[10px] text-slate-500">
                DocuMind AI Safe Verification Framework • Press anywhere outside to dismiss
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
