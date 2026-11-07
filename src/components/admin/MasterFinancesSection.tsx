import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  RotateCcw,
  Gift,
  Settings,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Plus,
  Edit3,
  Trash2,
  Building2,
  Coins,
  ArrowUpRight,
  X,
} from 'lucide-react';
import {
  ClassSet,
  UniversityDirectoryItem,
  FinancialTransaction,
  AuditLogEntry,
  FinanceLedgerRow,
  FinanceLedgerRowStatus,
  FinanceLedgerRowType,
  SlotAllocationRecord,
} from '../../types';
import {
  formatMoneyFromKobo,
  sanitizeCsvCell,
  getInstitutionCurrency,
  setInstitutionCurrency,
} from '../../utils/currencyFormatter';
import {
  fetchAdminSettingsFromServer,
  saveAdminSettingsToServer,
  fetchSlotAllocationsFromServer,
  saveSlotAllocationOnServer,
  grantFreeSlotsOnServer,
  updateAlbumSponsorOnServer,
  fetchFinancesLedgerFromServer,
  fetchFinancesSummaryFromServer,
  markTransactionRefundedOnServer,
  verifyPaystackPaymentOnServer,
} from '../../utils/apiClient';
import { useFeedback } from '../common/FeedbackSystem';

interface MasterFinancesSectionProps {
  sets: ClassSet[];
  universities: UniversityDirectoryItem[];
  transactions: FinancialTransaction[];
  onUpdateSet: (updatedSet: ClassSet) => void;
  onAddAuditLog?: (entry: AuditLogEntry) => void;
  currentUserEmail?: string;
}

type FinanceSubTab = 'overview' | 'transactions' | 'slots' | 'settings';

export const MasterFinancesSection: React.FC<MasterFinancesSectionProps> = ({
  sets,
  universities,
  transactions,
  onUpdateSet,
  onAddAuditLog,
  currentUserEmail = 'host@kohot.app',
}) => {
  const { showSuccess, showError, showWarning } = useFeedback();
  const [subTab, setSubTab] = useState<FinanceSubTab>('overview');
  const [isLoading, setIsLoading] = useState(false);

  // Platform settings state
  const [studentFeeNairaInput, setStudentFeeNairaInput] = useState('500');
  const [minFundedInput, setMinFundedInput] = useState('10');
  const [profileCapInput, setProfileCapInput] = useState('200');
  const [reinstateDaysInput, setReinstateDaysInput] = useState('7');
  const [draftRetentionInput, setDraftRetentionInput] = useState('30');
  const [recoveryPeriodInput, setRecoveryPeriodInput] = useState('14');
  const [defaultKohotSlotsInput, setDefaultKohotSlotsInput] = useState('0');
  const [instCurrencies, setInstCurrencies] = useState<Record<string, string>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Ledger & Summary state
  const [serverLedgerRows, setServerLedgerRows] = useState<FinanceLedgerRow[]>([]);
  const [serverSummary, setServerSummary] = useState<any | null>(null);

  // Filters for Transactions sub-tab
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | FinanceLedgerRowType>('all');
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | FinanceLedgerRowStatus>('all');
  const [txInstFilter, setTxInstFilter] = useState<string>('all');
  const [txDateFrom, setTxDateFrom] = useState<string>('');
  const [txDateTo, setTxDateTo] = useState<string>('');
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);

  // Refund Modal state
  const [refundTargetRow, setRefundTargetRow] = useState<FinanceLedgerRow | null>(null);
  const [refundNote, setRefundNote] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // KoHot Slot Allocations state
  const [allocations, setAllocations] = useState<SlotAllocationRecord[]>([]);
  const [allocInstId, setAllocInstId] = useState<string>(universities[0]?.id || '');
  const [allocDeptId, setAllocDeptId] = useState<string>(
    universities[0]?.departments?.[0]?.id || ''
  );
  const [allocYear, setAllocYear] = useState<string>(String(new Date().getFullYear()));
  const [allocQty, setAllocQty] = useState<string>('10');
  const [allocNote, setAllocNote] = useState<string>('Sponsored by KoHot');
  const [editingAlloc, setEditingAlloc] = useState<SlotAllocationRecord | null>(null);
  const [editAllocQty, setEditAllocQty] = useState<string>('');
  const [editAllocNote, setEditAllocNote] = useState<string>('');
  const [isSavingAlloc, setIsSavingAlloc] = useState(false);

  // Per-Album Grant Free Slots & Edit Sponsor state
  const [grantAlbumTarget, setGrantAlbumTarget] = useState<ClassSet | null>(null);
  const [grantSlotsQty, setGrantSlotsQty] = useState<string>('5');
  const [grantSlotsReason, setGrantSlotsReason] = useState<string>('');
  const [isGrantingSlots, setIsGrantingSlots] = useState(false);

  const [editingSponsorContext, setEditingSponsorContext] = useState<{
    album: ClassSet;
    sponsorId: string;
    reference: string;
    currentName: string;
  } | null>(null);
  const [editSponsorNameInput, setEditSponsorNameInput] = useState<string>('');

  const liveSets = useMemo(() => sets.filter((s) => !s.deletedAt), [sets]);

  const loadFinancesData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, allocRes, ledgerRes, summaryRes] = await Promise.all([
        fetchAdminSettingsFromServer(),
        fetchSlotAllocationsFromServer(),
        fetchFinancesLedgerFromServer(),
        fetchFinancesSummaryFromServer(),
      ]);

      if (settingsRes.settings) {
        const s = settingsRes.settings;
        setStudentFeeNairaInput(String(Math.round((Number(s.student_fee_kobo) || 50000) / 100)));
        setMinFundedInput(String(s.min_funded_to_publish ?? 10));
        setProfileCapInput(String(s.profile_cap_default ?? 200));
        setReinstateDaysInput(String(s.reinstate_days ?? 7));
        setDraftRetentionInput(String(s.draft_retention_days ?? 30));
        setRecoveryPeriodInput(String(s.recovery_period_days ?? 14));
        setDefaultKohotSlotsInput(String(s.default_kohot_slots_per_album ?? 0));
        if (s.institution_currencies && typeof s.institution_currencies === 'object') {
          setInstCurrencies(s.institution_currencies);
          Object.entries(s.institution_currencies).forEach(([instId, curr]) => {
            setInstitutionCurrency(instId, String(curr));
          });
        }
      }

      if (allocRes.allocations) {
        setAllocations(allocRes.allocations);
      }
      if (ledgerRes.rows) {
        setServerLedgerRows(ledgerRes.rows);
      }
      if (summaryRes.summary) {
        setServerSummary(summaryRes.summary);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFinancesData();
  }, []);

  // Keep department dropdown synced with selected institution
  useEffect(() => {
    const selectedUni = universities.find((u) => u.id === allocInstId);
    if (selectedUni && selectedUni.departments.length > 0) {
      if (!selectedUni.departments.some((d) => d.id === allocDeptId)) {
        setAllocDeptId(selectedUni.departments[0].id);
      }
    } else {
      setAllocDeptId('');
    }
  }, [allocInstId, universities]);

  const unitFeeKobo = useMemo(() => {
    const parsedNaira = Number(studentFeeNairaInput);
    return Number.isFinite(parsedNaira) && parsedNaira >= 0 ? Math.round(parsedNaira * 100) : 50000;
  }, [studentFeeNairaInput]);

  // Combine server ledger rows with any prop-supplied transactions (deduped by reference)
  const combinedLedgerRows: FinanceLedgerRow[] = useMemo(() => {
    const map = new Map<string, FinanceLedgerRow>();
    for (const r of serverLedgerRows) {
      if (r && r.reference) {
        map.set(r.reference, r);
      }
    }
    for (const tx of transactions || []) {
      if (!tx || !tx.reference || map.has(tx.reference)) continue;
      const matchedSet = sets.find((s) => s.id === tx.setId);
      const instId = matchedSet?.institutionId || '';
      const rawStatus = String(tx.status || 'Pending').toLowerCase();
      let status: FinanceLedgerRowStatus = 'pending';
      if (rawStatus === 'refunded') status = 'refunded';
      else if (rawStatus === 'refund_due' || rawStatus === 'refund due') status = 'refund_due';
      else if (rawStatus.includes('needs review')) status = 'needs_review';
      else if (rawStatus === 'paid') status = 'paid';
      else if (rawStatus === 'failed') status = 'failed';

      const isSlot =
        String(tx.category || '').toLowerCase().includes('slot') ||
        tx.reference.includes('-SLT-');
      const amountKobo = Math.round((Number(tx.amount) || 0) * 100);
      map.set(tx.reference, {
        id: tx.id || `tx-${tx.reference}`,
        type: isSlot ? 'slot_purchase' : 'student_payment',
        date: tx.date || new Date().toISOString(),
        institutionId: instId,
        institutionName: matchedSet?.institutionName || tx.institution || 'Institution',
        departmentId: matchedSet?.departmentId || '',
        departmentName: matchedSet?.departmentName || tx.setName || 'Department',
        classYear: matchedSet?.graduationYear || new Date().getFullYear(),
        albumId: tx.setId || '',
        albumName: matchedSet?.classSetName || tx.setName || 'Class Album',
        amountKobo,
        currency: getInstitutionCurrency(instId, tx.currency || instCurrencies[instId] || 'NGN'),
        status,
        reference: tx.reference,
        quantity: isSlot ? Math.max(1, Math.round(amountKobo / (unitFeeKobo || 50000))) : 1,
        sponsor: isSlot ? tx.payerName : '',
        payerName: tx.payerName,
        payerEmail: tx.payerEmail,
        refundNote: tx.notes,
      });
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [serverLedgerRows, transactions, sets, instCurrencies, unitFeeKobo]);

  // Enrich allocations with live album match + used/remaining counts
  const enrichedAllocations: SlotAllocationRecord[] = useMemo(() => {
    return allocations.map((alloc) => {
      const matchedAlbum = liveSets.find(
        (s) =>
          (alloc.albumId && s.id === alloc.albumId) ||
          (s.institutionId.toLowerCase() === String(alloc.institutionId).toLowerCase() &&
            s.departmentId.toLowerCase() === String(alloc.departmentId).toLowerCase() &&
            Number(s.graduationYear) === Number(alloc.graduationYear))
      );
      const uniObj = universities.find((u) => u.id === alloc.institutionId);
      const deptObj = uniObj?.departments.find((d) => d.id === alloc.departmentId);
      const qty = Number(alloc.quantity) || 0;
      const usedFromAlbum = matchedAlbum
        ? Math.min(
            qty,
            Number(
              matchedAlbum.totalSlotsUsed ??
                matchedAlbum.students.filter((st) => st.approved && !st.isClassRep).length
            ) || 0
          )
        : Number(alloc.usedSlots) || 0;
      const remaining = Math.max(0, qty - usedFromAlbum);
      return {
        ...alloc,
        institutionName:
          alloc.institutionName || uniObj?.name || matchedAlbum?.institutionName || alloc.institutionId,
        departmentName:
          alloc.departmentName || deptObj?.name || matchedAlbum?.departmentName || alloc.departmentId,
        status: matchedAlbum ? 'credited' : alloc.status || 'waiting',
        albumId: matchedAlbum?.id || alloc.albumId || null,
        albumName: matchedAlbum?.classSetName || alloc.albumName || null,
        usedSlots: usedFromAlbum,
        remainingSlots: remaining,
      };
    });
  }, [allocations, liveSets, universities]);

  // Compute Overview Summary (Africa/Lagos time UTC+1)
  const overviewMetrics = useMemo(() => {
    const lagosNow = new Date(Date.now() + 60 * 60 * 1000);
    const currentLagosYearMonth = lagosNow.toISOString().slice(0, 7);

    let confirmedRevenueMonthKobo = 0;
    let confirmedRevenueAllTimeKobo = 0;
    let studentPaymentsKobo = 0;
    let studentPaymentsCount = 0;
    let slotPurchasesKobo = 0;
    let slotPurchasesCount = 0;
    let refundsDueKobo = 0;
    let refundsDueCount = 0;
    let refundedKobo = 0;
    let pendingPaymentsCount = 0;
    let paidNeedsReviewCount = 0;

    for (const r of combinedLedgerRows) {
      const rowLagosMonth = new Date(new Date(r.date).getTime() + 60 * 60 * 1000)
        .toISOString()
        .slice(0, 7);
      if (r.status === 'paid') {
        confirmedRevenueAllTimeKobo += r.amountKobo;
        if (rowLagosMonth === currentLagosYearMonth) {
          confirmedRevenueMonthKobo += r.amountKobo;
        }
        if (r.type === 'student_payment') {
          studentPaymentsKobo += r.amountKobo;
          studentPaymentsCount += 1;
        } else {
          slotPurchasesKobo += r.amountKobo;
          slotPurchasesCount += 1;
        }
      } else if (r.status === 'refund_due') {
        refundsDueKobo += r.amountKobo;
        refundsDueCount += 1;
      } else if (r.status === 'refunded') {
        refundedKobo += r.amountKobo;
      } else if (r.status === 'pending') {
        pendingPaymentsCount += 1;
      } else if (r.status === 'needs_review') {
        paidNeedsReviewCount += 1;
      }
    }

    // Granted slots from KoHot allocations + per-album KoHot sponsors
    const allocSlotsTotal = enrichedAllocations.reduce(
      (sum, a) => sum + (Number(a.quantity) || 0),
      0
    );
    const albumGrantedSlotsTotal = liveSets.reduce((sum, s) => {
      const kohotSponsors = (s.sponsors || []).filter(
        (sp) => sp.isKoHotCredit || sp.sponsorName === 'KoHot'
      );
      return sum + kohotSponsors.reduce((acc, sp) => acc + (Number(sp.quantity) || 0), 0);
    }, 0);

    const grantedSlotsCount = Math.max(
      serverSummary?.kohotSponsoredSlotsCount || 0,
      allocSlotsTotal + albumGrantedSlotsTotal
    );
    const kohotSponsoredValueKobo = grantedSlotsCount * unitFeeKobo;
    const netCollectedKobo = Math.max(0, confirmedRevenueAllTimeKobo - refundsDueKobo);

    return {
      confirmedRevenueMonthKobo:
        serverSummary && combinedLedgerRows.length === 0
          ? serverSummary.confirmedRevenueMonthKobo
          : confirmedRevenueMonthKobo,
      confirmedRevenueAllTimeKobo:
        serverSummary && combinedLedgerRows.length === 0
          ? serverSummary.confirmedRevenueAllTimeKobo
          : confirmedRevenueAllTimeKobo,
      studentPaymentsKobo,
      studentPaymentsCount,
      slotPurchasesKobo,
      slotPurchasesCount,
      refundsDueKobo,
      refundsDueCount,
      refundedKobo,
      netCollectedKobo,
      kohotSponsoredValueKobo,
      kohotSponsoredSlotsCount: grantedSlotsCount,
      pendingPaymentsCount,
      paidNeedsReviewCount,
    };
  }, [combinedLedgerRows, enrichedAllocations, liveSets, serverSummary, unitFeeKobo]);

  // Filtered ledger rows for Transactions sub-tab
  const filteredLedgerRows = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return combinedLedgerRows.filter((row) => {
      if (txTypeFilter !== 'all' && row.type !== txTypeFilter) return false;
      if (txStatusFilter !== 'all' && row.status !== txStatusFilter) return false;
      if (
        txInstFilter !== 'all' &&
        row.institutionId.toLowerCase() !== txInstFilter.toLowerCase() &&
        row.institutionName.toLowerCase() !== txInstFilter.toLowerCase()
      ) {
        return false;
      }
      if (txDateFrom) {
        const rowDate = row.date.slice(0, 10);
        if (rowDate < txDateFrom) return false;
      }
      if (txDateTo) {
        const rowDate = row.date.slice(0, 10);
        if (rowDate > txDateTo) return false;
      }
      if (q) {
        const hay = `${row.reference} ${row.institutionName} ${row.departmentName} ${row.classYear} ${row.sponsor || ''} ${row.payerName || ''} ${row.payerEmail || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [combinedLedgerRows, txSearch, txTypeFilter, txStatusFilter, txInstFilter, txDateFrom, txDateTo]);

  // Export CSV with formula-injection protection (prefix = + - @ with ')
  const handleExportCsv = () => {
    const headers = [
      'Type',
      'Date (Africa/Lagos)',
      'Institution',
      'Department',
      'Class Year',
      'Amount',
      'Currency',
      'Status',
      'Reference',
      'Quantity',
      'Sponsor',
      'Note',
    ];
    const lines = [headers.map(sanitizeCsvCell).join(',')];
    for (const r of filteredLedgerRows) {
      const formattedAmount = (r.amountKobo / 100).toFixed(2);
      const rowCells = [
        r.type === 'slot_purchase' ? 'Slot purchase' : 'Student payment',
        r.date.slice(0, 10),
        r.institutionName,
        r.departmentName,
        r.classYear,
        formattedAmount,
        r.currency || 'NGN',
        r.status.replace('_', ' '),
        r.reference,
        r.quantity,
        r.sponsor || '',
        r.refundNote || '',
      ];
      lines.push(rowCells.map(sanitizeCsvCell).join(','));
    }
    const csvBlob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kohot-finances-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showSuccess('CSV exported', `${filteredLedgerRows.length} ledger rows exported.`);
  };

  // Re-verify pending row via server verify route (never marks paid from browser)
  const handleReverifyPendingRow = async (row: FinanceLedgerRow) => {
    if (!row.reference) return;
    setVerifyingRef(row.reference);
    try {
      const res = await verifyPaystackPaymentOnServer(row.reference);
      if (res.success && res.verified) {
        showSuccess('Verified with Paystack', `Reference ${row.reference} confirmed.`);
        await loadFinancesData();
      } else {
        showWarning(
          'Verification result',
          res.message || res.error || 'Payment is still pending or not confirmed by Paystack.'
        );
      }
    } finally {
      setVerifyingRef(null);
    }
  };

  // Mark refunded with required note (refund itself is processed in Paystack)
  const handleConfirmMarkRefunded = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTargetRow) return;
    const cleanNote = refundNote.trim();
    if (!cleanNote) {
      showError('Note required', 'Please enter a note explaining the Paystack refund.');
      return;
    }
    setIsSubmittingRefund(true);
    try {
      const res = await markTransactionRefundedOnServer(refundTargetRow.reference, cleanNote);
      if (!res.success) {
        showError('Could not mark refunded', res.error || 'Please try again.');
        return;
      }
      setServerLedgerRows((prev) =>
        prev.map((r) =>
          r.reference === refundTargetRow.reference
            ? { ...r, status: 'refunded', refundNote: cleanNote, refundedAt: new Date().toISOString() }
            : r
        )
      );
      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: refundTargetRow.reference,
        details: `Marked transaction ${refundTargetRow.reference} as refunded. Note: ${cleanNote}`,
      });
      showSuccess('Marked as refunded', `Transaction ${refundTargetRow.reference} updated.`);
      setRefundTargetRow(null);
      setRefundNote('');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Create new KoHot Slot Allocation
  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocInstId || !allocDeptId) {
      showError('Select department', 'Pick an institution and department from the directory.');
      return;
    }
    const yearNum = Number(allocYear);
    const qtyNum = Number(allocQty);
    if (!Number.isFinite(yearNum) || yearNum < 1970 || yearNum > 2100) {
      showError('Invalid year', 'Enter a valid graduation year.');
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum < 1 || Math.floor(qtyNum) !== qtyNum) {
      showError('Invalid slot count', 'Enter at least 1 slot.');
      return;
    }

    setIsSavingAlloc(true);
    try {
      const res = await saveSlotAllocationOnServer({
        institutionId: allocInstId,
        departmentId: allocDeptId,
        graduationYear: yearNum,
        quantity: qtyNum,
        note: allocNote.trim() || 'Sponsored by KoHot',
      });
      if (!res.success) {
        showError('Allocation failed', res.message || res.error || 'Could not save allocation.');
        return;
      }

      // If album already exists locally, credit its slot balance & add KoHot sponsor entry
      const matchedAlbum = liveSets.find(
        (s) =>
          s.institutionId.toLowerCase() === allocInstId.toLowerCase() &&
          s.departmentId.toLowerCase() === allocDeptId.toLowerCase() &&
          Number(s.graduationYear) === yearNum
      );
      if (matchedAlbum) {
        const nextBalance = (Number(matchedAlbum.profileSlotBalance) || 0) + qtyNum;
        const nextCredited = (Number(matchedAlbum.totalSlotsCredited) || 0) + qtyNum;
        onUpdateSet({
          ...matchedAlbum,
          profileSlotBalance: nextBalance,
          totalSlotsCredited: nextCredited,
        });
      }

      await loadFinancesData();
      showSuccess(
        matchedAlbum ? 'Allocation credited to album' : 'Allocation saved (Waiting for album)',
        `${qtyNum} KoHot slots allocated.`
      );
    } finally {
      setIsSavingAlloc(false);
    }
  };

  // Save edited KoHot Slot Allocation (increase appends; decrease only down to unused slots)
  const handleSaveEditedAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlloc) return;
    const newQty = Number(editAllocQty);
    const usedSlots = Number(editingAlloc.usedSlots) || 0;
    if (!Number.isFinite(newQty) || Math.floor(newQty) !== newQty || newQty < usedSlots) {
      showError(
        'Cannot reduce below used slots',
        `At least ${usedSlots} slot${usedSlots === 1 ? '' : 's'} have already been used.`
      );
      return;
    }

    setIsSavingAlloc(true);
    try {
      const delta = newQty - (Number(editingAlloc.quantity) || 0);
      const res = await saveSlotAllocationOnServer({
        id: editingAlloc.id,
        institutionId: editingAlloc.institutionId,
        departmentId: editingAlloc.departmentId,
        graduationYear: editingAlloc.graduationYear,
        quantity: newQty,
        note: editAllocNote.trim() || 'Sponsored by KoHot',
      });
      if (!res.success) {
        showError('Could not update allocation', res.message || res.error || 'Please try again.');
        return;
      }

      if (editingAlloc.albumId && delta !== 0) {
        const matchedAlbum = liveSets.find((s) => s.id === editingAlloc.albumId);
        if (matchedAlbum) {
          onUpdateSet({
            ...matchedAlbum,
            profileSlotBalance: Math.max(0, (Number(matchedAlbum.profileSlotBalance) || 0) + delta),
            totalSlotsCredited: Math.max(0, (Number(matchedAlbum.totalSlotsCredited) || 0) + delta),
          });
        }
      }

      await loadFinancesData();
      setEditingAlloc(null);
      showSuccess('Allocation updated', `Slot allocation updated to ${newQty} slots.`);
    } finally {
      setIsSavingAlloc(false);
    }
  };

  // Grant free slots to a specific album (reason required)
  const handleGrantFreeSlotsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantAlbumTarget) return;
    const qty = Math.floor(Number(grantSlotsQty) || 0);
    const reason = grantSlotsReason.trim();
    if (qty < 1) {
      showError('Invalid quantity', 'Enter at least 1 free slot to grant.');
      return;
    }
    if (!reason) {
      showError('Reason required', 'Please provide a reason for granting free slots.');
      return;
    }

    setIsGrantingSlots(true);
    try {
      const res = await grantFreeSlotsOnServer(grantAlbumTarget.id, qty, reason);
      if (!res.success) {
        showError('Grant failed', res.error || 'Could not grant free slots.');
        return;
      }

      const newSponsorEntry = {
        id: `sled-grant-${Date.now()}`,
        sponsorName: 'KoHot',
        DisplayLabel: `KoHot (${reason})`,
        quantity: qty,
        amountPaid: 0,
        reference: `GRANT-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        showSponsorNameOnAlbum: true,
        isKoHotCredit: true,
      };

      const updatedSet: ClassSet = {
        ...grantAlbumTarget,
        profileSlotBalance: (Number(grantAlbumTarget.profileSlotBalance) || 0) + qty,
        totalSlotsCredited: (Number(grantAlbumTarget.totalSlotsCredited) || 0) + qty,
        sponsors: [...(grantAlbumTarget.sponsors || []), newSponsorEntry],
      };
      onUpdateSet(updatedSet);

      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: grantAlbumTarget.id,
        details: `Granted ${qty} free KoHot slots to ${grantAlbumTarget.classSetName}. Reason: ${reason}`,
      });

      showSuccess('Free slots granted', `Added ${qty} slots to ${grantAlbumTarget.classSetName}.`);
      setGrantAlbumTarget(null);
      setGrantSlotsQty('5');
      setGrantSlotsReason('');
      await loadFinancesData();
    } finally {
      setIsGrantingSlots(false);
    }
  };

  // Host edit or remove public sponsor name
  const handleSaveSponsorEdit = async (action: 'edit' | 'remove') => {
    if (!editingSponsorContext) return;
    const { album, sponsorId, reference } = editingSponsorContext;
    const cleanName = action === 'remove' ? 'Anonymous Sponsor' : editSponsorNameInput.trim();
    if (action === 'edit' && !cleanName) {
      showError('Name required', 'Enter a sponsor name or choose Remove.');
      return;
    }

    const res = await updateAlbumSponsorOnServer(album.id, {
      sponsorId,
      reference,
      sponsorName: cleanName,
      action,
    });
    if (!res.success) {
      showError('Could not update sponsor', res.error || 'Please try again.');
      return;
    }

    const updatedSponsors = (album.sponsors || []).map((sp) =>
      sp.id === sponsorId || (reference && sp.reference === reference)
        ? {
            ...sp,
            sponsorName: cleanName,
            DisplayLabel: cleanName,
            showSponsorNameOnAlbum: action !== 'remove',
          }
        : sp
    );
    onUpdateSet({ ...album, sponsors: updatedSponsors });

    onAddAuditLog?.({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'settings_updated',
      actorUserId: currentUserEmail,
      actorRole: 'master_host',
      targetId: album.id,
      details:
        action === 'remove'
          ? `Removed public sponsor display (${sponsorId}) on ${album.classSetName}`
          : `Edited sponsor name (${sponsorId}) to "${cleanName}" on ${album.classSetName}`,
    });

    showSuccess(
      action === 'remove' ? 'Sponsor name removed' : 'Sponsor name updated',
      `Updated on ${album.classSetName}.`
    );
    setEditingSponsorContext(null);
    setEditSponsorNameInput('');
  };

  // Save Platform Settings with validation + audit log
  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const feeNaira = Number(studentFeeNairaInput);
    const minFunded = Number(minFundedInput);
    const profileCap = Number(profileCapInput);
    const reinstateDays = Number(reinstateDaysInput);
    const draftRetention = Number(draftRetentionInput);
    const recoveryPeriod = Number(recoveryPeriodInput);
    const defaultKohotSlots = Number(defaultKohotSlotsInput);

    if (!Number.isFinite(feeNaira) || feeNaira < 0 || feeNaira > 1000000) {
      showError('Invalid student fee', 'Student fee must be between ₦0 and ₦1,000,000.');
      return;
    }
    if (!Number.isInteger(minFunded) || minFunded < 0 || minFunded > 1000) {
      showError('Invalid minimum funded profiles', 'Must be a whole number between 0 and 1,000.');
      return;
    }
    if (!Number.isInteger(profileCap) || profileCap < 1 || profileCap > 5000) {
      showError('Invalid profile cap', 'Profile cap must be between 1 and 5,000.');
      return;
    }
    if (!Number.isInteger(reinstateDays) || reinstateDays < 1 || reinstateDays > 365) {
      showError('Invalid reinstate days', 'Reinstate days must be between 1 and 365.');
      return;
    }
    if (!Number.isInteger(draftRetention) || draftRetention < 1 || draftRetention > 365) {
      showError('Invalid draft retention', 'Draft retention days must be between 1 and 365.');
      return;
    }
    if (!Number.isInteger(recoveryPeriod) || recoveryPeriod < 1 || recoveryPeriod > 365) {
      showError('Invalid recovery period', 'Recovery period days must be between 1 and 365.');
      return;
    }
    if (!Number.isInteger(defaultKohotSlots) || defaultKohotSlots < 0 || defaultKohotSlots > 1000) {
      showError('Invalid default KoHot slots', 'Default KoHot slots must be between 0 and 1,000.');
      return;
    }

    const studentFeeKobo = Math.round(feeNaira * 100);
    setIsSavingSettings(true);
    try {
      const res = await saveAdminSettingsToServer({
        student_fee_kobo: studentFeeKobo,
        min_funded_to_publish: minFunded,
        profile_cap_default: profileCap,
        reinstate_days: reinstateDays,
        draft_retention_days: draftRetention,
        recovery_period_days: recoveryPeriod,
        default_kohot_slots_per_album: defaultKohotSlots,
        institution_currencies: instCurrencies,
      });

      if (!res.success) {
        showError('Validation error', res.error || 'Could not save settings.');
        return;
      }

      Object.entries(instCurrencies).forEach(([instId, curr]) => {
        setInstitutionCurrency(instId, curr);
      });

      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: 'platform_settings',
        details: `Updated platform financial settings: fee=${studentFeeKobo} kobo, min_funded=${minFunded}, cap=${profileCap}, reinstate=${reinstateDays}d, draft_retention=${draftRetention}d, recovery=${recoveryPeriod}d, default_kohot_slots=${defaultKohotSlots}`,
      });

      showSuccess('Settings saved & logged', 'All platform financial settings have been updated.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openAttentionFilter = (status: FinanceLedgerRowStatus) => {
    setTxStatusFilter(status);
    setTxTypeFilter('all');
    setSubTab('transactions');
  };

  const selectedUniForAlloc = universities.find((u) => u.id === allocInstId);

  return (
    <div id="finances-module" className="p-4 sm:p-6 rounded-2xl bg-[#18181b] border border-white/12 shadow-xl space-y-5">
      {/* Compact Header & 4 Pill Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-syne font-bold text-base sm:text-lg text-white">Finances</h2>
            <p className="font-body text-xs text-zinc-400 truncate">
              Confirmed revenue, Paystack ledger, KoHot slot allocations, and fee settings.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10 overflow-x-auto no-scrollbar shrink-0">
          {(
            [
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'transactions', label: 'Transactions', icon: Coins },
              { id: 'slots', label: 'Slots & Funding', icon: Gift },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-white text-black font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-[#d4af37]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          SUB-TAB 1: OVERVIEW
         ===================================================================== */}
      {subTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. Confirmed Revenue (This Month & All Time, Africa/Lagos) */}
            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                  Confirmed Revenue (This Month)
                </span>
                <span className="text-[9px] font-mono-tech text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Africa/Lagos
                </span>
              </div>
              <p className="font-syne font-bold text-lg sm:text-xl text-white">
                {formatMoneyFromKobo(overviewMetrics.confirmedRevenueMonthKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                All time:{' '}
                <span className="text-zinc-200 font-semibold">
                  {formatMoneyFromKobo(overviewMetrics.confirmedRevenueAllTimeKobo)}
                </span>
              </p>
            </div>

            {/* 2. Student Payments */}
            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 block">
                Student Payments
              </span>
              <p className="font-syne font-bold text-lg sm:text-xl text-white">
                {formatMoneyFromKobo(overviewMetrics.studentPaymentsKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                {overviewMetrics.studentPaymentsCount} verified student{overviewMetrics.studentPaymentsCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* 3. Slot Purchases */}
            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 block">
                Slot Purchases
              </span>
              <p className="font-syne font-bold text-lg sm:text-xl text-white">
                {formatMoneyFromKobo(overviewMetrics.slotPurchasesKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                {overviewMetrics.slotPurchasesCount} batch purchase{overviewMetrics.slotPurchasesCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* 4. Refunds Due */}
            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 block">
                Refunds Due
              </span>
              <p className="font-syne font-bold text-lg sm:text-xl text-amber-400">
                {formatMoneyFromKobo(overviewMetrics.refundsDueKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                {overviewMetrics.refundsDueCount} item{overviewMetrics.refundsDueCount === 1 ? '' : 's'} awaiting refund
              </p>
            </div>

            {/* 5. Net Collected */}
            <div className="p-4 rounded-xl bg-[#08090e] border border-emerald-500/25 space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-emerald-400 block">
                Net Collected
              </span>
              <p className="font-syne font-bold text-lg sm:text-xl text-emerald-400">
                {formatMoneyFromKobo(overviewMetrics.netCollectedKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                Confirmed revenue minus refunds due
              </p>
            </div>

            {/* 6. KoHot-Sponsored Value (Programme Benefit, Never Revenue) */}
            <div className="p-4 rounded-xl bg-[#08090e] border border-[#d4af37]/30 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#d4af37]">
                  KoHot-Sponsored Value
                </span>
                <span className="text-[9px] font-mono-tech uppercase px-1.5 py-0.5 rounded bg-[#d4af37]/15 text-[#d4af37]">
                  Programme Benefit
                </span>
              </div>
              <p className="font-syne font-bold text-lg sm:text-xl text-[#d4af37]">
                {formatMoneyFromKobo(overviewMetrics.kohotSponsoredValueKobo)}
              </p>
              <p className="font-mono-tech text-[10px] text-zinc-400">
                {overviewMetrics.kohotSponsoredSlotsCount} granted slots × {formatMoneyFromKobo(unitFeeKobo)} (never counted as revenue)
              </p>
            </div>
          </div>

          {/* Needs Attention List */}
          <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Needs Attention</span>
              </h3>
              <span className="font-mono-tech text-[10px] text-zinc-400">
                Click any item to open matching filter
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => openAttentionFilter('pending')}
                className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-syne font-bold text-xs text-white">Pending payments</p>
                    <p className="font-body text-[11px] text-zinc-400">Re-verify with Paystack</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 font-mono-tech text-xs font-bold text-amber-300">
                  {overviewMetrics.pendingPaymentsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openAttentionFilter('needs_review')}
                className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0" />
                  <div>
                    <p className="font-syne font-bold text-xs text-white">Paid, needs review</p>
                    <p className="font-body text-[11px] text-zinc-400">Unmatched target or cap reached</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 font-mono-tech text-xs font-bold text-orange-300">
                  {overviewMetrics.paidNeedsReviewCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openAttentionFilter('refund_due')}
                className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 flex items-center justify-between text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <p className="font-syne font-bold text-xs text-white">Refunds due</p>
                    <p className="font-body text-[11px] text-zinc-400">Refund in Paystack &amp; mark refunded</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 font-mono-tech text-xs font-bold text-rose-300">
                  {overviewMetrics.refundsDueCount}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: TRANSACTIONS
         ===================================================================== */}
      {subTab === 'transactions' && (
        <div className="space-y-4">
          {/* Search, Filters & CSV Export Bar */}
          <div className="p-3.5 rounded-xl bg-[#08090e] border border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div className="relative lg:col-span-2">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search reference, sponsor, dept..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="student_payment">Student payment</option>
                <option value="slot_purchase">Slot purchase</option>
              </select>

              <select
                value={txStatusFilter}
                onChange={(e) => setTxStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="refund_due">Refund due</option>
                <option value="needs_review">Needs review</option>
              </select>

              <select
                value={txInstFilter}
                onChange={(e) => setTxInstFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="all">All Institutions</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.shortCode || u.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-mono-tech text-[11px] uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-tech text-zinc-400">Date range:</span>
                <input
                  type="date"
                  value={txDateFrom}
                  onChange={(e) => setTxDateFrom(e.target.value)}
                  className="px-2.5 py-1 rounded bg-black/60 border border-white/10 text-white text-[11px]"
                />
                <span className="text-zinc-500">to</span>
                <input
                  type="date"
                  value={txDateTo}
                  onChange={(e) => setTxDateTo(e.target.value)}
                  className="px-2.5 py-1 rounded bg-black/60 border border-white/10 text-white text-[11px]"
                />
                {(txTypeFilter !== 'all' ||
                  txStatusFilter !== 'all' ||
                  txInstFilter !== 'all' ||
                  txDateFrom ||
                  txDateTo ||
                  txSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxSearch('');
                      setTxTypeFilter('all');
                      setTxStatusFilter('all');
                      setTxInstFilter('all');
                      setTxDateFrom('');
                      setTxDateTo('');
                    }}
                    className="text-amber-400 hover:underline font-mono-tech text-[10px] cursor-pointer"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <span className="font-mono-tech text-zinc-400">
                Showing {filteredLedgerRows.length} of {combinedLedgerRows.length} rows
              </span>
            </div>
          </div>

          {/* Ledger Table */}
          {filteredLedgerRows.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#08090e] border border-white/10 text-center space-y-1">
              <p className="font-syne font-bold text-sm text-white">No matching transactions</p>
              <p className="font-body text-xs text-zinc-400">
                Verified student payments and slot purchases appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#08090e]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-black/40 font-mono-tech text-[10px] uppercase text-zinc-400">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Institution &amp; Dept</th>
                    <th className="py-2.5 px-3">Year</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Sponsor</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredLedgerRows.map((row) => {
                    const statusBadge =
                      row.status === 'paid'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : row.status === 'pending'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : row.status === 'refund_due'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : row.status === 'needs_review'
                        ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                        : row.status === 'refunded'
                        ? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
                        : 'bg-red-500/15 text-red-300 border-red-500/30';

                    return (
                      <tr key={row.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-200 whitespace-nowrap">
                          {row.type === 'slot_purchase' ? 'Slot purchase' : 'Student payment'}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-400 whitespace-nowrap">
                          {row.date.slice(0, 10)}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-syne font-semibold text-white text-xs truncate max-w-[180px]">
                            {row.institutionName}
                          </p>
                          <p className="font-body text-[11px] text-zinc-400 truncate max-w-[180px]">
                            {row.departmentName}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-300">
                          {row.classYear}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech font-bold text-xs text-white whitespace-nowrap">
                          {formatMoneyFromKobo(row.amountKobo, {
                            currency: row.currency,
                            institutionId: row.institutionId,
                          })}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full border font-mono-tech text-[10px] uppercase ${statusBadge}`}
                          >
                            {row.status.replace('_', ' ')}
                          </span>
                          {row.refundNote && (
                            <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[140px]" title={row.refundNote}>
                              Note: {row.refundNote}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-400 whitespace-nowrap">
                          {row.reference}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-300">
                          {row.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-zinc-300 truncate max-w-[130px]">
                          {row.sponsor || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {row.status === 'pending' && (
                              <button
                                type="button"
                                disabled={verifyingRef === row.reference}
                                onClick={() => handleReverifyPendingRow(row)}
                                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono-tech text-[10px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${
                                    verifyingRef === row.reference ? 'animate-spin' : ''
                                  }`}
                                />
                                <span>Re-verify</span>
                              </button>
                            )}
                            {row.status !== 'refunded' && row.status !== 'failed' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundTargetRow(row);
                                  setRefundNote(row.refundNote || '');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-mono-tech text-[10px] cursor-pointer"
                              >
                                Mark refunded
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: SLOTS & FUNDING
         ===================================================================== */}
      {subTab === 'slots' && (
        <div className="space-y-6">
          {/* 1. KoHot Allocations (Pick Institution, Department, Year — Album Need Not Exist Yet) */}
          <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-4">
            <div>
              <h3 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#d4af37]" />
                <span>KoHot Slot Allocations</span>
              </h3>
              <p className="font-body text-xs text-zinc-400 mt-0.5">
                Pre-allocate KoHot-sponsored slots for any institution, department, and graduation year (even before the album is created).
              </p>
            </div>

            <form onSubmit={handleCreateAllocation} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Institution
                </label>
                <select
                  value={allocInstId}
                  onChange={(e) => setAllocInstId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                >
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Department
                </label>
                <select
                  value={allocDeptId}
                  onChange={(e) => setAllocDeptId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                >
                  {(selectedUniForAlloc?.departments || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Graduation Year
                </label>
                <input
                  type="number"
                  min={1980}
                  max={2040}
                  value={allocYear}
                  onChange={(e) => setAllocYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Slots &amp; Note
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={allocQty}
                    onChange={(e) => setAllocQty(e.target.value)}
                    placeholder="Slots"
                    className="w-20 px-2.5 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={allocNote}
                    onChange={(e) => setAllocNote(e.target.value)}
                    placeholder="Optional note"
                    className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSavingAlloc}
                  className="w-full px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#c5a028] text-black font-syne font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                >
                  Allocate Slots
                </button>
              </div>
            </form>

            {/* Allocations List */}
            {enrichedAllocations.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/40 font-mono-tech text-[10px] uppercase text-zinc-400">
                      <th className="py-2 px-3">Institution &amp; Department</th>
                      <th className="py-2 px-3">Year</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Allocated</th>
                      <th className="py-2 px-3">Used</th>
                      <th className="py-2 px-3">Remaining</th>
                      <th className="py-2 px-3">Note</th>
                      <th className="py-2 px-3 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {enrichedAllocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3">
                          <p className="font-syne font-semibold text-white text-xs">
                            {alloc.institutionName}
                          </p>
                          <p className="font-body text-[11px] text-zinc-400">
                            {alloc.departmentName}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-xs text-zinc-300">
                          {alloc.graduationYear}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full border font-mono-tech text-[10px] uppercase ${
                              alloc.status === 'credited'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {alloc.status === 'credited' ? 'Credited' : 'Waiting for album'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech font-bold text-white">
                          {alloc.quantity}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-zinc-300">
                          {alloc.usedSlots ?? 0}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-emerald-400 font-semibold">
                          {alloc.remainingSlots ?? alloc.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-xs truncate max-w-[160px]">
                          {alloc.note || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAlloc(alloc);
                              setEditAllocQty(String(alloc.quantity));
                              setEditAllocNote(alloc.note || '');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono-tech text-[10px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3 text-[#d4af37]" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. Per-Album Slot Balance & Sponsors */}
          <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-3">
            <div>
              <h3 className="font-syne font-bold text-sm text-white">
                Per-Album Slot Balance &amp; Sponsors ({liveSets.length})
              </h3>
              <p className="font-body text-xs text-zinc-400 mt-0.5">
                Grant free slots (reason required) or edit/remove public sponsor names. KoHot credit is Host-only.
              </p>
            </div>

            <div className="space-y-2.5">
              {liveSets.map((album) => {
                const usedCount =
                  album.totalSlotsUsed ??
                  album.students.filter((st) => st.approved && !st.isClassRep).length;
                const creditedCount =
                  album.totalSlotsCredited ??
                  Math.max(usedCount, (album.profileSlotBalance || 0) + usedCount);
                const balanceCount =
                  album.profileSlotBalance ?? Math.max(0, creditedCount - usedCount);
                const sponsors = album.sponsors || [];

                return (
                  <div
                    key={album.id}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-syne font-bold text-xs sm:text-sm text-white">
                          {album.classSetName}
                        </span>
                        <span className="font-mono-tech text-[10px] text-zinc-400">
                          {album.institutionName} · {album.departmentName} ({album.graduationYear})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 font-mono-tech text-[11px]">
                        <span className="text-zinc-400">
                          Credited: <strong className="text-white">{creditedCount}</strong>
                        </span>
                        <span className="text-zinc-400">
                          Used: <strong className="text-zinc-200">{usedCount}</strong>
                        </span>
                        <span className="text-zinc-400">
                          Balance: <strong className="text-emerald-400">{balanceCount}</strong>
                        </span>
                      </div>

                      {sponsors.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {sponsors.map((sp) => (
                            <div
                              key={sp.id || sp.reference}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[11px]"
                            >
                              <span className="font-semibold text-white">
                                {sp.DisplayLabel || sp.sponsorName}
                              </span>
                              <span className="font-mono-tech text-[10px] text-[#d4af37]">
                                ({sp.quantity} slots)
                              </span>
                              {sp.showSponsorNameOnAlbum === false && (
                                <span className="text-[9px] font-mono-tech text-zinc-500 uppercase">
                                  [Hidden]
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSponsorContext({
                                    album,
                                    sponsorId: sp.id,
                                    reference: sp.reference,
                                    currentName: sp.sponsorName,
                                  });
                                  setEditSponsorNameInput(sp.sponsorName);
                                }}
                                className="text-zinc-400 hover:text-white ml-1 cursor-pointer"
                                title="Edit or remove public sponsor name"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setGrantAlbumTarget(album);
                          setGrantSlotsQty('5');
                          setGrantSlotsReason('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Grant free slots</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: SETTINGS
         ===================================================================== */}
      {subTab === 'settings' && (
        <form onSubmit={handleSavePlatformSettings} className="space-y-5">
          <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-4">
            <div>
              <h3 className="font-syne font-bold text-sm text-white">
                Platform Fee &amp; Lifecycle Thresholds
              </h3>
              <p className="font-body text-xs text-zinc-400 mt-0.5">
                Every change is validated and recorded in the Host audit log. Student fee is stored in kobo ({Number(studentFeeNairaInput || 0) * 100} kobo).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Student Fee (₦ NGN · stored in kobo)
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={studentFeeNairaInput}
                  onChange={(e) => setStudentFeeNairaInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
                <span className="font-mono-tech text-[10px] text-zinc-500 mt-0.5 block">
                  Stored as {Math.round((Number(studentFeeNairaInput) || 0) * 100)} kobo (Default: ₦500 / 50000 kobo)
                </span>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Min Funded Profiles to Publish
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={minFundedInput}
                  onChange={(e) => setMinFundedInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Default Profile Cap per Album
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={profileCapInput}
                  onChange={(e) => setProfileCapInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Default KoHot Slots per Album
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={defaultKohotSlotsInput}
                  onChange={(e) => setDefaultKohotSlotsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Reinstate Window (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={reinstateDaysInput}
                  onChange={(e) => setReinstateDaysInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Draft Retention (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={draftRetentionInput}
                  onChange={(e) => setDraftRetentionInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Recovery Period (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={recoveryPeriodInput}
                  onChange={(e) => setRecoveryPeriodInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Currency per Institution (default NGN) */}
          <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-3">
            <div>
              <h3 className="font-syne font-bold text-sm text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#d4af37]" />
                <span>Currency per Institution (Default: NGN)</span>
              </h3>
              <p className="font-body text-xs text-zinc-400 mt-0.5">
                Configure currency code per institution. All monetary formatting uses the shared currency helper.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {universities.map((uni) => {
                const currentCurr = instCurrencies[uni.id] || uni.currency || 'NGN';
                return (
                  <div
                    key={uni.id}
                    className="p-2.5 rounded-lg bg-black/50 border border-white/10 flex items-center justify-between gap-2"
                  >
                    <span className="font-body text-xs text-white truncate" title={uni.name}>
                      {uni.shortCode ? `${uni.shortCode} — ${uni.name}` : uni.name}
                    </span>
                    <select
                      value={currentCurr}
                      onChange={(e) =>
                        setInstCurrencies((prev) => ({
                          ...prev,
                          [uni.id]: e.target.value,
                        }))
                      }
                      className="px-2 py-1 rounded bg-zinc-900 border border-white/15 font-mono-tech text-[11px] text-white shrink-0"
                    >
                      <option value="NGN">NGN (₦)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GHS">GHS (GH₵)</option>
                      <option value="KES">KES (KSh)</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-xl bg-[#d4af37] hover:bg-[#c5a028] text-black font-syne font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* =====================================================================
          MODAL: MARK TRANSACTION REFUNDED (WITH REQUIRED NOTE)
         ===================================================================== */}
      {refundTargetRow && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRefundTargetRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base">Mark Transaction Refunded</h3>
              <button
                type="button"
                onClick={() => setRefundTargetRow(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmMarkRefunded} className="space-y-3 text-xs">
              <p className="text-zinc-400 leading-relaxed">
                The refund itself is processed in Paystack. Record a note below to mark reference{' '}
                <strong className="text-white font-mono-tech">{refundTargetRow.reference}</strong> (
                {formatMoneyFromKobo(refundTargetRow.amountKobo)}) as refunded in the ledger.
              </p>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Refund Note *
                </label>
                <textarea
                  rows={3}
                  required
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="e.g. Refunded via Paystack dashboard on 07/11/2026 (duplicate payment)"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundTargetRow(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-syne font-bold text-xs uppercase cursor-pointer"
                >
                  Confirm Refunded
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDIT KOHOT ALLOCATION
         ===================================================================== */}
      {editingAlloc && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingAlloc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base">Edit KoHot Allocation</h3>
              <button
                type="button"
                onClick={() => setEditingAlloc(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedAllocation} className="space-y-3 text-xs">
              <p className="text-zinc-400">
                {editingAlloc.institutionName} · {editingAlloc.departmentName} (Class of{' '}
                {editingAlloc.graduationYear})
              </p>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Slots Quantity (Min allowed: {editingAlloc.usedSlots ?? 0} used)
                </label>
                <input
                  type="number"
                  min={editingAlloc.usedSlots ?? 0}
                  max={1000}
                  required
                  value={editAllocQty}
                  onChange={(e) => setEditAllocQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Increasing appends slots to the ledger; decreasing is allowed only down to unused slots.
                </span>
              </div>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={editAllocNote}
                  onChange={(e) => setEditAllocNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAlloc(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAlloc}
                  className="px-4 py-2 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: GRANT FREE SLOTS TO ALBUM (REASON REQUIRED)
         ===================================================================== */}
      {grantAlbumTarget && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setGrantAlbumTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base">Grant Free KoHot Slots</h3>
              <button
                type="button"
                onClick={() => setGrantAlbumTarget(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGrantFreeSlotsSubmit} className="space-y-3 text-xs">
              <p className="text-zinc-400">
                Granting KoHot-sponsored slots to <strong className="text-white">{grantAlbumTarget.classSetName}</strong>.
              </p>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Number of Free Slots *
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={grantSlotsQty}
                  onChange={(e) => setGrantSlotsQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Reason (Required) *
                </label>
                <input
                  type="text"
                  required
                  value={grantSlotsReason}
                  onChange={(e) => setGrantSlotsReason(e.target.value)}
                  placeholder="e.g. Founding Class campus partnership grant"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGrantAlbumTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGrantingSlots}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-syne font-bold text-xs uppercase cursor-pointer"
                >
                  Grant Slots
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: EDIT OR REMOVE PUBLIC SPONSOR NAME
         ===================================================================== */}
      {editingSponsorContext && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingSponsorContext(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base">Manage Public Sponsor Name</h3>
              <button
                type="button"
                onClick={() => setEditingSponsorContext(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-zinc-400">
                Album: <strong className="text-white">{editingSponsorContext.album.classSetName}</strong>
              </p>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Public Sponsor Name
                </label>
                <input
                  type="text"
                  value={editSponsorNameInput}
                  onChange={(e) => setEditSponsorNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveSponsorEdit('remove')}
                  className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-mono-tech text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Public Name</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSponsorContext(null)}
                    className="px-3 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveSponsorEdit('edit')}
                    className="px-4 py-2 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer"
                  >
                    Save Name
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
