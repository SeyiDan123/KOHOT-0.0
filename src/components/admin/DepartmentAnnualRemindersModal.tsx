import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Send,
  Mail,
  Check,
  Search,
  Copy,
  FileSpreadsheet,
  Users,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { DepartmentItem, UniversityDirectoryItem, ClassSet, StudentProfile } from '../../types';

interface DepartmentAnnualRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: DepartmentItem;
  university: UniversityDirectoryItem;
  sets: ClassSet[];
}

function getGraduateEmail(student: StudentProfile, uniShortCode: string): { email: string; isSubscribed: boolean } {
  if (student.email && student.email.includes('@')) {
    return { email: student.email, isSubscribed: true };
  }
  const clean = student.fullName.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  if (clean.length >= 2) {
    const domain = uniShortCode.toLowerCase() === 'cu' 
      ? 'covenantuniversity.edu.ng' 
      : uniShortCode.toLowerCase() === 'ui' 
      ? 'alumni.ui.edu.ng' 
      : 'alumni.unilag.edu.ng';
    return { email: `${clean[0]}.${clean[clean.length - 1]}@${domain}`, isSubscribed: true };
  }
  return { email: '', isSubscribed: false };
}

export const DepartmentAnnualRemindersModal: React.FC<DepartmentAnnualRemindersModalProps> = ({
  isOpen,
  onClose,
  department,
  university,
  sets,
}) => {
  // Enforce rule: No 2 set data should be revealed at the same time. Clicking another set closes the other.
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [setSearchTerms, setSetSearchTerms] = useState<Record<string, string>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSendingBlast, setIsSendingBlast] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter sets for this department
  const departmentSets = sets.filter(
    (s) =>
      s.departmentId === department.id ||
      (s.institutionId === university.id && s.departmentName.toLowerCase() === department.name.toLowerCase()) ||
      (s.institutionName.toLowerCase().includes(university.shortCode.toLowerCase()) &&
        s.departmentName.toLowerCase().includes(department.name.toLowerCase()))
  ).sort((a, b) => b.graduationYear - a.graduationYear);

  // Compile all graduates under this department
  const allDeptGraduates = departmentSets.flatMap((set) => {
    const approved = set.students.filter((s) => s.approved !== false);
    return approved.map((s) => ({
      ...s,
      ...getGraduateEmail(s, university.shortCode),
      setYear: set.graduationYear,
      setName: set.classSetName,
      setId: set.id,
    }));
  });

  const totalSubscribed = allDeptGraduates.filter((g) => g.isSubscribed && g.email).length;
  const coveragePercent = allDeptGraduates.length > 0 ? Math.round((totalSubscribed / allDeptGraduates.length) * 100) : 0;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleSet = (setId: string) => {
    // Strictly toggle: if clicked set is open, close it; otherwise open it and close any previously open set
    setExpandedSetId((prev) => (prev === setId ? null : setId));
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard?.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleCopyAllDeptEmails = () => {
    const emails = allDeptGraduates.filter((g) => g.email).map((g) => g.email).join(', ');
    navigator.clipboard?.writeText(emails);
    setCopiedAll(true);
    showToast(`Copied ${allDeptGraduates.filter((g) => g.email).length} email addresses to clipboard`);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleCopySetEmails = (setGraduates: Array<{ email?: string; fullName: string }>, year: number) => {
    const emails = setGraduates.filter((g) => g.email).map((g) => g.email).join(', ');
    navigator.clipboard?.writeText(emails);
    showToast(`Copied ${setGraduates.filter((g) => g.email).length} alumni emails for Class of ${year}`);
  };

  const handleExportDeptCsv = () => {
    const headers = ['Full Name', 'Nickname', 'Graduation Year', 'Class Set', 'Email Address', 'Subscription Status', 'Role'];
    const rows = allDeptGraduates.map((g) => [
      `"${g.fullName.replace(/"/g, '""')}"`,
      `"${(g.nickname || '').replace(/"/g, '""')}"`,
      g.setYear,
      `"${g.setName.replace(/"/g, '""')}"`,
      `"${g.email}"`,
      g.isSubscribed ? 'Subscribed' : 'Unsubscribed',
      `"${(g.position || 'Class Member').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${university.shortCode}_${department.name.replace(/\s+/g, '_')}_Alumni_Emails.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSetCsv = (set: ClassSet, setGrads: Array<{ fullName: string; nickname?: string; email: string; isSubscribed: boolean; position?: string }>) => {
    const headers = ['Full Name', 'Nickname', 'Email Address', 'Subscription Status', 'Position'];
    const rows = setGrads.map((g) => [
      `"${g.fullName.replace(/"/g, '""')}"`,
      `"${(g.nickname || '').replace(/"/g, '""')}"`,
      `"${g.email}"`,
      g.isSubscribed ? 'Active Subscriber' : 'Unsubscribed',
      `"${(g.position || 'Class Member').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${department.name.replace(/\s+/g, '_')}_Class_${set.graduationYear}_Emails.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSimulateSetBlast = (set: ClassSet, count: number) => {
    setIsSendingBlast(true);
    setTimeout(() => {
      setIsSendingBlast(false);
      showToast(`Dispatched annual relive email reminders to ${count} alumni from Class of ${set.graduationYear}!`);
    }, 1000);
  };

  return (
    <div
      id="department-annual-reminders-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-[#0c0e14] border border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Sticky Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#12141c] shrink-0">
          <div className="flex items-center gap-3">
            <button
              id="reminders-modal-back-btn"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
              title="Return to Master Host Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-200 hover:text-white">Back to Dashboard</span>
            </button>
            <div className="hidden sm:block">
              <span className="text-xs font-syne font-bold text-white">
                {university.shortCode} • {department.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono-tech uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
              MASTER HOST EXCLUSIVE
            </span>
            <button
              id="reminders-modal-close-x-btn"
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Reminders Window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {toastMessage && (
          <div className="px-6 py-2.5 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs font-mono-tech flex items-center justify-between animate-fade-in shrink-0">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </span>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Department Overview Banner */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#131622] via-[#0e1017] to-[#0a0b10] border border-emerald-500/30 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/70 border border-emerald-500/40 shrink-0 flex items-center justify-center p-1.5 shadow-md">
                  <img
                    src={department.logoUrl || university.logoUrl}
                    alt={department.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-white">
                      {department.name}
                    </h3>
                    {department.code && (
                      <span className="text-[10px] font-mono-tech uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                        {department.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono-tech text-zinc-400 mt-0.5">
                    {department.faculty} • {university.name}
                  </p>
                </div>
              </div>

              {/* Department Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="export-dept-csv-btn"
                  onClick={handleExportDeptCsv}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15 shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Department CSV</span>
                </button>

                <button
                  id="copy-all-dept-emails-btn"
                  onClick={handleCopyAllDeptEmails}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-500/30"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{copiedAll ? 'Copied All!' : 'Copy All Emails'}</span>
                </button>
              </div>
            </div>

            {/* Department Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10">
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono-tech text-zinc-400 uppercase tracking-wider block">Yearly Sets</span>
                <span className="text-lg font-mono-tech font-bold text-white">{departmentSets.length} Cohorts</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono-tech text-zinc-400 uppercase tracking-wider block">Total Graduates</span>
                <span className="text-lg font-mono-tech font-bold text-white">{allDeptGraduates.length} Alumni</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono-tech text-zinc-400 uppercase tracking-wider block">Verified Emails</span>
                <span className="text-lg font-mono-tech font-bold text-emerald-400">{totalSubscribed} Active</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono-tech text-zinc-400 uppercase tracking-wider block">Coverage Rate</span>
                <span className="text-lg font-mono-tech font-bold text-[#d4af37]">{coveragePercent}% Ready</span>
              </div>
            </div>
          </div>

          {/* Sets Accordion Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-syne font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>Yearly Class Sets &amp; Alumni Email Registry</span>
                  <span className="text-[11px] font-mono-tech text-zinc-400">({departmentSets.length} Sets)</span>
                </h4>
                <p className="text-xs text-zinc-400 font-sans mt-0.5">
                  Click any set&apos;s down arrow to reveal or hide its graduate email registry. Only one set can be revealed at a time.
                </p>
              </div>
            </div>

            {departmentSets.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center font-mono-tech text-xs text-zinc-400 space-y-2">
                <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                <p>No yearly sets registered under {department.name} yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {departmentSets.map((set) => {
                  const approvedStudents = set.students.filter((s) => s.approved !== false);
                  const setGraduates = approvedStudents.map((s) => ({
                    ...s,
                    ...getGraduateEmail(s, university.shortCode),
                  }));
                  const setSubscribedCount = setGraduates.filter((g) => g.isSubscribed && g.email).length;
                  const setCoverage = setGraduates.length > 0 ? Math.round((setSubscribedCount / setGraduates.length) * 100) : 0;
                  
                  const isExpanded = expandedSetId === set.id;
                  const searchKey = `${set.id}-modal-search`;
                  const query = (setSearchTerms[searchKey] || '').toLowerCase().trim();

                  const filteredGraduates = setGraduates.filter((g) => {
                    if (!query) return true;
                    return (
                      g.fullName.toLowerCase().includes(query) ||
                      (g.nickname && g.nickname.toLowerCase().includes(query)) ||
                      (g.email && g.email.toLowerCase().includes(query)) ||
                      (g.position && g.position.toLowerCase().includes(query))
                    );
                  });

                  return (
                    <div
                      key={set.id}
                      id={`annual-reminders-set-accordion-${set.id}`}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isExpanded
                          ? 'bg-[#10121a] border-emerald-500/50 shadow-xl'
                          : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/10'
                      }`}
                    >
                      {/* Set Summary Accordion Bar */}
                      <div 
                        onClick={() => handleToggleSet(set.id)}
                        className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-xl font-mono-tech font-bold text-xs flex items-center justify-center shrink-0 border ${
                            isExpanded 
                              ? 'bg-emerald-500 text-black border-emerald-400 shadow-md' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {set.graduationYear}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-syne font-bold text-sm sm:text-base text-white truncate max-w-[240px]">
                                {set.classSetName}
                              </h5>
                              <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                                Class of {set.graduationYear}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-xs font-mono-tech text-zinc-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-[#d4af37]" />
                                <span>{setGraduates.length} Portraits</span>
                              </span>
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Mail className="w-3 h-3" />
                                <span>{setSubscribedCount} Verified Emails ({setCoverage}%)</span>
                              </span>
                              {set.classRepName && (
                                <span className="text-zinc-500 hidden md:inline">
                                  Rep: {set.classRepName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Down Arrow Toggle Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            id={`down-arrow-toggle-${set.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSet(set.id);
                            }}
                            className={`px-3 py-1.5 rounded-xl font-mono-tech text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                              isExpanded
                                ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                                : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
                            }`}
                            aria-label={isExpanded ? 'Hide set details' : 'Reveal set details'}
                            title={isExpanded ? 'Click to collapse set' : 'Click down arrow to reveal set details'}
                          >
                            <span>{isExpanded ? 'Hide' : 'Reveal'}</span>
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-300 ${
                                isExpanded ? 'rotate-180 text-black' : 'text-emerald-400'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Revealed Compartment (strictly single set active at a time) */}
                      {isExpanded && (
                        <div className="p-4 sm:p-6 border-t border-white/10 space-y-4 bg-black/40 animate-fade-in">
                          
                          {/* Class Rep & Action Toolbar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                            <div>
                              {set.classRepName ? (
                                <p className="text-xs font-mono-tech text-zinc-300">
                                  <span className="text-[#d4af37] font-semibold">Designated Class Rep:</span>{' '}
                                  {set.classRepName} {set.classRepEmail && `• ${set.classRepEmail}`}{' '}
                                  {set.classRepPhone && `• ${set.classRepPhone}`}
                                </p>
                              ) : (
                                <p className="text-xs font-mono-tech text-zinc-500 italic">
                                  No dedicated class representative assigned.
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleCopySetEmails(setGraduates, set.graduationYear)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                                title="Copy all emails for this cohort"
                              >
                                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copy Emails</span>
                              </button>

                              <button
                                onClick={() => handleExportSetCsv(set, setGraduates)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                                title="Export set to CSV"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Export CSV</span>
                              </button>

                              <button
                                onClick={() => handleSimulateSetBlast(set, setSubscribedCount)}
                                disabled={isSendingBlast}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono-tech text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{isSendingBlast ? 'Dispatching...' : 'Dispatch Blast'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Classmates Search */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="relative w-full sm:w-72">
                              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input
                                type="text"
                                value={setSearchTerms[searchKey] || ''}
                                onChange={(e) =>
                                  setSetSearchTerms((prev) => ({
                                    ...prev,
                                    [searchKey]: e.target.value,
                                  }))
                                }
                                placeholder="Filter alumni by name, email..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white placeholder:text-zinc-600 font-mono-tech text-xs focus:border-emerald-400/50 focus:outline-none"
                              />
                            </div>

                            <span className="text-[11px] font-mono-tech text-zinc-400">
                              Showing {filteredGraduates.length} of {setGraduates.length} alumni in {set.graduationYear} set
                            </span>
                          </div>

                          {/* Graduates Table */}
                          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/50">
                            <table className="w-full text-left text-xs font-mono-tech">
                              <thead>
                                <tr className="border-b border-white/10 text-zinc-400 text-[11px] bg-white/[0.02]">
                                  <th className="py-2.5 px-3">Graduate</th>
                                  <th className="py-2.5 px-3">Role / Office</th>
                                  <th className="py-2.5 px-3">Primary Notification Email</th>
                                  <th className="py-2.5 px-3">Relive Status</th>
                                  <th className="py-2.5 px-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {filteredGraduates.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="py-8 text-center text-zinc-500 font-mono-tech text-xs">
                                      No classmates matched your search query.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredGraduates.map((g) => (
                                    <tr key={g.id} className="hover:bg-white/[0.03] transition-colors">
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2.5">
                                          <img
                                            src={g.photoUrl}
                                            alt={g.fullName}
                                            className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
                                          />
                                          <div>
                                            <p className="font-bold text-white text-xs font-body">{g.fullName}</p>
                                            {g.nickname && <p className="text-[10px] text-zinc-500 font-mono-tech">&ldquo;{g.nickname}&rdquo;</p>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-zinc-400">
                                        {g.position || 'Class Member'}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-zinc-300 truncate max-w-[190px]">{g.email}</span>
                                          <button
                                            onClick={() => handleCopyEmail(g.email)}
                                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                            title="Copy email"
                                          >
                                            {copiedEmail === g.email ? (
                                              <Check className="w-3 h-3 text-emerald-400" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </button>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        {g.isSubscribed ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            <Check className="w-3 h-3" />
                                            <span>Subscribed</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                                            <span>Unsubscribed</span>
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <button
                                          onClick={() => showToast(`Sent mock notification to ${g.fullName} (${g.email})`)}
                                          className="text-[11px] text-zinc-400 hover:text-emerald-400 hover:underline cursor-pointer"
                                        >
                                          Test Send
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Return to Master Host Dashboard Button */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-mono-tech transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Master Host Dashboard</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
