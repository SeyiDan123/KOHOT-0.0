import React, { useState } from 'react';
import { 
  HelpCircle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  MessageSquare, 
  User, 
  Building2, 
  Calendar,
  AlertCircle,
  Search,
  Filter,
  ShieldCheck,
  History,
  Phone,
  Mail,
  UserCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AlbumDisputeRecord } from '../../types';
import { getStoredAlbumDisputes, saveStoredAlbumDisputes } from '../../data/initialData';

export const MasterDisputesSection: React.FC = () => {
  const [disputes, setDisputes] = useState<AlbumDisputeRecord[]>(getStoredAlbumDisputes);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Under Review' | 'Resolved' | 'Dismissed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDisputeId, setActiveDisputeId] = useState<string | null>(null);
  const [decisionNotesInput, setDecisionNotesInput] = useState('');

  const filteredDisputes = disputes.filter((d) => {
    const matchesFilter = filterStatus === 'All' || d.status === filterStatus;
    const matchesSearch = 
      d.departmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.universityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.claimantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.currentAdminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.helpReason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.facultyName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleUpdateStatusAndDecision = (
    id: string, 
    newStatus: AlbumDisputeRecord['status'],
    decision: 'Approved' | 'Rejected' | 'Pending'
  ) => {
    const updated = disputes.map((d) => {
      if (d.id === id) {
        return {
          ...d,
          status: newStatus,
          decision,
          decisionDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
          reviewer: 'KoHot Owner Desk',
          resolutionNotes: decisionNotesInput.trim() || d.resolutionNotes || (
            decision === 'Approved' ? 'Administration change request reviewed and approved by Owner.' :
            decision === 'Rejected' ? 'Administration request reviewed and declined after verification.' :
            'Request is currently under structured Owner review.'
          ),
        };
      }
      return d;
    });
    setDisputes(updated);
    saveStoredAlbumDisputes(updated);
    setActiveDisputeId(null);
    setDecisionNotesInput('');
  };

  return (
    <div id="master-admin-help-section" className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 text-[10px] font-mono-tech uppercase font-semibold">
              Administration Support &amp; Review Desk
            </span>
          </div>
          <h2 className="font-syne font-bold text-2xl text-white tracking-tight">
            Album Admin Help Requests
          </h2>
          <p className="font-body text-xs text-zinc-400">
            Exceptional Class Album administration support and succession reviews across department albums.
          </p>
        </div>

        {/* Filter and Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search university, requester..."
              className="bg-[#10121a] border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs text-white font-mono-tech placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-[#10121a] border border-white/10 rounded-full px-3 py-1.5 text-xs text-zinc-300 font-mono-tech focus:outline-none cursor-pointer"
          >
            <option value="All">All Requests ({disputes.length})</option>
            <option value="Open">Open ({disputes.filter((d) => d.status === 'Open').length})</option>
            <option value="Under Review">Under Review</option>
            <option value="Resolved">Resolved</option>
            <option value="Dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Requests Cards List */}
      {filteredDisputes.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#0c0d14] border border-white/10 space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="font-syne font-bold text-white text-base">No Requests Found</h4>
          <p className="text-xs text-zinc-400 font-body max-w-sm mx-auto">
            All department albums are operating normally under their authorized Class Admins.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((request) => {
            const isExpanded = activeDisputeId === request.id;
            const helpReason = request.helpReason || request.claimantRole || 'Administration Inquiry';
            const explanation = request.explanation || request.disputeReason || 'No explanation provided';

            return (
              <div
                key={request.id}
                className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 hover:border-white/20 transition-all space-y-5"
              >
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-syne font-bold text-base text-white">
                        {request.departmentName} • Class of {request.graduationYear}
                      </span>
                      {request.classSetName && (
                        <span className="text-xs text-[#d4af37] font-mono-tech">
                          ("{request.classSetName}")
                        </span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-semibold ${
                        request.status === 'Open'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : request.status === 'Under Review'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : request.status === 'Resolved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30'
                      }`}>
                        {request.status}
                      </span>
                      {request.decision && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-semibold ${
                          request.decision === 'Approved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : request.decision === 'Rejected'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-zinc-500/20 text-zinc-400 border border-white/10'
                        }`}>
                          Decision: {request.decision}
                        </span>
                      )}
                    </div>
                    <p className="font-mono-tech text-xs text-zinc-400">
                      {request.universityName} {request.facultyName && `• ${request.facultyName}`} • Submitted: {request.submittedAt}
                    </p>
                  </div>

                  {/* Album & Administration Overview */}
                  <div className="flex items-center gap-4 text-xs font-mono-tech bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">Current Class Admin</span>
                      <span className="text-white font-medium">{request.currentAdminName}</span>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase">Requester</span>
                      <span className="text-[#d4af37] font-semibold">{request.claimantName}</span>
                    </div>
                  </div>
                </div>

                {/* Structured Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Requester & Account Information */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 font-mono-tech">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                      Requester &amp; Account
                    </span>
                    <div className="space-y-1 text-zinc-300">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-white font-medium">{request.claimantName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                          {request.claimantUserId ? `Account ID: ${request.claimantUserId}` : 'Guest Requester'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{request.claimantEmail}</span>
                      </div>
                      {request.claimantPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{request.claimantPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Backup Contact & Album Target */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 font-mono-tech">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">
                      Album &amp; Stored Backup Contact
                    </span>
                    <div className="space-y-1 text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Target Album:</span>
                        <span className="text-white">{request.setId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Backup Contact:</span>
                        <span className="text-[#d4af37]">
                          {request.backupContact 
                            ? `${request.backupContact.name} (${request.backupContact.role || 'Adviser'})`
                            : 'Faculty Head / Staff Adviser (On File)'}
                        </span>
                      </div>
                      {request.backupContact?.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Backup Email:</span>
                          <span>{request.backupContact.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Request Reason & Submitted Explanation */}
                <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono-tech uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Request Reason: {helpReason}</span>
                    </span>
                    <span className="text-[10px] font-mono-tech text-zinc-400">
                      Received: {request.submittedAt}
                    </span>
                  </div>
                  <p className="font-body text-xs text-zinc-200 leading-relaxed">
                    "{explanation}"
                  </p>
                </div>

                {/* Administration History & Review Decision */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-tech">
                  {/* History */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                      <History className="w-3 h-3 text-zinc-500" />
                      Administration History
                    </span>
                    <div className="space-y-1 text-[11px] text-zinc-400">
                      {request.administrationHistory && request.administrationHistory.length > 0 ? (
                        request.administrationHistory.map((h, i) => (
                          <div key={i} className="flex items-center justify-between py-0.5 border-b border-white/5 last:border-0">
                            <span>{h.date} — {h.action}</span>
                            <span className="text-zinc-500">{h.actor}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-500">Initial registration under {request.currentAdminName}.</p>
                      )}
                    </div>
                  </div>

                  {/* Decision & Reviewer */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Review Decision &amp; Notes
                    </span>
                    <div className="space-y-1 text-[11px] text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Reviewer:</span>
                        <span>{request.reviewer || 'KoHot Owner Desk'}</span>
                      </div>
                      {request.decisionDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Decision Date:</span>
                          <span>{request.decisionDate}</span>
                        </div>
                      )}
                      {request.resolutionNotes && (
                        <p className="pt-1 text-zinc-400 italic">
                          "{request.resolutionNotes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions & Decision Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                  <button
                    onClick={() => setActiveDisputeId(isExpanded ? null : request.id)}
                    className="text-xs font-mono-tech text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Review Decision Form' : 'Review & Record Decision'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {request.status !== 'Under Review' && (
                      <button
                        onClick={() => handleUpdateStatusAndDecision(request.id, 'Under Review', 'Pending')}
                        className="px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono-tech uppercase cursor-pointer"
                      >
                        Mark Under Review
                      </button>
                    )}
                    {request.status !== 'Resolved' && (
                      <button
                        onClick={() => handleUpdateStatusAndDecision(request.id, 'Resolved', 'Approved')}
                        className="px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono-tech uppercase cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Change</span>
                      </button>
                    )}
                    {request.status !== 'Dismissed' && (
                      <button
                        onClick={() => handleUpdateStatusAndDecision(request.id, 'Dismissed', 'Rejected')}
                        className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10 text-xs font-mono-tech uppercase cursor-pointer"
                      >
                        Reject / Dismiss
                      </button>
                    )}
                  </div>
                </div>

                {/* Decision input expansion */}
                {isExpanded && (
                  <div className="p-4 rounded-2xl bg-[#10121a] border border-white/15 space-y-3 mt-3 animate-fadeIn">
                    <label className="block text-[11px] font-mono-tech uppercase tracking-wider text-zinc-400 font-semibold">
                      Record Owner Decision &amp; Verification Reason
                    </label>
                    <textarea
                      rows={3}
                      value={decisionNotesInput}
                      onChange={(e) => setDecisionNotesInput(e.target.value)}
                      placeholder="e.g. Spoke with current Class Admin and Faculty Adviser Dr. Adeyemi. Administration handover confirmed; updating record."
                      className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-body leading-relaxed"
                    />
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleUpdateStatusAndDecision(request.id, 'Under Review', 'Pending')}
                        className="px-4 py-2 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-mono-tech text-xs uppercase cursor-pointer"
                      >
                        Save Note (Under Review)
                      </button>
                      <button
                        onClick={() => handleUpdateStatusAndDecision(request.id, 'Dismissed', 'Rejected')}
                        className="px-4 py-2 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono-tech text-xs uppercase cursor-pointer"
                      >
                        Reject Request
                      </button>
                      <button
                        onClick={() => handleUpdateStatusAndDecision(request.id, 'Resolved', 'Approved')}
                        className="px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase cursor-pointer transition-colors"
                      >
                        Approve &amp; Resolve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { MasterDisputesSection as MasterAdminHelpSection };
