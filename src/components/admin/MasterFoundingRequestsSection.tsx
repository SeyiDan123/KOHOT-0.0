import React, { useState } from 'react';
import { FoundingClassRequest } from '../../types';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building2, 
  GraduationCap, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  CheckSquare, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Search,
  Award
} from 'lucide-react';
import { useFeedback } from '../common/FeedbackSystem';

interface MasterFoundingRequestsSectionProps {
  foundingRequests: FoundingClassRequest[];
  onApprove: (requestId: string, reviewNotes?: string) => void;
  onReject: (requestId: string, reason?: string) => void;
  onViewDepartmentLegacyWall?: (deptId: string, uniId?: string) => void;
}

export const MasterFoundingRequestsSection: React.FC<MasterFoundingRequestsSectionProps> = ({
  foundingRequests,
  onApprove,
  onReject,
  onViewDepartmentLegacyWall,
}) => {
  const { showSuccess, showWarning } = useFeedback();
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active review modal state
  const [reviewingRequest, setReviewingRequest] = useState<FoundingClassRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const pendingCount = foundingRequests.filter((r) => r.status === 'Pending').length;
  const approvedCount = foundingRequests.filter((r) => r.status === 'Approved').length;
  const rejectedCount = foundingRequests.filter((r) => r.status === 'Rejected').length;

  const filteredRequests = foundingRequests.filter((req) => {
    if (filterStatus !== 'All' && req.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        req.departmentName.toLowerCase().includes(q) ||
        req.universityName.toLowerCase().includes(q) ||
        req.applicantName.toLowerCase().includes(q) ||
        req.applicantEmail.toLowerCase().includes(q) ||
        String(req.classYear).includes(q)
      );
    }
    return true;
  });

  const handleOpenReview = (req: FoundingClassRequest) => {
    setReviewingRequest(req);
    setReviewNotes(req.reviewNotes || '');
    setRejectReason('');
    setIsRejecting(false);
  };

  const handleConfirmApproval = () => {
    if (!reviewingRequest) return;
    onApprove(reviewingRequest.id, reviewNotes || 'Accreditation verified. Founding Class and Legacy Plaque activated.');
    showSuccess('Class Album request approved.', 'Founding Class status and album access are now active.');
    setReviewingRequest(null);
  };

  const handleConfirmRejection = () => {
    if (!reviewingRequest) return;
    onReject(reviewingRequest.id, rejectReason || 'Application could not be verified by institutional desk.');
    showWarning('Class Album request rejected.', 'The applicant has been notified of the decision.');
    setReviewingRequest(null);
  };

  return (
    <div id="founding-requests-module" className="p-6 sm:p-8 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-6">
      {/* Header & Overview Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-[#d4af37]/15 border border-[#d4af37]/35 text-[#d4af37] font-mono-tech text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#d4af37]" />
              FOUNDING CLASS ACCREDITATION DESK
            </span>
            <span className="text-xs font-mono-tech text-zinc-400">Institutional Legacy Gateways</span>
          </div>
          <h2 className="font-syne font-bold text-2xl text-white">
            Founding Class Applications
          </h2>
          <p className="font-body text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Review incoming applications from pioneering class representatives establishing their department's permanent KoHot Legacy.
          </p>
        </div>

        {/* Summary Metric Counters */}
        <div className="flex items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-[#08090e] border border-amber-500/20 text-center min-w-[100px]">
            <span className="font-mono-tech text-[10px] uppercase text-zinc-400 block">Pending</span>
            <span className="font-mono-tech text-xl font-bold text-amber-400">{pendingCount}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#08090e] border border-emerald-500/20 text-center min-w-[100px]">
            <span className="font-mono-tech text-[10px] uppercase text-zinc-400 block">Approved</span>
            <span className="font-mono-tech text-xl font-bold text-emerald-400">{approvedCount}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#08090e] border border-white/10 text-center min-w-[100px]">
            <span className="font-mono-tech text-[10px] uppercase text-zinc-400 block">Total</span>
            <span className="font-mono-tech text-xl font-bold text-white">{foundingRequests.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-full text-xs font-mono-tech uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                filterStatus === status
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
              }`}
            >
              {status}
              {status === 'Pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[9px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search department, uni, rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#08090e] border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-body"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-[#08090e] border border-white/10 space-y-2">
            <ShieldCheck className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="font-mono-tech text-xs text-zinc-400">No applications matching the selected criteria.</p>
          </div>
        ) : (
          filteredRequests.map((req) => (
            <div
              key={req.id}
              className={`p-5 sm:p-6 rounded-2xl bg-[#08090e] border transition-all ${
                req.status === 'Pending' 
                  ? 'border-amber-500/30 shadow-lg shadow-amber-500/5' 
                  : req.status === 'Approved'
                  ? 'border-emerald-500/20'
                  : 'border-white/10 opacity-70'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-syne font-bold text-base text-white">
                      {req.departmentName}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-xs text-zinc-300 font-mono-tech">
                      {req.universityName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono-tech text-[10px]">
                      Class of {req.classYear}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech uppercase font-semibold ${
                        req.status === 'Pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : req.status === 'Approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-400 font-mono-tech pt-1">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-white">{req.applicantName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{req.applicantEmail}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{req.applicantPhone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-mono-tech pt-1 flex-wrap">
                    <span>Moniker: <strong className="text-zinc-300">{req.classSetName || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>Graduates Goal: <strong className="text-zinc-300">{req.estimatedGraduatesCount}</strong></span>
                    <span>•</span>
                    <span>Submitted: {req.submissionDate}</span>
                  </div>

                  {req.reviewNotes && (
                    <p className="text-xs text-zinc-300 italic pt-1 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                      "{req.reviewNotes}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                  {onViewDepartmentLegacyWall && (
                    <button
                      type="button"
                      onClick={() => onViewDepartmentLegacyWall(req.departmentId, req.universityId)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>Legacy Wall</span>
                    </button>
                  )}

                  {req.status === 'Pending' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenReview(req)}
                      className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#c39f2e] text-black font-semibold font-mono-tech text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Review &amp; Verify</span>
                    </button>
                  ) : req.status === 'Approved' ? (
                    <span className="text-xs font-mono-tech text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Legacy Activated ($0)</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenReview(req)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs"
                    >
                      Re-evaluate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review & Verification Modal */}
      {reviewingRequest && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setReviewingRequest(null)}
        >
          <div 
            className="w-full max-w-lg bg-[#0c0d14] border border-white/20 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative text-[#e2e4e9]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#d4af37]" />
                <h3 className="font-syne font-bold text-lg text-white">
                  Verify Founding Class Application
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingRequest(null)}
                className="w-8 h-8 rounded-full bg-white/5 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Application Summary Box */}
            <div className="p-4 rounded-2xl bg-[#08090e] border border-white/10 space-y-2.5 font-mono-tech text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Institution:</span>
                <span className="text-white font-medium">{reviewingRequest.universityName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Department:</span>
                <span className="text-[#d4af37] font-semibold">{reviewingRequest.departmentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Class Year:</span>
                <span className="text-white">Class of {reviewingRequest.classYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Applicant / Rep:</span>
                <span className="text-white">{reviewingRequest.applicantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Email &amp; Phone:</span>
                <span className="text-zinc-300">{reviewingRequest.applicantEmail} ({reviewingRequest.applicantPhone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estimated Graduates:</span>
                <span className="text-zinc-300">{reviewingRequest.estimatedGraduatesCount} graduates</span>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-xs font-body">
              <span className="font-mono-tech text-[10px] uppercase text-zinc-400 block font-semibold">
                Accreditation Checklist
              </span>
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Department is confirmed active under accredited university registry.</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>No existing approved Founding Class exists for this department.</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Approving will anchor the permanent Legacy Plaque and unlock the digital Class Album.</span>
              </div>
            </div>

            {!isRejecting ? (
              <div className="space-y-4">
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">
                    Approval Verification Notes
                  </label>
                  <textarea
                    rows={2}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Accreditation verified. Founding Class and campus Legacy Plaque activated."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-white/15 text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none text-xs font-body"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRejecting(true)}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-mono-tech text-xs transition-colors cursor-pointer"
                  >
                    Reject Application
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewingRequest(null)}
                      className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmApproval}
                      className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#c39f2e] text-black font-semibold font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg"
                    >
                      Approve Founding Class ($0)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-red-400 mb-1.5">
                    Reason for Rejection
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Duplicate applicant, unable to verify academic standing..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090e] border border-red-500/30 text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none text-xs font-body"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRejecting(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-mono-tech text-xs"
                  >
                    Back to Approval
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRejection}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold font-mono-tech text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
