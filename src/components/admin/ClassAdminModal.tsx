import { useStaticBackdropScrollLock } from "../../utils/useStaticBackdropScrollLock";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ShieldCheck, 
  UserCheck, 
  ArrowRightLeft, 
  History, 
  Share2, 
  Send, 
  Copy, 
  Check, 
  Phone, 
  Mail, 
  User, 
  CheckCircle2, 
  MessageSquare,
  Lock,
  Search,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Crown
} from 'lucide-react';
import { 
  UserAccount, 
  ClassSet, 
  StudentProfile, 
  AdminHistoryEntry, 
  AdminTransferRequest, 
  AgreementAcceptanceRecord,
} from '../../types';
import { useFeedback } from '../common/FeedbackSystem';
import { isValidEmail } from '../../utils/emailValidator';

interface ClassAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  currentSet: ClassSet;
  onUpdateSet: (updatedSet: ClassSet) => void;
  onAdminTransferred?: (newAdminUser: UserAccount) => void;
  initialTab?: AdminTab;
  triggerCropForImage?: (
    imgUrl: string,
    aspect: 'free' | '1:1' | '4:5' | '16:9',
    title: string,
    onComplete: (cropped: string) => void
  ) => void;
}

export type AdminTab = 'admin_history' | 'transfer_admin';

export const ClassAdminModal: React.FC<ClassAdminModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentSet,
  onUpdateSet,
  onAdminTransferred,
  initialTab = 'transfer_admin',
}) => {
  const { showSuccess, showError, confirmWarning } = useFeedback();
  // Tab order: Transfer Admin on the left, Admin History on the right
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab || 'transfer_admin');

  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Transfer Mode: 'roster' (Direct selection from roster) vs 'link' (Alternative for successor not yet on roster)
  const [transferMode, setTransferMode] = useState<'roster' | 'link'>('roster');

  // Search in roster
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Alternative Method (Link for successor not yet on roster)
  const [successorName, setSuccessorName] = useState('');
  const [successorEmail, setSuccessorEmail] = useState('');
  const [successorPhone, setSuccessorPhone] = useState('');
  const [activeTransferRequest, setActiveTransferRequest] = useState<AdminTransferRequest | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTakeoverFormOpen, setIsTakeoverFormOpen] = useState(false);

  // Takeover form simulated submission by new admin
  const [takeoverFullName, setTakeoverFullName] = useState('');
  const [takeoverEmail, setTakeoverEmail] = useState('');
  const [takeoverPhone, setTakeoverPhone] = useState('');
  const [takeoverAgreed, setTakeoverAgreed] = useState(false);
  const [takeoverError, setTakeoverError] = useState('');

  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferredToName, setTransferredToName] = useState('');

  // Filter roster excluding current admin
  const candidateStudents = useMemo(() => {
    const adminEmail = (currentUser.email || currentSet.classRepEmail || '').toLowerCase().trim();
    const adminName = (currentUser.fullName || currentSet.classRepName || '').toLowerCase().trim();

    return currentSet.students.filter((s) => {
      const sEmail = (s.email || '').toLowerCase().trim();
      const sName = (s.fullName || '').toLowerCase().trim();
      if (sEmail && sEmail === adminEmail) return false;
      if (sName && sName === adminName) return false;
      if ((s as any).isClassRep && s.id.startsWith('admin-')) return false;
      return true;
    }).filter((s) => {
      if (!rosterSearch.trim()) return true;
      const q = rosterSearch.toLowerCase().trim();
      return (
        s.fullName?.toLowerCase().includes(q) ||
        s.nickname?.toLowerCase().includes(q) ||
        s.position?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    });
  }, [currentSet.students, currentUser, currentSet.classRepEmail, currentSet.classRepName, rosterSearch]);

  const selectedStudent = useMemo(() => {
    return currentSet.students.find((s) => s.id === selectedStudentId);
  }, [currentSet.students, selectedStudentId]);

  // Method 1: Execute Direct Handover from Class Roster
  const handleExecuteRosterTransfer = () => {
    if (!selectedStudent) return;
    if (!selectedStudent.email || !isValidEmail(selectedStudent.email)) {
      showError(
        'Email required on profile',
        `${selectedStudent.fullName} must have a valid email on file to log in as admin. Please update their profile email first.`
      );
      return;
    }

    confirmWarning({
      title: `Transfer Admin to ${selectedStudent.fullName}?`,
      message: `You will immediately relinquish administrative authority. ${selectedStudent.fullName} can simply sign in with ${selectedStudent.email} to manage this album. Your student profile remains permanently preserved.`,
      confirmLabel: 'Transfer Authority Now',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        const now = new Date().toISOString();
        const formerEntry: AdminHistoryEntry = {
          adminUserId: currentUser.id,
          adminName: currentUser.fullName,
          adminEmail: currentUser.email,
          appointedAt: currentSet.activationDate || now,
          relinquishedAt: now,
          reasonForTransition: 'voluntary_transfer',
          transferredToUserId: selectedStudent.id,
          notes: `Voluntarily transferred to classmate ${selectedStudent.fullName} (${selectedStudent.email})`,
        };

        const existingHistory = currentSet.adminHistory || [];
        const finalHistory: AdminHistoryEntry[] = [formerEntry, ...existingHistory];

        // Mark candidate as class rep on student roster
        const updatedStudents = currentSet.students.map((s) => {
          if (s.id === selectedStudent.id) {
            return { ...s, isClassRep: true, position: s.position || 'Class Representative' };
          }
          return s;
        });

        const updatedSet: ClassSet = {
          ...currentSet,
          classRepName: selectedStudent.fullName,
          classRepEmail: selectedStudent.email!,
          classRepPhone: selectedStudent.whatsappNumber || currentSet.classRepPhone,
          currentAdminUserId: selectedStudent.id,
          adminHistory: finalHistory,
          students: updatedStudents,
        };

        onUpdateSet(updatedSet);
        setTransferredToName(selectedStudent.fullName);
        setTransferSuccess(true);
        showSuccess('Admin transfer completed.', `${selectedStudent.fullName} is now the Class Administrator.`);

        if (onAdminTransferred) {
          const newAdminUser: UserAccount = {
            id: selectedStudent.id,
            email: selectedStudent.email!,
            fullName: selectedStudent.fullName,
            role: 'class_rep',
            assignedSetId: currentSet.id,
          };
          onAdminTransferred(newAdminUser);
        }
      },
    });
  };

  // Method 2: Generate Transfer Link for successor not yet on roster
  const handleGenerateTransferLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!successorName.trim()) {
      showError('Name required', 'Please enter the successor full name.');
      return;
    }
    if (successorEmail && !isValidEmail(successorEmail)) {
      showError('Valid email required', 'Please enter an accurate email address for the successor.');
      return;
    }

    const token = `trf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newReq: AdminTransferRequest = {
      id: `req-${Date.now()}`,
      setId: currentSet.id,
      fromUserId: currentUser.id,
      fromAdminName: currentUser.fullName,
      fromAdminEmail: currentUser.email,
      toName: successorName.trim(),
      toPhoneOrWhatsapp: successorPhone.trim(),
      toEmail: successorEmail.trim(),
      transferToken: token,
      status: 'pending_acceptance',
      createdAt: new Date().toISOString(),
    };

    setActiveTransferRequest(newReq);
    showSuccess('Transfer link ready', 'The current album admin retains control until the new admin fills out their details.');
  };

  const transferLink = activeTransferRequest
    ? `${window.location.origin}/?admin_transfer=${activeTransferRequest.transferToken}&set_id=${currentSet.id}`
    : '';

  const handleCopyTransferLink = () => {
    if (!transferLink) return;
    navigator.clipboard.writeText(transferLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Complete Takeover via Form (simulates new admin completing the handover form)
  const handleCompleteTakeoverForm = (e: React.FormEvent) => {
    e.preventDefault();
    setTakeoverError('');

    if (!takeoverFullName.trim()) {
      setTakeoverError('Please enter your official full name.');
      return;
    }
    if (!isValidEmail(takeoverEmail)) {
      setTakeoverError('Please enter a valid, accurate email address.');
      return;
    }
    if (!takeoverAgreed) {
      setTakeoverError('You must agree to the administrative handover terms.');
      return;
    }

    const now = new Date().toISOString();
    const formerEntry: AdminHistoryEntry = {
      adminUserId: currentUser.id,
      adminName: currentUser.fullName,
      adminEmail: currentUser.email,
      appointedAt: currentSet.activationDate || now,
      relinquishedAt: now,
      reasonForTransition: 'voluntary_transfer',
      notes: `Handed over via takeover form to ${takeoverFullName.trim()} (${takeoverEmail.trim()})`,
    };

    const newUserId = `usr-rep-${Date.now()}`;
    const finalHistory: AdminHistoryEntry[] = [formerEntry, ...(currentSet.adminHistory || [])];

    const updatedSet: ClassSet = {
      ...currentSet,
      classRepName: takeoverFullName.trim(),
      classRepEmail: takeoverEmail.trim().toLowerCase(),
      classRepPhone: takeoverPhone.trim() || currentSet.classRepPhone,
      currentAdminUserId: newUserId,
      adminHistory: finalHistory,
    };

    onUpdateSet(updatedSet);
    setTransferredToName(takeoverFullName.trim());
    setTransferSuccess(true);
    setIsTakeoverFormOpen(false);
    showSuccess('Administrative takeover complete.', `${takeoverFullName.trim()} is now in charge.`);

    if (onAdminTransferred) {
      const newAdminUser: UserAccount = {
        id: newUserId,
        email: takeoverEmail.trim().toLowerCase(),
        fullName: takeoverFullName.trim(),
        role: 'class_rep',
        assignedSetId: currentSet.id,
      };
      onAdminTransferred(newAdminUser);
    }
  };

  useStaticBackdropScrollLock(isOpen);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <div 
      id="class-admin-modal-backdrop"
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 md:p-6 animate-fadeIn text-[#e2e4e9]"
      onClick={onClose}
    >
      <div 
        id="class-admin-modal-dialog"
        className="relative w-full max-w-2xl bg-[#0e1017] border border-white/15 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100dvh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 sm:px-8 pt-5 pb-4 border-b border-white/10 bg-[#0e1017] flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-syne font-bold text-lg sm:text-xl text-white">
                  Class Admin Management
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono-tech text-zinc-300 uppercase tracking-wider">
                  Administrative Authority
                </span>
              </div>
              <p className="font-mono-tech text-xs text-zinc-400">
                {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Class Admin"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation: Transfer Admin on the left, Admin History on the right */}
        <div className="px-4 sm:px-8 py-2.5 border-b border-white/5 bg-[#06070a] flex items-center gap-2 shrink-0 z-10 overflow-x-auto">
          <button
            type="button"
            id="tab-transfer-admin"
            onClick={() => setActiveTab('transfer_admin')}
            className={`px-4 py-2 rounded-xl font-mono-tech text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'transfer_admin'
                ? 'bg-white text-black font-bold shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Admin</span>
          </button>

          <button
            type="button"
            id="tab-admin-history"
            onClick={() => setActiveTab('admin_history')}
            className={`px-4 py-2 rounded-xl font-mono-tech text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'admin_history'
                ? 'bg-white text-black font-bold shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Admin History</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono-tech bg-white/15">
              {(currentSet.adminHistory || []).length + 1}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 md:p-8 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-6">
          {/* =========================================================================
              TAB 1: ADMIN HISTORY (On the Left)
              ========================================================================= */}
          {activeTab === 'admin_history' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-5 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-2">
                <h3 className="font-syne font-bold text-base text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-[#d4af37]" />
                  <span>Administrative Lineage &amp; Handover Record</span>
                </h3>
                <p className="font-body text-xs text-zinc-300 leading-relaxed">
                  Permanent provenance log tracking the executive custodians of {currentSet.classSetName}. Former administrators retain permanent graduate profiles with honor.
                </p>
              </div>

              {/* Current Active Administrator Card */}
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-syne font-bold text-lg shrink-0">
                    <Crown className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-syne font-bold text-sm sm:text-base text-white truncate">
                        {currentSet.classRepName || currentUser.fullName}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-mono-tech uppercase font-bold border border-emerald-400/30">
                        Current Class Admin
                      </span>
                    </div>
                    <p className="font-mono-tech text-xs text-zinc-300 mt-0.5">
                      {currentSet.classRepEmail || currentUser.email} {currentSet.classRepPhone && `• ${currentSet.classRepPhone}`}
                    </p>
                    <p className="font-mono-tech text-[10px] text-emerald-400/80 mt-1">
                      Active Administrator in Full Custody
                    </p>
                  </div>
                </div>
              </div>

              {/* Historical Administrators Timeline */}
              <div className="space-y-3">
                <span className="font-mono-tech text-xs text-zinc-400 uppercase tracking-wider block">
                  Past Administrators ({(currentSet.adminHistory || []).length})
                </span>

                {(!currentSet.adminHistory || currentSet.adminHistory.length === 0) ? (
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-1">
                    <p className="font-syne font-semibold text-xs text-zinc-300">
                      Founding Administration
                    </p>
                    <p className="font-mono-tech text-[11px] text-zinc-500">
                      No administrative transfers have occurred yet for this cohort album.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentSet.adminHistory.map((entry, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-syne font-bold text-sm text-white truncate">
                                {entry.adminName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 text-[10px] font-mono-tech uppercase">
                                Former Admin
                              </span>
                            </div>
                            <p className="font-mono-tech text-[11px] text-zinc-400 mt-0.5">
                              {entry.adminEmail} {entry.adminPhone && `• ${entry.adminPhone}`}
                            </p>
                            {entry.notes && (
                              <p className="font-body text-[11px] text-zinc-500 italic mt-1">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono-tech text-[10px] text-zinc-500">
                          {entry.relinquishedAt ? (
                            <span>Handed over {new Date(entry.relinquishedAt).toLocaleDateString()}</span>
                          ) : (
                            <span>Tenure logged</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: TRANSFER ADMIN (On the Right)
              ========================================================================= */}
          {activeTab === 'transfer_admin' && (
            <div className="space-y-6 animate-fadeIn">
              {transferSuccess ? (
                <div className="p-8 rounded-3xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="font-syne font-bold text-xl text-white">
                    Administrative Handover Completed
                  </h3>
                  <p className="font-body text-xs text-zinc-300 max-w-lg mx-auto leading-relaxed">
                    Administrative authority has been successfully transferred to <strong>{transferredToName}</strong>. You have relinquished administrator privileges while your student profile remains permanently preserved.
                  </p>
                  <p className="font-mono-tech text-xs text-emerald-400">
                    If you try signing in again, you will be notified that {transferredToName} is now in charge.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-full bg-white text-black font-syne font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 cursor-pointer"
                  >
                    Close &amp; Exit Dashboard
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Context Banner */}
                  <div className="p-5 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-2">
                    <h3 className="font-syne font-bold text-base text-white">
                      Voluntary Administrative Handover
                    </h3>
                    <p className="font-body text-xs text-zinc-300 leading-relaxed">
                      Select a classmate from your class roster to take over the album admin dashboard. Because the roster already carries their email, all they need to do is sign in with that email to gain access.
                    </p>
                  </div>

                  {/* Mode Selector: Primary Roster vs Alternative Link */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/10 w-full sm:w-fit">
                    <button
                      type="button"
                      onClick={() => setTransferMode('roster')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer text-center ${
                        transferMode === 'roster'
                          ? 'bg-white text-black font-bold shadow'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Method 1: Class Roster
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferMode('link')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono-tech uppercase tracking-wider transition-all cursor-pointer text-center ${
                        transferMode === 'link'
                          ? 'bg-white text-black font-bold shadow'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Method 2: Takeover Link
                    </button>
                  </div>

                  {/* =================================================================
                      METHOD 1: SELECT FROM CLASS ROSTER
                      ================================================================= */}
                  {transferMode === 'roster' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={rosterSearch}
                          onChange={(e) => setRosterSearch(e.target.value)}
                          placeholder="Search classmate by name, role, nickname or email..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0c0d14] border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 text-xs font-body"
                        />
                      </div>

                      {/* Classmate Selection Cards: Displaying photos and roles */}
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1 overscroll-contain">
                        {candidateStudents.length === 0 ? (
                          <div className="text-center py-8 text-zinc-500 font-mono-tech text-xs">
                            No classmates found matching search.
                          </div>
                        ) : (
                          candidateStudents.map((student) => {
                            const isSelected = selectedStudentId === student.id;
                            const hasValidEmail = Boolean(student.email && isValidEmail(student.email));

                            return (
                              <div
                                key={student.id}
                                onClick={() => setSelectedStudentId(student.id)}
                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                  isSelected
                                    ? 'bg-[#d4af37]/15 border-[#d4af37]/50 shadow-md ring-1 ring-[#d4af37]/30'
                                    : 'bg-[#0c0d14] border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  {/* Student Photo */}
                                  <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/15 overflow-hidden shrink-0 flex items-center justify-center">
                                    {student.photoUrl ? (
                                      <img
                                        src={student.photoUrl}
                                        alt={student.fullName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <User className="w-5 h-5 text-zinc-500" />
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-syne font-bold text-sm text-white truncate">
                                        {student.fullName}
                                      </h4>
                                      {student.nickname && (
                                        <span className="text-[#d4af37] text-xs font-mono-tech">
                                          "{student.nickname}"
                                        </span>
                                      )}
                                    </div>

                                    {/* Role Badge */}
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="font-mono-tech text-[11px] text-amber-300 font-medium">
                                        {student.position || 'Class Member'}
                                      </span>
                                      <span className="text-zinc-600 text-xs">•</span>
                                      <span className="font-mono-tech text-[10px] text-zinc-400 truncate">
                                        {student.email || 'No email on file'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {!hasValidEmail ? (
                                    <span className="text-[10px] font-mono-tech text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                      Missing Email
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono-tech text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                      Direct Login Ready
                                    </span>
                                  )}
                                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-white/20'
                                  }`}>
                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Direct Confirmation Action */}
                      {selectedStudent && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                          <div>
                            <p className="font-syne font-bold text-xs sm:text-sm text-white">
                              Selected Successor: {selectedStudent.fullName}
                            </p>
                            <p className="font-mono-tech text-[11px] text-zinc-300">
                              Sign-in Email: <strong>{selectedStudent.email}</strong> • Role: {selectedStudent.position || 'Class Representative'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleExecuteRosterTransfer}
                            className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shrink-0"
                          >
                            Transfer Authority Now
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* =================================================================
                      METHOD 2: SEND LINK (ALTERNATIVE FOR SUCCESSOR NOT ON ROSTER YET)
                      ================================================================= */}
                  {transferMode === 'link' && (
                    <div className="space-y-5 animate-fadeIn">
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                        <span className="font-syne font-bold text-sm text-white block">
                          Send Takeover Link to Successor
                        </span>
                        <p className="font-body text-xs text-zinc-300 leading-relaxed">
                          Use this alternative if your new admin is not yet on the class roster. The current album admin retains control until the new admin fills out their details on the album admin form.
                        </p>
                      </div>

                      {activeTransferRequest ? (
                        <div className="p-5 rounded-2xl bg-[#0c0d14] border border-amber-500/30 space-y-4">
                          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span>Takeover link active. Current admin retains control until successor completes form.</span>
                          </div>

                          {/* Link input */}
                          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/10">
                            <input
                              type="text"
                              readOnly
                              value={transferLink}
                              className="flex-1 bg-transparent px-3 text-xs font-mono-tech text-zinc-300 focus:outline-none truncate"
                            />
                            <button
                              type="button"
                              onClick={handleCopyTransferLink}
                              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                            >
                              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                            </button>
                          </div>

                          {/* Simulate Takeover Form Preview button */}
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                            <span className="text-zinc-400 font-mono-tech text-xs">
                              Successor: <strong>{activeTransferRequest.toName}</strong> ({activeTransferRequest.toEmail || activeTransferRequest.toPhoneOrWhatsapp})
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsTakeoverFormOpen(true)}
                              className="px-4 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>Open Takeover Form Preview</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleGenerateTransferLink} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                                Successor Full Name *
                              </label>
                              <input
                                required
                                type="text"
                                value={successorName}
                                onChange={(e) => setSuccessorName(e.target.value)}
                                placeholder="e.g. Tunde Adeyemi"
                                className="w-full px-3.5 py-2 rounded-xl bg-[#0c0d14] border border-white/15 text-white text-xs font-body focus:outline-none focus:border-white/30"
                              />
                            </div>

                            <div>
                              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                                Successor Email *
                              </label>
                              <input
                                required
                                type="email"
                                value={successorEmail}
                                onChange={(e) => setSuccessorEmail(e.target.value)}
                                placeholder="tunde@university.edu"
                                className="w-full px-3.5 py-2 rounded-xl bg-[#0c0d14] border border-white/15 text-white text-xs font-body focus:outline-none focus:border-white/30"
                              />
                            </div>

                            <div>
                              <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                                WhatsApp Phone
                              </label>
                              <input
                                type="text"
                                value={successorPhone}
                                onChange={(e) => setSuccessorPhone(e.target.value)}
                                placeholder="+234 800 000 0000"
                                className="w-full px-3.5 py-2 rounded-xl bg-[#0c0d14] border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow"
                          >
                            Generate Takeover Link
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          TAKEOVER FORM MODAL (Shows former admin details at top for context)
          ========================================================================= */}
      {isTakeoverFormOpen && (
        <div 
          className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setIsTakeoverFormOpen(false)}
        >
          <div 
            className="w-full max-w-xl bg-[#0c0d14] border border-amber-500/40 rounded-3xl p-5 sm:p-7 space-y-5 text-[#e2e4e9] shadow-2xl relative my-auto max-h-[calc(100vh-2rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Context: Former Admin Details at Top */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
              <span className="text-[10px] font-mono-tech uppercase tracking-wider text-amber-400 font-bold block">
                Former Administrator Details (Context)
              </span>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-syne font-bold text-white text-sm">
                    {currentSet.classRepName || currentUser.fullName}
                  </p>
                  <p className="font-mono-tech text-zinc-400">
                    {currentSet.classRepEmail || currentUser.email} {currentSet.classRepPhone && `• ${currentSet.classRepPhone}`}
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-400 text-[10px] font-mono-tech uppercase">
                  Outgoing Custodian
                </span>
              </div>
              <p className="text-[11px] font-body text-zinc-400 italic pt-1 border-t border-white/5">
                Cohort: {currentSet.departmentName} • Class of {currentSet.graduationYear}
              </p>
            </div>

            {/* New Admin Details Form */}
            <div className="space-y-1">
              <h3 className="font-syne font-bold text-lg text-white">
                New Album Administrator Registration
              </h3>
              <p className="font-body text-xs text-zinc-400">
                Input your administrator credentials to complete the takeover. Once submitted, the previous admin will no longer have access.
              </p>
            </div>

            {takeoverError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono-tech text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{takeoverError}</span>
              </div>
            )}

            <form onSubmit={handleCompleteTakeoverForm} className="space-y-4 text-xs font-body">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  New Admin Full Official Name *
                </label>
                <input
                  required
                  type="text"
                  value={takeoverFullName}
                  onChange={(e) => setTakeoverFullName(e.target.value)}
                  placeholder="e.g. Babatunde Lawal"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  New Admin Email (Will be used to sign in) *
                </label>
                <input
                  required
                  type="email"
                  value={takeoverEmail}
                  onChange={(e) => setTakeoverEmail(e.target.value)}
                  placeholder="babatunde@university.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
                  WhatsApp Phone Number *
                </label>
                <input
                  required
                  type="text"
                  value={takeoverPhone}
                  onChange={(e) => setTakeoverPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white focus:outline-none focus:border-amber-400/50 font-mono-tech"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-2 select-none">
                <input
                  type="checkbox"
                  checked={takeoverAgreed}
                  onChange={(e) => setTakeoverAgreed(e.target.checked)}
                  className="mt-0.5 rounded text-amber-400 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] font-mono-tech text-zinc-300">
                  I accept sole administrative responsibility for this class album. I acknowledge that the outgoing administrator's rights will be revoked and they will be informed of this transition.
                </span>
              </label>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsTakeoverFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                >
                  Confirm Takeover as Sole Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  ) : null;
};
