import React, { useState } from 'react';
import { 
  Users, 
  Share2, 
  MessageCircle, 
  Smartphone, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  Send, 
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  Filter,
  Eye
} from 'lucide-react';
import { 
  ClassSet, 
  UniversityDirectoryItem, 
  NextClassHandoffInvite, 
  NextClassRepresentativeRecord 
} from '../../types';
import { 
  getStoredNextClassInvites, 
  saveStoredNextClassInvites,
  getStoredSets,
  saveStoredSets 
} from '../../data/initialData';
import { 
  logManualCommunication, 
  interpolateTemplate, 
  KOHOT_DEFAULT_TEMPLATES 
} from '../../utils/kohotCommunications';
import { copyUrlToClipboard } from '../../utils/urlHelper';
import { getWhatsAppDigits, formatNigerianPhoneNumber } from '../../utils/phoneFormatter';

interface MasterNextClassHandoffsSectionProps {
  sets: ClassSet[];
  universities: UniversityDirectoryItem[];
  onViewDepartmentLegacyWall?: (deptId: string, uniId?: string) => void;
}

export const MasterNextClassHandoffsSection: React.FC<MasterNextClassHandoffsSectionProps> = ({
  sets,
  universities,
  onViewDepartmentLegacyWall,
}) => {
  const [invites, setInvites] = useState<NextClassHandoffInvite[]>(getStoredNextClassInvites);
  const [currentSets, setCurrentSets] = useState<ClassSet[]>(sets);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State for Manual Follow Up
  const [selectedSetForFollowup, setSelectedSetForFollowup] = useState<{
    set: ClassSet;
    invite?: NextClassHandoffInvite;
    contact?: NextClassRepresentativeRecord;
    nextYear: number;
    status: NextClassHandoffInvite['status'] | 'not_invited' | 'approved';
  } | null>(null);

  const [followupChannel, setFollowupChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [customMessage, setCustomMessage] = useState('');
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Combine sets and their respective next-class records
  const handoffRecords = currentSets.map((set) => {
    const nextYear = (set.graduationYear || 2026) + 1;
    const invite = invites.find((i) => i.fromSetId === set.id || (i.targetDepartmentId === set.departmentId && i.targetClassYear === nextYear));
    const contact = set.nextClassContact || (invite ? {
      name: invite.targetContactName,
      phoneOrWhatsapp: invite.targetContactPhone,
      email: invite.targetContactEmail,
      graduatingYear: nextYear,
    } : undefined);

    let effectiveStatus = invite?.status || 'not_invited';
    // If the next set already exists in live sets, mark as approved
    const nextSetExists = currentSets.some((s) => s.departmentId === set.departmentId && s.graduationYear === nextYear);
    if (nextSetExists) {
      effectiveStatus = 'approved';
    }

    return {
      set,
      invite,
      contact,
      nextYear,
      status: effectiveStatus,
    };
  });

  // Filter records
  const filteredRecords = handoffRecords.filter((rec) => {
    if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDept = rec.set.departmentName?.toLowerCase().includes(q);
      const matchUni = rec.set.institutionName?.toLowerCase().includes(q);
      const matchRep = rec.contact?.name.toLowerCase().includes(q) || rec.set.classRepName?.toLowerCase().includes(q);
      const matchYear = String(rec.nextYear).includes(q) || String(rec.set.graduationYear).includes(q);
      return matchDept || matchUni || matchRep || matchYear;
    }
    return true;
  });

  // Statistics
  const totalCohorts = handoffRecords.length;
  const approvedCohorts = handoffRecords.filter((r) => r.status === 'approved').length;
  const invitedCohorts = handoffRecords.filter((r) => r.status === 'invited' || r.status === 'accepted' || r.status === 'requested').length;
  const inactiveCohorts = handoffRecords.filter((r) => r.status === 'not_invited' || r.status === 'inactive').length;

  // Open manual follow-up modal
  const handleOpenFollowupModal = (rec: typeof handoffRecords[0]) => {
    const inviteCode = rec.invite?.inviteCode || `BATON-${(rec.set.departmentCode || 'DEPT').slice(0, 4)}-${rec.nextYear}-${Math.floor(1000 + Math.random() * 9000)}`;
    const inviteLink = `${window.location.origin}/?next_class_invite=${inviteCode}&dept=${rec.set.departmentId}&uni=${rec.set.institutionId}&year=${rec.nextYear}&from_year=${rec.set.graduationYear}`;

    const defaultContactName = rec.contact?.name || 'Incoming Class Representative';
    const initialText = interpolateTemplate(
      KOHOT_DEFAULT_TEMPLATES.owner_manual_whatsapp_followup.bodyTemplate,
      {
        targetContactName: defaultContactName,
        targetClassYear: rec.nextYear,
        departmentName: rec.set.departmentName,
        institutionName: rec.set.institutionName,
        fromClassYear: rec.set.graduationYear,
        fromAdminName: rec.set.classRepName,
        inviteLink,
      }
    );

    setCustomMessage(initialText);
    setFollowupChannel('whatsapp');
    setSelectedSetForFollowup(rec);
  };

  // Switch follow up template
  const handleSwitchTemplateChannel = (channel: 'whatsapp' | 'sms') => {
    setFollowupChannel(channel);
    if (!selectedSetForFollowup) return;

    const { set, contact, nextYear, invite } = selectedSetForFollowup;
    const inviteCode = invite?.inviteCode || `BATON-${(set.departmentCode || 'DEPT').slice(0, 4)}-${nextYear}-9999`;
    const inviteLink = `${window.location.origin}/?next_class_invite=${inviteCode}&dept=${set.departmentId}&uni=${set.institutionId}&year=${nextYear}&from_year=${set.graduationYear}`;

    const template = KOHOT_DEFAULT_TEMPLATES.owner_manual_whatsapp_followup.bodyTemplate;

    const populated = interpolateTemplate(template, {
      targetContactName: contact?.name || 'Incoming Representative',
      targetClassYear: nextYear,
      departmentName: set.departmentName,
      institutionName: set.institutionName,
      fromClassYear: set.graduationYear,
      fromAdminName: set.classRepName,
      inviteLink,
    });

    setCustomMessage(populated);
  };

  // Perform personal send
  const handleExecuteSend = (channel: 'whatsapp' | 'sms') => {
    if (!selectedSetForFollowup) return;

    const { set, contact, nextYear, invite } = selectedSetForFollowup;
    const phone = contact?.phoneOrWhatsapp || '';
    const cleanDigits = phone.replace(/[^0-9+]/g, '');

    // 1. Log manual communication
    logManualCommunication({
      channel,
      recipientContact: phone || 'Owner Follow-up',
      recipientName: contact?.name || `Class of ${nextYear} Representative`,
      event: 'owner_manual_whatsapp_followup',
      subjectOrSummary: `Owner Manual Outreach: ${set.departmentName} (${nextYear})`,
      bodySnippet: customMessage,
      metadata: {
        setId: set.id,
        departmentName: set.departmentName,
        graduationYear: set.graduationYear,
        nextClassYear: nextYear,
        initiatedBy: 'KoHot Master Host',
      },
    });

    // 2. Update invite history
    const nowIso = new Date().toISOString();
    const updatedInvite: NextClassHandoffInvite = {
      id: invite?.id || `invite-${set.id}-${nextYear}`,
      fromSetId: set.id,
      fromAdminName: set.classRepName,
      fromAdminEmail: set.classRepEmail,
      fromClassYear: set.graduationYear,
      targetUniversityId: set.institutionId,
      targetUniversityName: set.institutionName,
      targetDepartmentId: set.departmentId,
      targetDepartmentName: set.departmentName,
      targetClassYear: nextYear,
      targetContactName: contact?.name || 'Incoming Representative',
      targetContactPhone: contact?.phoneOrWhatsapp || '',
      targetContactEmail: contact?.email,
      inviteCode: invite?.inviteCode || `BATON-${(set.departmentCode || 'DEPT').slice(0, 4)}-${nextYear}-9999`,
      status: 'invited',
      channel,
      lastSentAt: nowIso,
      createdAt: invite?.createdAt || nowIso,
      history: [
        ...(invite?.history || []),
        {
          action: `KoHot Owner Manual Follow-up via ${channel.toUpperCase()}`,
          timestamp: nowIso,
          actor: 'KoHot Master Host',
          channel,
        },
      ],
    };

    const allInvites = getStoredNextClassInvites();
    const newInvitesList = [updatedInvite, ...allInvites.filter((i) => i.id !== updatedInvite.id)];
    saveStoredNextClassInvites(newInvitesList);
    setInvites(newInvitesList);

    // 3. Open appropriate client
    const encoded = encodeURIComponent(customMessage);
    if (channel === 'whatsapp') {
      const waDigits = getWhatsAppDigits(phone);
      const waUrl = waDigits
        ? `https://wa.me/${waDigits}?text=${encoded}`
        : `https://wa.me/?text=${encoded}`;
      window.open(waUrl, '_blank');
    } else {
      const formattedPhone = formatNigerianPhoneNumber(phone);
      const smsUrl = formattedPhone
        ? `sms:${formattedPhone}?body=${encoded}`
        : `sms:?body=${encoded}`;
      window.location.href = smsUrl;
    }

    setActionSuccessMsg(`Manual ${channel.toUpperCase()} outreach logged and client opened.`);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  const handleUpdateStatusManual = (
    rec: {
      set: ClassSet;
      invite?: NextClassHandoffInvite;
      contact?: NextClassRepresentativeRecord;
      nextYear: number;
    },
    newStatus: NextClassHandoffInvite['status']
  ) => {
    const nowIso = new Date().toISOString();
    const updatedInvite: NextClassHandoffInvite = {
      id: rec.invite?.id || `invite-${rec.set.id}-${rec.nextYear}`,
      fromSetId: rec.set.id,
      fromAdminName: rec.set.classRepName,
      fromAdminEmail: rec.set.classRepEmail,
      fromClassYear: rec.set.graduationYear,
      targetUniversityId: rec.set.institutionId,
      targetUniversityName: rec.set.institutionName,
      targetDepartmentId: rec.set.departmentId,
      targetDepartmentName: rec.set.departmentName,
      targetClassYear: rec.nextYear,
      targetContactName: rec.contact?.name || 'Representative',
      targetContactPhone: rec.contact?.phoneOrWhatsapp || '',
      targetContactEmail: rec.contact?.email,
      inviteCode: rec.invite?.inviteCode || `BATON-${(rec.set.departmentCode || 'DEPT').slice(0, 4)}-${rec.nextYear}-9999`,
      status: newStatus,
      createdAt: rec.invite?.createdAt || nowIso,
      history: [
        ...(rec.invite?.history || []),
        {
          action: `Status manually updated to ${newStatus} by Owner`,
          timestamp: nowIso,
          actor: 'KoHot Master Host',
        },
      ],
    };

    const allInvites = getStoredNextClassInvites();
    const newInvitesList = [updatedInvite, ...allInvites.filter((i) => i.id !== updatedInvite.id)];
    saveStoredNextClassInvites(newInvitesList);
    setInvites(newInvitesList);
  };

  const handleCopyText = async () => {
    await copyUrlToClipboard(customMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  return (
    <div id="master-next-class-handoffs-section" className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl bg-[#0c0d14] border border-white/15 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono-tech uppercase font-semibold">
              Relay-Race Model
            </span>
            <span className="text-zinc-500 text-xs">•</span>
            <span className="text-zinc-400 text-xs font-mono-tech">
              No Automated Invitation Emails
            </span>
          </div>
          <h2 className="font-syne font-bold text-2xl text-white tracking-tight">
            Next-Class Handoffs &amp; Relay Tracker
          </h2>
          <p className="font-body text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Monitor sequential cohort transitions across departments. If an incoming class does not establish its album when expected, perform manual follow-up using stored backup records with personalized WhatsApp and SMS templates.
          </p>
        </div>

        {/* Stat Pills */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 font-mono-tech text-xs">
          <div className="px-3.5 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-zinc-300">
            <span className="text-zinc-500 text-[10px] block uppercase">Monitored</span>
            <span className="font-bold text-sm text-white">{totalCohorts}</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="text-emerald-500/80 text-[10px] block uppercase">Live Sets</span>
            <span className="font-bold text-sm text-emerald-300">{approvedCohorts}</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
            <span className="text-amber-500/80 text-[10px] block uppercase">In Transition</span>
            <span className="font-bold text-sm text-amber-300">{invitedCohorts}</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <span className="text-red-500/80 text-[10px] block uppercase">Pending Follow-up</span>
            <span className="font-bold text-sm text-red-300">{inactiveCohorts}</span>
          </div>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#0c0d14] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative min-w-[280px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search department, institution, rep, or year..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono-tech text-xs placeholder:text-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-zinc-300 font-mono-tech text-xs focus:outline-none"
            >
              <option value="all">All Handoff States</option>
              <option value="not_invited">Not Yet Invited</option>
              <option value="invited">Invited (Outbound Link Shared)</option>
              <option value="accepted">Accepted (Landed on Legacy Wall)</option>
              <option value="requested">Requested (Album Form Submitted)</option>
              <option value="approved">Approved &amp; Live</option>
              <option value="inactive">Inactive / Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cohort Relay Grid */}
      <div className="rounded-3xl bg-[#0c0d14] border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                <th className="p-4">Department &amp; Cohort</th>
                <th className="p-4">Immediate Successor</th>
                <th className="p-4">Stored Backup / Contact</th>
                <th className="p-4">Handoff Status</th>
                <th className="p-4">Last Activity</th>
                <th className="p-4 text-right">Owner Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono-tech">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500 font-body">
                    No department cohorts found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const statusColors: Record<string, string> = {
                    not_invited: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                    invited: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    accepted: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
                    requested: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
                    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    inactive: 'bg-red-500/10 text-red-400 border-red-500/20',
                  };

                  return (
                    <tr key={rec.set.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Department & Current Class */}
                      <td className="p-4">
                        <p className="font-body font-bold text-white text-sm">
                          {rec.set.departmentName}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                          {rec.set.institutionName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded bg-white/10 text-zinc-300 text-[10px]">
                            Pioneer: Class of {rec.set.graduationYear}
                          </span>
                        </div>
                      </td>

                      {/* Next Class Year */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className="font-bold text-amber-300 text-sm">
                            Class of {rec.nextYear}
                          </span>
                          <span className="text-[10px] text-zinc-500 block">
                            Sequential Link #{rec.set.graduationYear + 1}
                          </span>
                        </div>
                      </td>

                      {/* Stored Representative Contact */}
                      <td className="p-4">
                        {rec.contact ? (
                          <div className="space-y-0.5">
                            <p className="font-body font-semibold text-white">
                              {rec.contact.name}
                            </p>
                            <p className="text-[11px] text-emerald-400">
                              {rec.contact.phoneOrWhatsapp}
                            </p>
                            {rec.contact.email && (
                              <p className="text-[10px] text-zinc-500 truncate max-w-[160px]">
                                {rec.contact.email}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic">No contact record captured yet</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border inline-flex items-center gap-1 ${statusColors[rec.status] || statusColors.not_invited}`}>
                          {rec.status === 'approved' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {rec.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td className="p-4 text-zinc-400 text-[11px] whitespace-nowrap">
                        {rec.invite?.lastSentAt ? (
                          <span>Sent: {new Date(rec.invite.lastSentAt).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-zinc-600">Pending initial handoff</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        {/* Owner Manual Follow-Up Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenFollowupModal(rec)}
                          className="px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold uppercase transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>Follow Up</span>
                        </button>

                        {/* View Legacy Wall */}
                        {onViewDepartmentLegacyWall && (
                          <button
                            type="button"
                            onClick={() => onViewDepartmentLegacyWall(rec.set.departmentId, rec.set.institutionId)}
                            title="View Department Legacy Wall"
                            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors inline-flex cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL: OWNER MANUAL FOLLOW-UP
          ========================================================================= */}
      {selectedSetForFollowup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-[#0c0d14] border border-white/20 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="p-6 sm:p-7 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-syne font-bold text-lg sm:text-xl text-white">
                    Manual Cohort Follow-Up
                  </h3>
                  <p className="font-mono-tech text-xs text-zinc-400">
                    {selectedSetForFollowup.set.departmentName} • Next Class of {selectedSetForFollowup.nextYear}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSetForFollowup(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-7 overflow-y-auto space-y-5">
              
              {/* Recipient Overview */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 font-mono-tech text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Target Contact:</span>
                  <span className="text-white font-semibold">{selectedSetForFollowup.contact?.name || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Phone / WhatsApp:</span>
                  <span className="text-emerald-400 font-semibold">{selectedSetForFollowup.contact?.phoneOrWhatsapp || 'No phone recorded'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Preceding Pioneer:</span>
                  <span className="text-zinc-300">
                    Class of {selectedSetForFollowup.set.graduationYear} ({selectedSetForFollowup.set.classRepName})
                  </span>
                </div>
              </div>

              {/* Template Channel Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-tech text-zinc-400 mr-2">KoHot Template:</span>
                <button
                  type="button"
                  onClick={() => handleSwitchTemplateChannel('whatsapp')}
                  className={`px-3.5 py-1.5 rounded-xl font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    followupChannel === 'whatsapp'
                      ? 'bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] font-bold'
                      : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTemplateChannel('sms')}
                  className={`px-3.5 py-1.5 rounded-xl font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    followupChannel === 'sms'
                      ? 'bg-sky-500/20 border border-sky-500/40 text-sky-400 font-bold'
                      : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>SMS Template</span>
                </button>
              </div>

              {/* Editable Message Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono-tech uppercase tracking-wider text-zinc-300 font-semibold">
                    Personalized Outreach Message (Editable)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="text-[11px] font-mono-tech text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedMessage ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedMessage ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-black/60 border border-white/20 text-white font-body text-xs leading-relaxed focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Status override options */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                <span className="text-[11px] font-mono-tech uppercase text-zinc-400 block">
                  Quick Handoff State Override:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectedSetForFollowup && handleUpdateStatusManual(selectedSetForFollowup, 'invited')}
                    className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-mono-tech uppercase cursor-pointer"
                  >
                    Mark Invited
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedSetForFollowup && handleUpdateStatusManual(selectedSetForFollowup, 'inactive')}
                    className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 text-[10px] font-mono-tech uppercase cursor-pointer"
                  >
                    Mark Inactive
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedSetForFollowup && handleUpdateStatusManual(selectedSetForFollowup, 'requested')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-mono-tech uppercase cursor-pointer"
                  >
                    Mark Requested
                  </button>
                </div>
              </div>

            </div>

            {/* Sticky Footer */}
            <div className="p-5 sm:p-6 border-t border-white/10 bg-black/60 shrink-0 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedSetForFollowup(null)}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-syne text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleExecuteSend('sms')}
                  className="px-4 py-2.5 rounded-full bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Send SMS</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteSend('whatsapp')}
                  className="px-5 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-black font-syne font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#25D366]/20"
                >
                  <MessageCircle className="w-4 h-4 text-black" />
                  <span>Send WhatsApp</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
