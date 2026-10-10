import React, { useState, useEffect, useRef } from 'react';
import { UniversityDirectoryItem, ClassSet, StudentProfile, DepartmentItem, EmailEventType, EmailLog, EmailTemplate, WebsiteContentOverride } from '../../types';
import { DepartmentAnnualRemindersModal } from './DepartmentAnnualRemindersModal';
import { ImageDropzone } from '../common/ImageDropzone';
import {
  getStoredEmailTemplates,
  saveStoredEmailTemplates,
  getStoredEmailLogs,
  saveStoredEmailLogs,
  logAndDispatchEmail,
  exportEmailLogsToCsv,
  interpolateTemplate,
  KOHOT_DEFAULT_TEMPLATES
} from '../../utils/kohotCommunications';
import {
  Calendar,
  Mail,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  Building2,
  ChevronDown,
  ChevronRight,
  Send,
  Users,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  ImageIcon,
  Layers,
  X,
  Clock,
  Edit3,
  RotateCcw,
  Eye,
  Download,
  Filter,
  Sliders,
  Bell,
  MessageCircle,
  Smartphone,
  Share2,
  ArrowRight
} from 'lucide-react';

interface MasterAnnualRemindersSectionProps {
  universities: UniversityDirectoryItem[];
  sets: ClassSet[];
  contentOverride?: WebsiteContentOverride;
  onUpdateContentOverride?: (content: WebsiteContentOverride) => void;
}

// Helper to resolve student email with realistic fallback for demo
export function getGraduateEmail(student: StudentProfile, uniShortCode: string): { email: string; isSubscribed: boolean } {
  if (student.email && student.email.trim().length > 0) {
    return { email: student.email.trim(), isSubscribed: true };
  }
  const idNum = parseInt(student.id.replace(/\D/g, '') || '1', 10);
  if (idNum % 9 === 0) {
    return { email: '', isSubscribed: false };
  }
  const clean = student.fullName.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
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

export const MasterAnnualRemindersSection: React.FC<MasterAnnualRemindersSectionProps> = ({
  universities,
  sets,
  contentOverride,
  onUpdateContentOverride,
}) => {
  // Main Section Navigation: Directory & Reminders vs Executive Blast vs Templates vs Audit History
  const [communicationsTab, setCommunicationsTab] = useState<'directory' | 'executive_blast' | 'templates' | 'audit_history'>('directory');

  // Executive Outreach Blast State
  const defaultBlastImg = contentOverride?.executiveBlastImageUrl || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85';
  const [blastImageUrl, setBlastImageUrl] = useState<string>(defaultBlastImg);
  const [targetBlastAudience, setTargetBlastAudience] = useState<string>('all');
  const [blastMessageClip, setBlastMessageClip] = useState<string>(() => {
    return contentOverride?.executiveBlastMessageTemplate ||
`Hello Department Executives & Student Leaders,

Preserve the heritage, memories, and individual student achievements of your department's graduating class on KoHot.

Establish your official Department Class Album, install your corridor Legacy Plaque, and ensure your graduating set is remembered across generations.

Create your Class Album today at:
{{website_url}}

KoHot — Beautiful graduate memories live here.`;
  });
  const [isSendingExecBlast, setIsSendingExecBlast] = useState(false);
  const [execBlastToast, setExecBlastToast] = useState<string | null>(null);
  const [copiedBlastLink, setCopiedBlastLink] = useState(false);
  const [copiedBlastMessage, setCopiedBlastMessage] = useState(false);
  const [imageSaveToast, setImageSaveToast] = useState(false);

  useEffect(() => {
    if (contentOverride?.executiveBlastImageUrl) {
      setBlastImageUrl(contentOverride.executiveBlastImageUrl);
    }
  }, [contentOverride?.executiveBlastImageUrl]);

  const handleUpdateBlastImage = (newUrl: string) => {
    setBlastImageUrl(newUrl);
    if (onUpdateContentOverride && contentOverride) {
      onUpdateContentOverride({
        ...contentOverride,
        executiveBlastImageUrl: newUrl,
      });
      setImageSaveToast(true);
      setTimeout(() => setImageSaveToast(false), 3000);
    }
  };

  // Directory & Reminders States
  const [viewMode, setViewMode] = useState<'hierarchy' | 'flat'>('hierarchy');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUniFilter, setSelectedUniFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');
  const [cronActive, setCronActive] = useState(true);
  const [isSendingBlast, setIsSendingBlast] = useState(false);
  const [blastToast, setBlastToast] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [selectedDeptForModal, setSelectedDeptForModal] = useState<{ dept: DepartmentItem; uni: UniversityDirectoryItem } | null>(null);

  // Expanded tree states
  const [expandedUnis, setExpandedUnis] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (universities[0]) init[universities[0].id] = true;
    return init;
  });

  const [selectedDeptPerUni, setSelectedDeptPerUni] = useState<Record<string, string>>({});
  const [setSearchTerms, setSetSearchTerms] = useState<Record<string, string>>({});

  // ==========================================
  // TEMPLATES MANAGEMENT STATE
  // ==========================================
  const [templates, setTemplates] = useState<Record<EmailEventType, EmailTemplate>>(getStoredEmailTemplates);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<EmailEventType>('class_album_is_live');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState(false);

  // Sync editor inputs when selected template changes
  useEffect(() => {
    const current = templates[selectedTemplateKey] || KOHOT_DEFAULT_TEMPLATES[selectedTemplateKey];
    if (current) {
      setEditSubject(current.subjectTemplate);
      setEditBody(current.bodyTemplate);
    }
  }, [selectedTemplateKey, templates]);

  // ==========================================
  // EMAIL AUDIT HISTORY STATE
  // ==========================================
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(getStoredEmailLogs);
  const [historySearch, setHistorySearch] = useState('');
  const [historyEventFilter, setHistoryEventFilter] = useState<string>('all');
  const [previewLog, setPreviewLog] = useState<EmailLog | null>(null);

  // Refresh logs when opening the tab
  useEffect(() => {
    if (communicationsTab === 'audit_history') {
      setEmailLogs(getStoredEmailLogs());
    }
  }, [communicationsTab]);

  const toggleUni = (uniId: string) => {
    setExpandedUnis((prev) => ({ ...prev, [uniId]: !prev[uniId] }));
  };

  const handleSelectDepartment = (uniId: string, deptId: string) => {
    setSelectedDeptPerUni((prev) => ({
      ...prev,
      [uniId]: prev[uniId] === deptId ? '' : deptId,
    }));
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard?.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Compile all graduates across all sets with metadata
  const allGraduates = sets.flatMap((set) => {
    const uni = universities.find(
      (u) =>
        u.id === set.institutionId ||
        set.institutionName.toLowerCase().includes(u.shortCode.toLowerCase()) ||
        set.institutionName.toLowerCase().includes(u.name.toLowerCase())
    );
    const uniShort = uni?.shortCode || 'UNI';
    const uniName = uni?.name || set.institutionName;

    return set.students
      .filter((s) => s.approved !== false)
      .map((student) => {
        const { email, isSubscribed } = getGraduateEmail(student, uniShort);
        return {
          ...student,
          resolvedEmail: email,
          isSubscribed,
          set,
          universityName: uniName,
          universityShortCode: uniShort,
          departmentName: set.departmentName,
          classSetName: set.classSetName,
          graduationYear: set.graduationYear,
        };
      });
  });

  // Global KPIs
  const totalGraduatesCount = allGraduates.length;
  const subscribedGraduatesCount = allGraduates.filter((g) => g.isSubscribed).length;
  const coveragePercent = totalGraduatesCount > 0 ? Math.round((subscribedGraduatesCount / totalGraduatesCount) * 100) : 0;

  // Filtered list for search and filters
  const filteredGraduates = allGraduates.filter((g) => {
    if (selectedUniFilter !== 'all' && g.set.institutionId !== selectedUniFilter && !g.universityShortCode.toLowerCase().includes(selectedUniFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter === 'subscribed' && !g.isSubscribed) return false;
    if (statusFilter === 'unsubscribed' && g.isSubscribed) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      g.fullName.toLowerCase().includes(term) ||
      (g.nickname && g.nickname.toLowerCase().includes(term)) ||
      (g.resolvedEmail && g.resolvedEmail.toLowerCase().includes(term)) ||
      g.departmentName.toLowerCase().includes(term) ||
      g.universityName.toLowerCase().includes(term) ||
      g.classSetName.toLowerCase().includes(term)
    );
  });

  // Export any list of graduates to CSV
  const exportGraduatesToCsv = (graduatesList: typeof allGraduates, filename: string) => {
    const headers = [
      'University',
      'Department',
      'Class Set',
      'Graduation Year',
      'Full Name',
      'Nickname',
      'Position / Role',
      'Registered Email',
      'Subscription Status',
      'Instagram / Twitter',
      'WhatsApp / Phone',
      'Parting Quote'
    ];

    const rows = graduatesList.map((g) => [
      `"${g.universityName.replace(/"/g, '""')}"`,
      `"${g.departmentName.replace(/"/g, '""')}"`,
      `"${g.classSetName.replace(/"/g, '""')}"`,
      `"${g.graduationYear}"`,
      `"${g.fullName.replace(/"/g, '""')}"`,
      `"${(g.nickname || '').replace(/"/g, '""')}"`,
      `"${(g.position || 'Member').replace(/"/g, '""')}"`,
      `"${(g.resolvedEmail || '').replace(/"/g, '""')}"`,
      `"${g.isSubscribed ? 'Active Subscriber' : 'Missing Email'}"`,
      `"${(g.instagramOrTwitter || '').replace(/"/g, '""')}"`,
      `"${(g.whatsappNumber || '').replace(/"/g, '""')}"`,
      `"${(g.quote || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger Annual Reminders Blast and log emails
  const handleTriggerBlast = () => {
    setIsSendingBlast(true);
    setBlastToast(null);

    setTimeout(() => {
      const activeGrads = allGraduates.filter((g) => g.isSubscribed && g.resolvedEmail);
      
      // Dispatch emails for the first batch of subscribers to populate audit history
      activeGrads.slice(0, 10).forEach((grad) => {
        logAndDispatchEmail({
          event: 'annual_legacy_reminder',
          recipientEmail: grad.resolvedEmail,
          recipientName: grad.fullName,
          variables: {
            recipientName: grad.fullName,
            departmentName: grad.departmentName,
            graduationYear: grad.graduationYear,
            institutionName: grad.universityName,
            albumUrl: `${window.location.origin}/#album-${grad.set.id}`,
            legacyPlaqueDetails: `${grad.universityName} Faculty Foyer Wall`,
          },
          metadata: {
            setId: grad.set.id,
            departmentName: grad.departmentName,
            graduationYear: grad.graduationYear,
            studentId: grad.id,
          },
        });
      });

      setEmailLogs(getStoredEmailLogs());
      setIsSendingBlast(false);
      setBlastToast(`Successfully dispatched automated Annual Reminders to ${activeGrads.length} verified graduate inboxes!`);
      setTimeout(() => setBlastToast(null), 5000);
    }, 1500);
  };

  // Save modified email template
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...templates,
      [selectedTemplateKey]: {
        ...templates[selectedTemplateKey],
        subjectTemplate: editSubject,
        bodyTemplate: editBody,
      },
    };
    setTemplates(updated);
    saveStoredEmailTemplates(updated);
    setTemplateSaveSuccess(true);
    setTimeout(() => setTemplateSaveSuccess(false), 3000);
  };

  // Reset current template to default
  const handleResetTemplate = () => {
    const def = KOHOT_DEFAULT_TEMPLATES[selectedTemplateKey];
    setEditSubject(def.subjectTemplate);
    setEditBody(def.bodyTemplate);
    const updated = {
      ...templates,
      [selectedTemplateKey]: def,
    };
    setTemplates(updated);
    saveStoredEmailTemplates(updated);
    setTemplateSaveSuccess(true);
    setTimeout(() => setTemplateSaveSuccess(false), 3000);
  };

  // Insert variable into template body
  const handleInsertVariable = (varName: string) => {
    setEditBody((prev) => prev + ` ${varName} `);
  };

  // Filtered Email Logs
  const filteredEmailLogs = emailLogs.filter((log) => {
    if (historyEventFilter !== 'all' && log.event !== historyEventFilter) return false;
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    return (
      log.recipientName.toLowerCase().includes(term) ||
      log.recipientEmail.toLowerCase().includes(term) ||
      log.subject.toLowerCase().includes(term) ||
      log.body.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 animate-fadeIn" id="kohot-communications-section">
      {/* SECTION HEADER & SUB-NAVIGATION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-semibold">
              KO-HOT SYSTEM ENGINE
            </span>
          </div>
          <h2 className="font-syne font-black text-2xl sm:text-3xl text-white tracking-tight flex items-center gap-3">
            <Mail className="w-7 h-7 text-[#d4af37]" />
            <span>KoHot Communications</span>
          </h2>
          <p className="font-body text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Centralized email hub managing automated Annual Legacy Reminders, graduate delivery directories, editable communication templates, and auditable delivery history.
          </p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/15 self-start md:self-auto shrink-0">
          <button
            type="button"
            id="tab-comms-directory"
            onClick={() => setCommunicationsTab('directory')}
            className={`px-4 py-2 rounded-xl font-mono-tech text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              communicationsTab === 'directory'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Annual Reminders ({totalGraduatesCount})</span>
          </button>

          <button
            type="button"
            id="tab-comms-exec-blast"
            onClick={() => setCommunicationsTab('executive_blast')}
            className={`px-4 py-2 rounded-xl font-mono-tech text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              communicationsTab === 'executive_blast'
                ? 'bg-[#d4af37] text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-black" />
            <span>Department Executives Blast</span>
          </button>

          <button
            type="button"
            id="tab-comms-templates"
            onClick={() => setCommunicationsTab('templates')}
            className={`px-4 py-2 rounded-xl font-mono-tech text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              communicationsTab === 'templates'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Email/Messages Templates</span>
          </button>

          <button
            type="button"
            id="tab-comms-history"
            onClick={() => setCommunicationsTab('audit_history')}
            className={`px-4 py-2 rounded-xl font-mono-tech text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              communicationsTab === 'audit_history'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Audit History ({emailLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Global Toast */}
      {blastToast && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono-tech flex items-center gap-3 animate-fadeIn shadow-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{blastToast}</span>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: ANNUAL REMINDERS & GRADUATE SUBSCRIBER DIRECTORY
          ========================================================================= */}
      {communicationsTab === 'directory' && (
        <div className="space-y-8 animate-fadeIn">
          {/* KPI STATS BAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-1">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>Total Preserved Graduates</span>
              </span>
              <p className="font-syne font-black text-2xl sm:text-3xl text-white">
                {totalGraduatesCount}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono-tech">Across {sets.length} Class Albums</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-1">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Email Inboxes</span>
              </span>
              <p className="font-syne font-black text-2xl sm:text-3xl text-emerald-400">
                {subscribedGraduatesCount}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono-tech">{coveragePercent}% inbox reach coverage</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0c0d14] border border-white/10 space-y-1">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Automated Relive Cron</span>
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono-tech font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono-tech">Perpetual annual convocation anniversary</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0c0d14] border border-white/10 flex flex-col justify-between space-y-2">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Export Directory</span>
              </span>
              <button
                type="button"
                onClick={() => exportGraduatesToCsv(allGraduates, `kohot-graduates-registry-${new Date().toISOString().split('T')[0]}.csv`)}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV ({totalGraduatesCount})</span>
              </button>
            </div>
          </div>

          {/* ACTION BAR: SEARCH, FILTERS & MANUAL BLAST */}
          <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search graduate, email, or dept..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>

              <select
                value={selectedUniFilter}
                onChange={(e) => setSelectedUniFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-zinc-300 font-mono-tech text-xs focus:outline-none"
              >
                <option value="all">All Universities</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.shortCode} • {u.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-zinc-300 font-mono-tech text-xs focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="subscribed">Subscribed Only</option>
                <option value="unsubscribed">Missing Email</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <button
                type="button"
                onClick={handleTriggerBlast}
                disabled={isSendingBlast}
                className="px-4 py-2 rounded-xl bg-[#d4af37] hover:bg-[#c49f2f] text-black font-tech text-xs tracking-wider uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-black" />
                <span>{isSendingBlast ? 'Dispatched Inboxes...' : 'Trigger Annual Blast Now'}</span>
              </button>
            </div>
          </div>

          {/* GRADUATE DIRECTORY TABLE */}
          <div className="rounded-2xl bg-[#0c0d14] border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <span className="font-syne font-bold text-sm text-white">
                  Graduate Registry &amp; Annual Delivery List
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 text-[10px] font-mono-tech">
                  {filteredGraduates.length} results
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-black/40 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                    <th className="p-3.5">Graduate</th>
                    <th className="p-3.5">University &amp; Dept</th>
                    <th className="p-3.5">Class Set</th>
                    <th className="p-3.5">Email Destination</th>
                    <th className="p-3.5">Delivery Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono-tech">
                  {filteredGraduates.slice(0, 50).map((grad) => (
                    <tr key={`${grad.set.id}-${grad.id}`} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={grad.photoUrl}
                            alt={grad.fullName}
                            className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                          <div>
                            <p className="font-body font-semibold text-white truncate max-w-[160px]">
                              {grad.fullName}
                            </p>
                            <span className="text-[10px] text-zinc-500">
                              {grad.position || 'Member'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-zinc-300">
                        <p className="truncate max-w-[180px] font-body text-zinc-200">
                          {grad.departmentName}
                        </p>
                        <span className="text-[10px] text-zinc-500">{grad.universityShortCode}</span>
                      </td>
                      <td className="p-3.5 text-zinc-300">
                        Class of {grad.graduationYear}
                      </td>
                      <td className="p-3.5">
                        {grad.resolvedEmail ? (
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            <span className="truncate max-w-[180px]">{grad.resolvedEmail}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(grad.resolvedEmail)}
                              className="text-zinc-500 hover:text-white cursor-pointer"
                              title="Copy email"
                            >
                              {copiedEmail === grad.resolvedEmail ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic">No email registered</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {grad.isSubscribed ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                            Active Subscriber
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                            Pending Contact
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <a
                          href={`#album-${grad.set.id}`}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[10px] uppercase font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <span>Album</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: DEPARTMENT EXECUTIVES ALBUM BLAST & LINK CONTEXT ASSET MANAGER
          Clip section where the owner can blast messages to department executives
          to create their album, landing on the website page with an editable graduate image.
          ========================================================================= */}
      {communicationsTab === 'executive_blast' && (
        <div className="space-y-8 animate-fadeIn" id="executive-blast-section">
          {/* Section Overview Header */}
          <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-[#d4af37]">
              <Sparkles className="w-4 h-4" />
              <span className="font-mono-tech text-[11px] uppercase tracking-wider font-bold">
                Executive Outreach &amp; Album Creation Engine
              </span>
            </div>
            <h3 className="font-syne font-black text-xl sm:text-2xl text-white">
              Blast Outreach to Department Executives
            </h3>
            <p className="font-body text-xs sm:text-sm text-zinc-300 max-w-3xl leading-relaxed">
              Compose and dispatch broadcast messages directly to department executive leadership and student union representatives across universities inviting them to create their graduating class album. Links sent here land directly on the <strong>KoHot website homepage</strong>.
            </p>
          </div>

          {/* Toast notices */}
          {execBlastToast && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono-tech flex items-center gap-3 animate-fadeIn shadow-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{execBlastToast}</span>
            </div>
          )}

          {imageSaveToast && (
            <div className="p-4 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-xs font-mono-tech flex items-center gap-3 animate-fadeIn shadow-xl">
              <Check className="w-4 h-4 text-[#d4af37] shrink-0" />
              <span>Broadcast Link Context Image updated and saved permanently to platform assets!</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: CONTEXT IMAGE EDITOR & MESSAGE COMPOSER */}
            <div className="lg:col-span-7 space-y-6">
              {/* AREA 1: CONTEXT IMAGE MANAGER (GRADUATES PHOTO) */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-2.5">
                    <ImageIcon className="w-5 h-5 text-[#d4af37]" />
                    <div>
                      <h4 className="font-syne font-bold text-sm text-white">
                        Platform Links Context Image (Graduates Photo)
                      </h4>
                      <p className="text-zinc-400 text-xs font-body mt-0.5">
                        Carried across blast message links, Next Class relay links, and Other Department invites.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateBlastImage('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85')}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-xs self-start sm:self-auto cursor-pointer transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>

                <div className="space-y-4">
                  <ImageDropzone
                    value={blastImageUrl}
                    onChange={(url) => handleUpdateBlastImage(url)}
                    aspectRatio="16:9"
                    maxDimension={1200}
                    helperText="Upload or drag & drop a high-resolution photo of graduating students/celebration. Automatically optimized for social cards."
                  />

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono-tech uppercase text-zinc-400 font-semibold">
                      Direct Context Image URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={blastImageUrl}
                        onChange={(e) => setBlastImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="flex-1 px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-[#d4af37]"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateBlastImage(blastImageUrl)}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs cursor-pointer border border-white/20 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-[11px] font-mono-tech">
                    <span className="text-zinc-500 shrink-0 font-semibold">Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateBlastImage('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&auto=format&fit=crop&q=85')}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 shrink-0 cursor-pointer"
                    >
                      Graduation Caps
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateBlastImage('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&auto=format&fit=crop&q=85')}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 shrink-0 cursor-pointer"
                    >
                      Cohort Convocation
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateBlastImage('https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=85')}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 shrink-0 cursor-pointer"
                    >
                      Alumni Group Smile
                    </button>
                  </div>
                </div>
              </div>

              {/* AREA 2: MESSAGE CLIP COMPOSER */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="font-syne font-bold text-sm text-white">
                      Executive Outreach Message Clip
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono-tech text-zinc-500 uppercase">
                    Variable: {'{{website_url}}'}
                  </span>
                </div>

                {/* Audience Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono-tech uppercase text-zinc-400 font-semibold">
                    Target Department Executives Audience
                  </label>
                  <select
                    value={targetBlastAudience}
                    onChange={(e) => setTargetBlastAudience(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="all">
                      All Universities &amp; All Departments ({universities.reduce((acc, u) => acc + (u.departments?.length || 0), 0)} Departments)
                    </option>
                    {universities.map((uni) => (
                      <option key={uni.id} value={uni.id}>
                        {uni.name} ({uni.departments?.length || 0} Departments)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Link Info Box */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[10px] uppercase text-zinc-400 font-bold">
                      Destination Landing Link
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px]">
                      Lands on Website Homepage
                    </span>
                  </div>
                  <p className="font-mono-tech text-xs text-[#d4af37] break-all select-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/?ref=dept_exec_blast` : 'https://kohot.com/?ref=dept_exec_blast'}
                  </p>
                </div>

                {/* Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-mono-tech uppercase text-zinc-400 font-semibold">
                      Outreach Message Text *
                    </label>
                    <button
                      type="button"
                      onClick={() => setBlastMessageClip((prev) => prev + ' {{website_url}}')}
                      className="text-[10px] font-mono-tech text-[#d4af37] hover:underline cursor-pointer"
                    >
                      + Insert {'{{website_url}}'}
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={blastMessageClip}
                    onChange={(e) => setBlastMessageClip(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-black/60 border border-white/15 text-white text-xs font-body leading-relaxed focus:outline-none focus:border-[#d4af37] resize-y"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono-tech text-zinc-500">
                    Auto-interpolates website URL when dispatched
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateContentOverride && contentOverride) {
                        onUpdateContentOverride({
                          ...contentOverride,
                          executiveBlastMessageTemplate: blastMessageClip,
                        });
                        setExecBlastToast('Message template saved to platform configuration!');
                        setTimeout(() => setExecBlastToast(null), 3000);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs transition-colors cursor-pointer border border-white/15"
                  >
                    Save As Default Template
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: LIVE CONTEXT CARD PREVIEW & DISPATCH BAR */}
            <div className="lg:col-span-5 space-y-6">
              {/* LIVE SOCIAL / MESSAGING CARD PREVIEW */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="font-syne font-bold text-sm text-white">
                      Shared Link Card Preview
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono-tech text-emerald-400">
                    Live Context Preview
                  </span>
                </div>

                <p className="text-zinc-400 text-xs font-body">
                  When recipients receive this link via WhatsApp, Telegram, or social media, it displays the visual card below with your graduate image:
                </p>

                {/* Simulated Social Card */}
                <div className="rounded-2xl border border-white/15 bg-black overflow-hidden shadow-2xl transition-all hover:border-[#d4af37]/40">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/80">
                    <img
                      src={blastImageUrl}
                      alt="Graduates Context"
                      className="w-full h-full object-cover filter contrast-[1.05]"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[10px] font-mono-tech uppercase text-[#d4af37] font-bold">
                      KoHot Album Platform
                    </div>
                  </div>

                  <div className="p-4 space-y-2 bg-[#121420]">
                    <span className="text-[10px] font-mono-tech uppercase text-zinc-500 font-bold block">
                      kohot.com • Direct Department Invitation
                    </span>
                    <h5 className="font-syne font-bold text-sm text-white leading-snug">
                      Preserve Your Department Class Album — KoHot
                    </h5>
                    <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed">
                      Establish the official permanent archive and corridor Legacy Plaque for your graduating class. Beautiful graduate memories live here.
                    </p>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-mono-tech text-emerald-400 font-semibold">
                        Destination: Website Homepage
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* MULTI-CHANNEL DISPATCH BAR */}
              <div className="p-6 rounded-3xl bg-[#0c0d14] border border-white/10 space-y-4 shadow-xl">
                <h4 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#d4af37]" />
                  <span>Outreach &amp; Dispatch Channels</span>
                </h4>

                {/* Primary Blast Email Action */}
                <button
                  type="button"
                  id="blast-email-to-executives-btn"
                  disabled={isSendingExecBlast}
                  onClick={() => {
                    setIsSendingExecBlast(true);
                    setTimeout(() => {
                      const allDepts = universities
                        .filter((u) => targetBlastAudience === 'all' || u.id === targetBlastAudience)
                        .flatMap((u) => (u.departments || []).map((d) => ({ dept: d, uni: u })));

                      allDepts.slice(0, 15).forEach(({ dept, uni }) => {
                        const email = dept.officialPortal && dept.officialPortal.includes('@')
                          ? dept.officialPortal
                          : `executives.${dept.code?.toLowerCase() || 'admin'}@${uni.shortCode.toLowerCase()}.edu.ng`;
                        logAndDispatchEmail({
                          event: 'class_album_is_live',
                          recipientEmail: email,
                          recipientName: dept.hodName || `${dept.name} Executives`,
                          variables: {
                            recipientName: dept.hodName || `${dept.name} Executives`,
                            departmentName: dept.name,
                            graduationYear: 2026,
                            institutionName: uni.name,
                            albumUrl: `${window.location.origin}/?ref=dept_exec_blast`,
                            legacyPlaqueDetails: `${uni.name} Corridors`,
                          },
                          metadata: {
                            departmentName: dept.name,
                          },
                        });
                      });

                      setEmailLogs(getStoredEmailLogs());
                      setIsSendingExecBlast(false);
                      setExecBlastToast(`Dispatched executive invitation clip to ${allDepts.length} department executive portals!`);
                      setTimeout(() => setExecBlastToast(null), 5000);
                    }, 1200);
                  }}
                  className="w-full py-3.5 rounded-full bg-[#d4af37] hover:bg-[#e6c158] text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 text-black" />
                  <span>{isSendingExecBlast ? 'Dispatching...' : 'Blast Email to Department Executives'}</span>
                </button>

                {/* Messaging Channels Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* WhatsApp */}
                  <button
                    type="button"
                    onClick={() => {
                      const webUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=dept_exec_blast` : 'https://kohot.com/?ref=dept_exec_blast';
                      const msg = blastMessageClip.replace(/{{website_url}}/g, webUrl);
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="p-3 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-white flex items-center justify-center gap-2 font-mono-tech text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                    <span>WhatsApp</span>
                  </button>

                  {/* Telegram */}
                  <button
                    type="button"
                    onClick={() => {
                      const webUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=dept_exec_blast` : 'https://kohot.com/?ref=dept_exec_blast';
                      const msg = blastMessageClip.replace(/{{website_url}}/g, webUrl);
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(webUrl)}&text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="p-3 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-white flex items-center justify-center gap-2 font-mono-tech text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <Send className="w-4 h-4 text-sky-400" />
                    <span>Telegram</span>
                  </button>

                  {/* Copy Link */}
                  <button
                    type="button"
                    onClick={() => {
                      const webUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=dept_exec_blast` : 'https://kohot.com/?ref=dept_exec_blast';
                      navigator.clipboard.writeText(webUrl);
                      setCopiedBlastLink(true);
                      setTimeout(() => setCopiedBlastLink(false), 3000);
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white flex items-center justify-center gap-2 font-mono-tech text-xs cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    {copiedBlastLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedBlastLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>

                  {/* Device Native Share */}
                  <button
                    type="button"
                    onClick={() => {
                      const webUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=dept_exec_blast` : 'https://kohot.com/?ref=dept_exec_blast';
                      const msg = blastMessageClip.replace(/{{website_url}}/g, webUrl);
                      if (navigator.share) {
                        navigator.share({
                          title: 'Create Your Department Class Album — KoHot',
                          text: msg,
                          url: webUrl,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(msg);
                        setCopiedBlastMessage(true);
                        setTimeout(() => setCopiedBlastMessage(false), 3000);
                      }
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white flex items-center justify-center gap-2 font-mono-tech text-xs cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <Share2 className="w-4 h-4 text-[#d4af37]" />
                    <span>Native Share</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const webUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=dept_exec_blast` : 'https://kohot.com/?ref=dept_exec_blast';
                      const msg = blastMessageClip.replace(/{{website_url}}/g, webUrl);
                      navigator.clipboard.writeText(msg);
                      setCopiedBlastMessage(true);
                      setTimeout(() => setCopiedBlastMessage(false), 3000);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-300 font-mono-tech text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedBlastMessage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBlastMessage ? 'Full Clip & Link Copied!' : 'Copy Full Message Text & Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: EMAIL TEMPLATES STUDIO (WITH DYNAMIC VARIABLES)
          ========================================================================= */}
      {communicationsTab === 'templates' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Template Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 no-scrollbar">
            {Object.keys(KOHOT_DEFAULT_TEMPLATES).map((key) => {
              const evtKey = key as EmailEventType;
              const tmpl = templates[evtKey] || KOHOT_DEFAULT_TEMPLATES[evtKey];
              return (
                <button
                  key={evtKey}
                  type="button"
                  onClick={() => setSelectedTemplateKey(evtKey)}
                  className={`px-4 py-2.5 rounded-full text-xs font-mono-tech uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                    selectedTemplateKey === evtKey
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-[#0c0d14] hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{tmpl.name}</span>
                </button>
              );
            })}
          </div>

          {/* Template Editor Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Editor Form */}
            <form onSubmit={handleSaveTemplate} className="lg:col-span-7 p-6 rounded-3xl bg-[#0c0d14] border border-white/15 space-y-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="font-syne font-bold text-base text-white">
                    {templates[selectedTemplateKey]?.name || 'Edit Message Template'}
                  </h3>
                  <p className="font-body text-xs text-zinc-400 mt-0.5">
                    {templates[selectedTemplateKey]?.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-mono-tech flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reset to factory KoHot default template"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Dynamic Variables Chips */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#d4af37]" />
                    <span>Dynamic System Variables (Click to Insert)</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono-tech">
                    Auto-interpolated on dispatch
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {templates[selectedTemplateKey]?.availableVariables.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => handleInsertVariable(variable)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#d4af37] border border-[#d4af37]/30 text-xs font-mono-tech transition-all cursor-pointer hover:scale-105 active:scale-95"
                      title={`Click to insert ${variable} into template body`}
                    >
                      {variable}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Line */}
              <div className="space-y-1.5">
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                  Email Subject Line *
                </label>
                <input
                  required
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="e.g. Relive Your Cohort Legacy — Class of {graduationYear}"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono-tech focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Body Textarea */}
              <div className="space-y-1.5">
                <label className="block font-mono-tech text-[11px] uppercase tracking-wider text-zinc-300">
                  Email Message Body (Plain Text &amp; Variables) *
                </label>
                <textarea
                  required
                  rows={10}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Enter email message body..."
                  className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-body leading-relaxed focus:outline-none focus:border-white/30 resize-y"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                >
                  Save Template Changes
                </button>

                {templateSaveSuccess && (
                  <span className="font-mono-tech text-xs text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Template saved successfully!</span>
                  </span>
                )}
              </div>
            </form>

            {/* Right: Live Preview Box */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-[#08090e] border border-white/10 space-y-4 shadow-xl flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="font-syne font-bold text-sm text-white">
                    Live Rendered Preview
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono-tech text-zinc-400">
                  Sample Graduate Data
                </span>
              </div>

              {/* Mock Email Client Shell */}
              <div className="flex-1 rounded-2xl bg-black/80 border border-white/15 p-5 space-y-4 font-body text-xs text-zinc-300">
                <div className="border-b border-white/10 pb-3 space-y-1 font-mono-tech text-[11px]">
                  <p className="text-zinc-500">
                    From: <span className="text-zinc-300">KoHot Communications &lt;archive@kohot.live&gt;</span>
                  </p>
                  <p className="text-zinc-500">
                    To: <span className="text-zinc-300">Adewale Fakorede &lt;adewale.f@alumni.unilag.edu.ng&gt;</span>
                  </p>
                  <p className="text-white font-bold pt-1 text-xs">
                    Subject: {interpolateTemplate(editSubject, {
                      recipientName: 'Adewale Fakorede',
                      departmentName: 'Computer Sciences',
                      graduationYear: 2026,
                      institutionName: 'University of Lagos',
                      albumUrl: 'https://kohot.live/#album-unilag-cs-2026',
                    })}
                  </p>
                </div>

                <div className="whitespace-pre-wrap leading-relaxed font-body text-zinc-200">
                  {interpolateTemplate(editBody, {
                    recipientName: 'Adewale Fakorede',
                    departmentName: 'Computer Sciences',
                    graduationYear: 2026,
                    institutionName: 'University of Lagos',
                    albumUrl: 'https://kohot.live/#album-unilag-cs-2026',
                    adminContact: 'classrep.unilag@gmail.com',
                    legacyPlaqueDetails: 'Faculty of Science Foyer, North Wing',
                    supportEmail: 'support@kohot.live',
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: AUDIT HISTORY LOG (SEARCHABLE & EXPORTABLE)
          ========================================================================= */}
      {communicationsTab === 'audit_history' && (
        <div className="space-y-6 animate-fadeIn">
          {/* History Controls Bar */}
          <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative min-w-[260px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search recipient, email, or subject..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
                />
              </div>

              <select
                value={historyEventFilter}
                onChange={(e) => setHistoryEventFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-zinc-300 font-mono-tech text-xs focus:outline-none"
              >
                <option value="all">All Notification Events</option>
                <option value="album_registration_received">Album Registration Received</option>
                <option value="album_registration_approved">Album Registration Approved</option>
                <option value="class_album_is_live">Class Album is Live</option>
                <option value="annual_legacy_reminder">Annual Legacy Reminder</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => exportEmailLogsToCsv(filteredEmailLogs)}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow self-end md:self-auto shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV ({filteredEmailLogs.length})</span>
            </button>
          </div>

          {/* Email Logs Table */}
          <div className="rounded-2xl bg-[#0c0d14] border border-white/10 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span className="font-syne font-bold text-sm text-white">
                  Audited Communication Logs
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 text-[10px] font-mono-tech">
                  {filteredEmailLogs.length} total dispatches
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-black/40 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Channel</th>
                    <th className="p-3.5">Recipient</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Subject / Summary</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">View Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono-tech">
                  {filteredEmailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 text-zinc-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                          log.channel === 'whatsapp'
                            ? 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30'
                            : log.channel === 'sms'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : log.channel === 'telegram'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-white/10 text-zinc-300 border-white/20'
                        }`}>
                          {log.channel || 'email'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <p className="font-body font-semibold text-white truncate max-w-[150px]">
                          {log.recipientName}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate max-w-[160px]">
                          {log.recipientEmail}
                        </p>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold border ${
                          log.category === 'owner_routine_alert'
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                            : log.category === 'manual_operational'
                            ? 'bg-amber-400/10 text-amber-300 border-amber-400/20'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        }`}>
                          {(log.category || 'product_email').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <p className="font-body text-zinc-300 truncate max-w-[200px]">
                          {log.subject}
                        </p>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Sent
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewLog(log)}
                          className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[10px] uppercase font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Body</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW AUDITED EMAIL BODY */}
      {previewLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xl rounded-3xl bg-[#0c0d14] border border-white/20 p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#d4af37]" />
                <span className="font-syne font-bold text-base text-white">
                  Audited Email Message
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLog(null)}
                className="text-zinc-500 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-black/60 border border-white/10 font-mono-tech text-xs text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Recipient:</span>
                <span className="text-white font-semibold">{previewLog.recipientName} &lt;{previewLog.recipientEmail}&gt;</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Event:</span>
                <span className="text-emerald-400 uppercase">{previewLog.event.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Timestamp:</span>
                <span>{new Date(previewLog.timestamp).toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-white/10">
                <span className="text-zinc-500 block mb-1">Subject:</span>
                <span className="text-white font-bold">{previewLog.subject}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 font-body text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
              {previewLog.body}
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPreviewLog(null)}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-tech text-xs tracking-wider uppercase font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEPARTMENT MODAL */}
      {selectedDeptForModal && (
        <DepartmentAnnualRemindersModal
          isOpen={true}
          department={selectedDeptForModal.dept}
          university={selectedDeptForModal.uni}
          sets={sets}
          onClose={() => setSelectedDeptForModal(null)}
        />
      )}
    </div>
  );
};
