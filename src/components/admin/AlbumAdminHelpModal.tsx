import React, { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle2, Send, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { ClassSet, UserAccount, AlbumDisputeRecord } from '../../types';
import { getStoredAlbumDisputes, saveStoredAlbumDisputes } from '../../data/initialData';
import { UniversalModal } from '../common/UniversalModal';

export const ALBUM_ADMIN_HELP_REASONS = [
  'I need help becoming the Class Admin',
  'The current Class Admin is unavailable',
  'I need help transferring administration',
  'There is an administration dispute',
  'Something else',
] as const;

export type AlbumAdminHelpReason = typeof ALBUM_ADMIN_HELP_REASONS[number];

interface AlbumAdminHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSet?: ClassSet | null;
  currentUser?: UserAccount | null;
}

export const AlbumAdminHelpModal: React.FC<AlbumAdminHelpModalProps> = ({
  isOpen,
  onClose,
  currentSet,
  currentUser,
}) => {
  // Academic / Album Details
  const [university, setUniversity] = useState(
    currentSet?.institutionName || (currentSet as any)?.universityName || ''
  );
  const [faculty, setFaculty] = useState(
    currentSet?.faculty || 'Faculty of Science'
  );
  const [department, setDepartment] = useState(
    currentSet?.departmentName || ''
  );
  const [graduatingYear, setGraduatingYear] = useState<string | number>(
    currentSet?.graduationYear || new Date().getFullYear()
  );
  const [classSetName, setClassSetName] = useState(
    currentSet?.classSetName || ''
  );

  // Applicant Contact Info (auto-populated if user is authenticated)
  const [applicantFullName, setApplicantFullName] = useState(
    currentUser?.fullName || ''
  );
  const [applicantEmail, setApplicantEmail] = useState(
    currentUser?.email || ''
  );
  const [applicantPhone, setApplicantPhone] = useState(
    currentUser?.phone || ''
  );

  // Support Reason & Explanation
  const [selectedReason, setSelectedReason] = useState<AlbumAdminHelpReason>(
    'I need help becoming the Class Admin'
  );
  const [explanation, setExplanation] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Auto-sync currentSet and currentUser when opened
  useEffect(() => {
    if (isOpen) {
      if (currentSet) {
        setUniversity(currentSet.institutionName || (currentSet as any)?.universityName || '');
        setFaculty(currentSet.faculty || 'Faculty of Science');
        setDepartment(currentSet.departmentName || '');
        setGraduatingYear(currentSet.graduationYear || new Date().getFullYear());
        setClassSetName(currentSet.classSetName || '');
      }
      if (currentUser) {
        if (!applicantFullName) setApplicantFullName(currentUser.fullName || '');
        if (!applicantEmail) setApplicantEmail(currentUser.email || '');
        if (!applicantPhone) setApplicantPhone(currentUser.phone || '');
      }
      setSubmitted(false);
      setErrorMessage(null);
    }
  }, [isOpen, currentSet, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!university.trim() || !department.trim() || !graduatingYear) {
      setErrorMessage('Please provide the university, department, and graduating year.');
      return;
    }

    if (!applicantFullName.trim() || !applicantEmail.trim() || !explanation.trim()) {
      setErrorMessage('Please provide your name, email, and an explanation of your situation.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newRequest: AlbumDisputeRecord = {
        id: `help-${Date.now()}`,
        setId: currentSet?.id || `set-${department.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${graduatingYear}`,
        universityName: university.trim(),
        facultyName: faculty.trim() || undefined,
        departmentName: department.trim(),
        graduationYear: Number(graduatingYear) || new Date().getFullYear(),
        classSetName: classSetName.trim() || undefined,
        currentAdminName: currentSet?.classRepName || 'Pending Verification',
        claimantUserId: currentUser?.id || 'guest-requester',
        claimantName: applicantFullName.trim(),
        claimantEmail: applicantEmail.trim(),
        claimantPhone: applicantPhone.trim() || '',
        claimantRole: selectedReason,
        disputeReason: `[${selectedReason}] ${explanation.trim()}`,
        helpReason: selectedReason,
        explanation: explanation.trim(),
        submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'Open',
        decision: 'Pending',
        administrationHistory: currentSet ? [
          { date: 'Initial Registration', action: 'Class Album Registered', actor: currentSet.classRepName || 'Class Admin' },
          { date: new Date().toISOString().slice(0, 10), action: 'Album Admin Help Requested', actor: applicantFullName.trim() }
        ] : [
          { date: new Date().toISOString().slice(0, 10), action: 'Album Admin Help Requested', actor: applicantFullName.trim() }
        ]
      };

      const existing = getStoredAlbumDisputes();
      saveStoredAlbumDisputes([newRequest, ...existing]);
      setIsSubmitting(false);
      setSubmitted(true);
    } catch {
      setIsSubmitting(false);
      setErrorMessage("We couldn't submit your Album Admin Help request. Your information is still saved on this form. Please retry.");
    }
  };

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-syne font-bold text-lg text-white">
              Album Admin Help
            </h3>
            <p className="font-mono-tech text-xs text-zinc-400">
              {currentSet 
                ? `${currentSet.departmentName} • Class of ${currentSet.graduationYear}` 
                : 'Exceptional Class Album administration support'}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {submitted ? (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#0c0d14] border border-emerald-500/30 text-center space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            
            <div className="space-y-1.5">
              <h4 className="font-syne font-bold text-white text-lg">
                Your request has been received.
              </h4>
              <p className="font-body text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
                KoHot normally assigns Class Album administration through its registration and approval process. An Owner will review your details, cross-reference administration history, and reach out via email if any follow-up is needed.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-left max-w-md mx-auto font-mono-tech text-xs space-y-1.5 text-zinc-400">
              <div className="flex justify-between">
                <span>Department:</span>
                <span className="text-white font-medium">{department} ({graduatingYear})</span>
              </div>
              <div className="flex justify-between">
                <span>Reason:</span>
                <span className="text-amber-300">{selectedReason}</span>
              </div>
              <div className="flex justify-between">
                <span>Applicant:</span>
                <span className="text-white">{applicantFullName}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Introductory text block */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <p className="font-syne font-semibold text-xs text-white leading-relaxed">
                Need help with the administration of a Class Album? Tell us what happened and KoHot will review the situation.
              </p>
              <p className="font-body text-[11px] text-zinc-400 leading-relaxed">
                KoHot normally assigns Class Album administration through its registration and approval process. This page is for exceptional administration issues that cannot be resolved through the normal Class Admin tools.
              </p>
            </div>

            {errorMessage && (
              <div role="alert" className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {currentSet && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Currently recorded Class Admin: <strong>{currentSet.classRepName || 'Assigned Representative'}</strong>. Submitting this form requests structured Owner review. It does not automatically transfer or alter administrative control.
                </p>
              </div>
            )}

            {/* Academic Information */}
            <div className="space-y-3 pt-1">
              <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold block">
                1. Class Album Information
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    University *
                  </label>
                  <input
                    type="text"
                    required
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="e.g. University of Lagos (UNILAG)"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Faculty / School
                  </label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="e.g. Faculty of Science"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Graduating Year *
                  </label>
                  <input
                    type="number"
                    required
                    value={graduatingYear}
                    onChange={(e) => setGraduatingYear(e.target.value)}
                    placeholder="e.g. 2026"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Class / Set Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={classSetName}
                    onChange={(e) => setClassSetName(e.target.value)}
                    placeholder="e.g. The Synergy Set"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>
              </div>
            </div>

            {/* Applicant Details */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold">
                  2. Your Information
                </span>
                {currentUser && (
                  <span className="font-mono-tech text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Auto-filled from signed-in account
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Applicant Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantFullName}
                    onChange={(e) => setApplicantFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="name@university.edu.ng"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>

                <div>
                  <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full bg-[#10121a] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 font-body"
                  />
                </div>
              </div>
            </div>

            {/* Support Reasons & Explanation */}
            <div className="space-y-3 pt-2">
              <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#d4af37] font-semibold block">
                3. What do you need help with?
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALBUM_ADMIN_HELP_REASONS.map((reason) => {
                  const isChosen = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`text-left p-3 rounded-xl border text-xs font-body transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isChosen
                          ? 'bg-amber-500/15 border-amber-500/50 text-white font-semibold'
                          : 'bg-[#10121a] border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <span>{reason}</span>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isChosen ? 'border-amber-400 bg-amber-400' : 'border-white/20'
                      }`}>
                        {isChosen && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  Explanation / Additional Details *
                </label>
                <textarea
                  required
                  rows={3}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Tell us what happened so KoHot can review the situation calmly and contact the appropriate parties..."
                  className="w-full bg-[#10121a] border border-white/15 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/35 leading-relaxed font-body"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-between border-t border-white/10">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting request…' : 'Submit for Review'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-xs font-mono-tech uppercase text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </UniversalModal>
  );
};

// Re-export as AlbumDisputeModal for backward compatibility with existing imports
export { AlbumAdminHelpModal as AlbumDisputeModal };
