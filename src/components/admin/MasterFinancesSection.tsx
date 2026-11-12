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
  X,
  Pause,
  Play,
  Copy,
  Tag,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  ClassSet,
  UniversityDirectoryItem,
  FinancialTransaction,
  AuditLogEntry,
  FinanceLedgerRow,
  FinanceLedgerRowStatus,
  FinanceLedgerRowType,
  TransactionEnvironment,
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
  grantFreeSlotsOnServer,
  updateAlbumSponsorOnServer,
  fetchFinancesLedgerFromServer,
  fetchFinancesSummaryFromServer,
  markTransactionRefundedOnServer,
  fetchHistoricalTransactionsAuditFromServer,
  voidTransactionOnServer,
  restoreTransactionOnServer,
  classifyTransactionEnvironmentOnServer,
  verifyPaystackPaymentOnServer,
  OfferProgramme,
  CohortAllocationItem,
  fetchOfferProgrammesFromServer,
  createOfferProgrammeOnServer,
  updateOfferProgrammeOnServer,
  deleteOfferProgrammeOnServer,
  fetchCohortOffersFromServer,
  bulkUpdateCohortOffersOnServer,
  copyCohortOffersFromYearOnServer,
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
type OffersSegment = 'cohorts' | 'programmes';
type CohortFilterKind = 'all' | 'funding' | 'discount' | 'standard';

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
  const [offersSegment, setOffersSegment] = useState<OffersSegment>('cohorts');
  const [, setIsLoading] = useState(false);

  // Platform settings state
  const [studentFeeNairaInput, setStudentFeeNairaInput] = useState('1000');
  const [defaultDiscountPercentInput, setDefaultDiscountPercentInput] = useState('20');
  const [foundingDiscountNameInput, setFoundingDiscountNameInput] = useState(
    'Founding Class Departmental Discount'
  );
  const [foundingDiscountDescInput, setFoundingDiscountDescInput] = useState(
    'Special rate for the founding graduating class of a department.'
  );
  const [minFundedInput, setMinFundedInput] = useState('10');
  const [profileCapInput, setProfileCapInput] = useState('200');
  const [reinstateDaysInput, setReinstateDaysInput] = useState('7');
  const [draftRetentionInput, setDraftRetentionInput] = useState('30');
  const [recoveryPeriodInput, setRecoveryPeriodInput] = useState('30');
  const [defaultKohotSlotsInput, setDefaultKohotSlotsInput] = useState('0');
  const [instCurrencies, setInstCurrencies] = useState<Record<string, string>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Ledger & Summary state
  const [serverLedgerRows, setServerLedgerRows] = useState<FinanceLedgerRow[]>([]);
  const [serverSummary, setServerSummary] = useState<any | null>(null);
  const [historicalAuditData, setHistoricalAuditData] = useState<{
    historical25kCandidates: any[];
    auditItems: any[];
  } | null>(null);

  // Filters for Transactions sub-tab
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | FinanceLedgerRowType>('all');
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | FinanceLedgerRowStatus>('all');
  const [txEnvFilter, setTxEnvFilter] = useState<'all' | TransactionEnvironment>('all');
  const [txInstFilter, setTxInstFilter] = useState<string>('all');
  const [txDateFrom, setTxDateFrom] = useState<string>('');
  const [txDateTo, setTxDateTo] = useState<string>('');
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);

  // Refund Modal state
  const [refundTargetRow, setRefundTargetRow] = useState<FinanceLedgerRow | null>(null);
  const [refundNote, setRefundNote] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Void Transaction Modal state
  const [voidTargetRow, setVoidTargetRow] = useState<FinanceLedgerRow | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidClassifyAsTest, setVoidClassifyAsTest] = useState(true);
  const [voidConfirmedCheck, setVoidConfirmedCheck] = useState(false);
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);

  // Restore Voided Transaction Modal state
  const [restoreTargetRow, setRestoreTargetRow] = useState<FinanceLedgerRow | null>(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreConfirmedCheck, setRestoreConfirmedCheck] = useState(false);
  const [isSubmittingRestore, setIsSubmittingRestore] = useState(false);

  // Classify Environment Modal state
  const [classifyTargetRow, setClassifyTargetRow] = useState<FinanceLedgerRow | null>(null);
  const [classifyEnv, setClassifyEnv] = useState<TransactionEnvironment>('test');
  const [classifyReason, setClassifyReason] = useState('');
  const [classifyConfirmedCheck, setClassifyConfirmedCheck] = useState(false);
  const [isSubmittingClassify, setIsSubmittingClassify] = useState(false);

  // Legacy KoHot Slot Allocations state (merged into programmes/cohorts, used for overview metric fallback)
  const [allocations, setAllocations] = useState<SlotAllocationRecord[]>([]);

  // Cohort Offers & Programmes state
  const [programmes, setProgrammes] = useState<OfferProgramme[]>([]);
  const [cohortInstId, setCohortInstId] = useState<string>(universities[0]?.id || 'unilorin');
  const [cohortYear, setCohortYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
  ]);
  const [isAddingYear, setIsAddingYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [cohortAllocations, setCohortAllocations] = useState<CohortAllocationItem[]>([]);
  const [cohortFilter, setCohortFilter] = useState<CohortFilterKind>('all');
  const [cohortSearch, setCohortSearch] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [assignProgrammeId, setAssignProgrammeId] = useState<string>('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [lastBulkResultSummary, setLastBulkResultSummary] = useState<string | null>(null);
  const [isCopyYearModalOpen, setIsCopyYearModalOpen] = useState(false);
  const [isCopyingYear, setIsCopyingYear] = useState(false);

  // Programme Create/Edit Modal state
  const [isProgrammeModalOpen, setIsProgrammeModalOpen] = useState(false);
  const [editingProgramme, setEditingProgramme] = useState<OfferProgramme | null>(null);
  const [progKind, setProgKind] = useState<'funding' | 'discount'>('funding');
  const [progName, setProgName] = useState('');
  const [progDiscountPercent, setProgDiscountPercent] = useState('25');
  const [progCoverageMode, setProgCoverageMode] = useState<'all' | 'per_album_cap'>('per_album_cap');
  const [progCoverageCap, setProgCoverageCap] = useState('150');
  const [progSponsorName, setProgSponsorName] = useState('KoHot');
  const [progShowRecognition, setProgShowRecognition] = useState(true);
  const [progValidFrom, setProgValidFrom] = useState('');
  const [progValidTo, setProgValidTo] = useState('');
  const [isSavingProgramme, setIsSavingProgramme] = useState(false);
  const [deletingProgrammeTarget, setDeletingProgrammeTarget] = useState<OfferProgramme | null>(null);
  const [isDeletingProgramme, setIsDeletingProgramme] = useState(false);

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

  const loadOffersData = async (instId = cohortInstId, year = cohortYear) => {
    const [progRes, cohortRes] = await Promise.all([
      fetchOfferProgrammesFromServer(),
      fetchCohortOffersFromServer(instId, year),
    ]);
    if (progRes.programmes) {
      setProgrammes(progRes.programmes);
      const firstActive = progRes.programmes.find((p) => p.status === 'active');
      if (firstActive && !assignProgrammeId) {
        setAssignProgrammeId(firstActive.id);
      }
    }
    if (cohortRes.allocations) {
      setCohortAllocations(cohortRes.allocations);
    }
    if (cohortRes.availableYears && cohortRes.availableYears.length > 0) {
      const mergedYears = Array.from(
        new Set([
          ...cohortRes.availableYears,
          ...liveSets.map((s) => Number(s.graduationYear)).filter((y) => Number.isFinite(y)),
          year,
        ])
      ).sort((a, b) => b - a);
      setAvailableYears(mergedYears);
    }
  };

  const loadFinancesData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, allocRes, ledgerRes, summaryRes, histAuditRes] = await Promise.all([
        fetchAdminSettingsFromServer(),
        fetchSlotAllocationsFromServer(),
        fetchFinancesLedgerFromServer(),
        fetchFinancesSummaryFromServer(),
        fetchHistoricalTransactionsAuditFromServer(),
      ]);

      if (settingsRes.settings) {
        const s = settingsRes.settings;
        setStudentFeeNairaInput(String(Math.round((Number(s.student_fee_kobo) || 100000) / 100)));
        setDefaultDiscountPercentInput(String(s.default_discount_percent ?? 20));
        if (s.founding_discount_name) {
          setFoundingDiscountNameInput(String(s.founding_discount_name));
        }
        if (s.founding_discount_description) {
          setFoundingDiscountDescInput(String(s.founding_discount_description));
        }
        setMinFundedInput(String(s.min_funded_to_publish ?? 10));
        setProfileCapInput(String(s.profile_cap_default ?? 200));
        setReinstateDaysInput(String(s.reinstate_days ?? 7));
        setDraftRetentionInput(String(s.draft_retention_days ?? 30));
        setRecoveryPeriodInput(String(s.recovery_period_days ?? 30));
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
      if (histAuditRes.success) {
        setHistoricalAuditData({
          historical25kCandidates: histAuditRes.historical25kCandidates,
          auditItems: histAuditRes.auditItems,
        });
      }
      await loadOffersData(cohortInstId, cohortYear);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFinancesData();
  }, []);

  // Reload independent cohort offers when institution or graduation year changes
  useEffect(() => {
    setSelectedDeptIds([]);
    setLastBulkResultSummary(null);
    loadOffersData(cohortInstId, cohortYear);
  }, [cohortInstId, cohortYear]);

  const unitFeeKobo = useMemo(() => {
    const parsedNaira = Number(studentFeeNairaInput);
    return Number.isFinite(parsedNaira) && parsedNaira >= 0 ? Math.round(parsedNaira * 100) : 100000;
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
      if (rawStatus === 'voided') status = 'voided';
      else if (rawStatus === 'refunded') status = 'refunded';
      else if (rawStatus === 'refund_due' || rawStatus === 'refund due') status = 'refund_due';
      else if (rawStatus.includes('needs review')) status = 'needs_review';
      else if (rawStatus === 'paid' || rawStatus === 'completed') status = 'paid';
      else if (rawStatus === 'failed') status = 'failed';

      const isSlot =
        String(tx.category || '').toLowerCase().includes('slot') ||
        tx.reference.includes('-SLT-');
      const amountKobo = Math.round((Number(tx.amount) || 0) * 100);
      const txEnv: TransactionEnvironment =
        (tx as any).environment === 'live'
          ? 'live'
          : (tx as any).environment === 'test'
          ? 'test'
          : 'legacy';
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
        environment: txEnv,
        reference: tx.reference,
        quantity: isSlot ? Math.max(1, Math.round(amountKobo / (unitFeeKobo || 100000))) : 1,
        isHistorical25kCandidate: amountKobo === 2500000 && txEnv !== 'live',
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

  // Compute Overview Summary (Africa/Lagos time UTC+1) — Commercial revenue counts ONLY verified LIVE payments
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

    let testRevenueKobo = 0;
    let testPaymentsCount = 0;
    let legacyRevenueKobo = 0;
    let legacyPaymentsCount = 0;
    let voidedTransactionsKobo = 0;
    let voidedTransactionsCount = 0;
    let reversedSlotsCount = 0;
    let historical25kTestCount = 0;

    for (const r of combinedLedgerRows) {
      const rowLagosMonth = new Date(new Date(r.date).getTime() + 60 * 60 * 1000)
        .toISOString()
        .slice(0, 7);
      const env = r.environment || 'legacy';
      if (r.reversedSlots && r.reversedSlots > 0) {
        reversedSlotsCount += r.reversedSlots;
      }
      if ((r.isHistorical25kCandidate || (r.amountKobo === 2500000 && env !== 'live')) && r.status !== 'voided') {
        historical25kTestCount += 1;
      }
      if (r.status === 'voided') {
        voidedTransactionsKobo += r.amountKobo;
        voidedTransactionsCount += 1;
        continue;
      }
      if (r.status === 'paid') {
        if (env === 'live') {
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
        } else if (env === 'test') {
          testRevenueKobo += r.amountKobo;
          testPaymentsCount += 1;
        } else {
          legacyRevenueKobo += r.amountKobo;
          legacyPaymentsCount += 1;
        }
      } else if (r.status === 'refund_due') {
        if (env === 'live') {
          refundsDueKobo += r.amountKobo;
        }
        refundsDueCount += 1;
      } else if (r.status === 'refunded') {
        if (env === 'live') {
          refundedKobo += r.amountKobo;
        }
      } else if (r.status === 'pending') {
        pendingPaymentsCount += 1;
      } else if (r.status === 'needs_review') {
        paidNeedsReviewCount += 1;
      }
    }

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
      testRevenueKobo: serverSummary?.testRevenueKobo ?? testRevenueKobo,
      testPaymentsCount: serverSummary?.testPaymentsCount ?? testPaymentsCount,
      legacyRevenueKobo: serverSummary?.legacyRevenueKobo ?? legacyRevenueKobo,
      legacyPaymentsCount: serverSummary?.legacyPaymentsCount ?? legacyPaymentsCount,
      voidedTransactionsKobo: serverSummary?.voidedTransactionsKobo ?? voidedTransactionsKobo,
      voidedTransactionsCount: serverSummary?.voidedTransactionsCount ?? voidedTransactionsCount,
      reversedSlotsCount: Math.max(serverSummary?.reversedSlotsCount || 0, reversedSlotsCount),
      activePaystackKeyMode: serverSummary?.activePaystackKeyMode || 'test',
      historical25kTestCount: serverSummary?.needsAttention?.historical25kTestCount ?? historical25kTestCount,
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
      const rowEnv = row.environment || 'legacy';
      if (txEnvFilter !== 'all' && rowEnv !== txEnvFilter) return false;
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
        const hay = `${row.reference} ${row.institutionName} ${row.departmentName} ${row.classYear} ${row.sponsor || ''} ${row.payerName || ''} ${row.payerEmail || ''} ${row.voidReason || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [combinedLedgerRows, txSearch, txTypeFilter, txStatusFilter, txEnvFilter, txInstFilter, txDateFrom, txDateTo]);

  // Export CSV with formula-injection protection
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

  const handleConfirmVoidTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTargetRow) return;
    const cleanReason = voidReason.trim();
    if (cleanReason.length < 3) {
      showError('Reason required', 'Please enter a mandatory reason (minimum 3 characters) for voiding this transaction.');
      return;
    }
    if (!voidConfirmedCheck) {
      showError('Confirmation required', 'Please check the confirmation box before voiding.');
      return;
    }

    setIsSubmittingVoid(true);
    try {
      const res = await voidTransactionOnServer({
        reference: voidTargetRow.reference,
        reason: cleanReason,
        confirm: true,
        classifyAsTest: voidClassifyAsTest,
      });
      if (!res.success) {
        showError('Void blocked', res.message || res.error || 'Could not void transaction.');
        return;
      }

      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: voidTargetRow.reference,
        details: `Voided transaction ${voidTargetRow.reference} (${formatMoneyFromKobo(voidTargetRow.amountKobo)}). Slots reversed: ${res.slotsReversed || 0}. Reason: ${cleanReason}`,
      });

      showSuccess(
        'Transaction voided',
        `Reference ${voidTargetRow.reference} voided${res.slotsReversed ? ` and ${res.slotsReversed} credited slot(s) reversed via compensating ledger entry` : ''}.`
      );
      setVoidTargetRow(null);
      setVoidReason('');
      setVoidConfirmedCheck(false);
      await loadFinancesData();
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  const handleConfirmRestoreTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreTargetRow) return;
    const cleanReason = restoreReason.trim();
    if (cleanReason.length < 3) {
      showError('Reason required', 'Please enter a mandatory reason for restoring this voided transaction.');
      return;
    }
    if (!restoreConfirmedCheck) {
      showError('Confirmation required', 'Please check the confirmation box before restoring.');
      return;
    }

    setIsSubmittingRestore(true);
    try {
      const res = await restoreTransactionOnServer({
        reference: restoreTargetRow.reference,
        reason: cleanReason,
        confirm: true,
      });
      if (!res.success) {
        showError('Restore failed', res.message || res.error || 'Could not restore voided transaction.');
        return;
      }

      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: restoreTargetRow.reference,
        details: `Restored voided transaction ${restoreTargetRow.reference} to status "${res.status}". Slots restored: ${res.slotsRestored || 0}. Reason: ${cleanReason}`,
      });

      showSuccess(
        'Transaction restored',
        `Reference ${restoreTargetRow.reference} restored to ${res.status}${res.slotsRestored ? ` (+${res.slotsRestored} slot(s) restored)` : ''}.`
      );
      setRestoreTargetRow(null);
      setRestoreReason('');
      setRestoreConfirmedCheck(false);
      await loadFinancesData();
    } finally {
      setIsSubmittingRestore(false);
    }
  };

  const handleConfirmClassifyEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classifyTargetRow) return;
    const cleanReason = classifyReason.trim();
    if (cleanReason.length < 3) {
      showError('Reason required', 'Please enter a mandatory reason for classifying this transaction environment.');
      return;
    }
    if (!classifyConfirmedCheck) {
      showError('Confirmation required', 'Please check the confirmation box before classifying.');
      return;
    }

    setIsSubmittingClassify(true);
    try {
      const res = await classifyTransactionEnvironmentOnServer({
        reference: classifyTargetRow.reference,
        environment: classifyEnv,
        reason: cleanReason,
        confirm: true,
      });
      if (!res.success) {
        showError('Classification failed', res.message || res.error || 'Could not classify transaction environment.');
        return;
      }

      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: classifyTargetRow.reference,
        details: `Classified transaction ${classifyTargetRow.reference} environment as "${classifyEnv}". Reason: ${cleanReason}`,
      });

      showSuccess(
        'Environment classified',
        `Reference ${classifyTargetRow.reference} marked as ${classifyEnv.toUpperCase()}.`
      );
      setClassifyTargetRow(null);
      setClassifyReason('');
      setClassifyConfirmedCheck(false);
      await loadFinancesData();
    } finally {
      setIsSubmittingClassify(false);
    }
  };

  // =========================================================================
  // COHORT OFFERS & PROGRAMMES COMPUTED DATA & HANDLERS
  // =========================================================================
  const selectedCohortUni = useMemo(
    () => universities.find((u) => u.id === cohortInstId) || universities[0],
    [universities, cohortInstId]
  );

  const allocByDeptMap = useMemo(() => {
    const map = new Map<string, CohortAllocationItem>();
    for (const a of cohortAllocations) {
      if (Number(a.graduationYear) === Number(cohortYear)) {
        map.set(String(a.departmentId).toLowerCase(), a);
      }
    }
    return map;
  }, [cohortAllocations, cohortYear]);

  const cohortDepartmentRows = useMemo(() => {
    const depts = selectedCohortUni?.departments || [];
    const todayIso = new Date().toISOString().slice(0, 10);
    const graduationCutoffIso = `${cohortYear}-12-31`;

    return depts.map((dept) => {
      const alloc = allocByDeptMap.get(dept.id.toLowerCase()) || null;
      const prog = alloc?.programme || null;
      const matchedAlbum = liveSets.find(
        (s) =>
          (s.institutionId || s.universityId || '').toLowerCase() ===
            (selectedCohortUni?.id || '').toLowerCase() &&
          s.departmentId.toLowerCase() === dept.id.toLowerCase() &&
          Number(s.graduationYear) === Number(cohortYear)
      );

      const albumState: 'no_album' | 'draft' | 'published' = !matchedAlbum
        ? 'no_album'
        : matchedAlbum.isPublished || matchedAlbum.lifecycleStatus === 'published'
        ? 'published'
        : 'draft';

      const isActiveInDate =
        prog &&
        prog.status === 'active' &&
        (!prog.validFrom || prog.validFrom <= todayIso) &&
        (!prog.validTo || prog.validTo >= todayIso);

      let effectiveKind: 'funding' | 'discount' | 'standard' = 'standard';
      let effectivePriceKobo = unitFeeKobo;
      if (prog && isActiveInDate) {
        if (prog.kind === 'funding') {
          effectiveKind = 'funding';
          effectivePriceKobo = 0;
        } else if (prog.kind === 'discount') {
          effectiveKind = 'discount';
          const pct = Math.min(99, Math.max(1, Number(prog.discountPercent) || 0));
          effectivePriceKobo = Math.round((unitFeeKobo * (100 - pct)) / 100);
        }
      } else if (prog) {
        // Assigned programme exists (may be paused or out of date)
        effectiveKind = prog.kind;
      }

      const expiresBeforeGrad = Boolean(
        prog && prog.validTo && prog.validTo < graduationCutoffIso
      );

      return {
        dept,
        alloc,
        programme: prog,
        albumState,
        matchedAlbum,
        effectiveKind,
        effectivePriceKobo,
        isActiveInDate: Boolean(isActiveInDate),
        expiresBeforeGrad,
      };
    });
  }, [selectedCohortUni, allocByDeptMap, liveSets, cohortYear, unitFeeKobo]);

  const cohortYearCounts = useMemo(() => {
    let funding = 0;
    let discount = 0;
    let standard = 0;
    for (const r of cohortDepartmentRows) {
      if (r.programme?.kind === 'funding') funding += 1;
      else if (r.programme?.kind === 'discount') discount += 1;
      else standard += 1;
    }
    return {
      funding,
      discount,
      standard,
      total: cohortDepartmentRows.length,
    };
  }, [cohortDepartmentRows]);

  const filteredCohortRows = useMemo(() => {
    const q = cohortSearch.trim().toLowerCase();
    return cohortDepartmentRows.filter((row) => {
      const rowKind = row.programme ? row.programme.kind : 'standard';
      if (cohortFilter !== 'all' && rowKind !== cohortFilter) return false;
      if (q) {
        const hay = `${row.dept.name} ${row.dept.faculty || ''} ${row.programme?.name || ''} ${row.programme?.sponsorName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cohortDepartmentRows, cohortFilter, cohortSearch]);

  const toggleDeptSelection = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredCohortRows.map((r) => r.dept.id);
    const allFilteredSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedDeptIds.includes(id));
    if (allFilteredSelected) {
      setSelectedDeptIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedDeptIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleBulkAssignOrRemove = async (action: 'assign' | 'remove') => {
    if (selectedDeptIds.length === 0) return;
    if (action === 'assign' && !assignProgrammeId) {
      showError('Select programme', 'Choose an active Funding or Discount programme to assign.');
      return;
    }
    setIsApplyingBulk(true);
    setLastBulkResultSummary(null);
    try {
      const res = await bulkUpdateCohortOffersOnServer({
        institutionId: cohortInstId,
        graduationYear: cohortYear,
        departmentIds: selectedDeptIds,
        action,
        programmeId: action === 'assign' ? assignProgrammeId : undefined,
      });
      if (!res.success) {
        showError('Bulk update failed', res.error || 'Could not update cohort offers.');
        return;
      }

      const assignedProg = programmes.find((p) => p.id === assignProgrammeId);
      const count = res.results?.length || selectedDeptIds.length;
      const summaryMsg =
        action === 'assign'
          ? `Assigned "${assignedProg?.name || 'Programme'}" to ${count} department${count === 1 ? '' : 's'} (${cohortYear}).`
          : `Removed offer from ${count} department${count === 1 ? '' : 's'} (${cohortYear}) — reverted to Standard.`;

      setLastBulkResultSummary(summaryMsg);
      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: `${cohortInstId}:${cohortYear}`,
        details: summaryMsg,
      });

      showSuccess(action === 'assign' ? 'Offer assigned' : 'Offer removed', summaryMsg);
      setSelectedDeptIds([]);
      await loadOffersData(cohortInstId, cohortYear);
    } finally {
      setIsApplyingBulk(false);
    }
  };

  const handleConfirmCopyFromPreviousYear = async () => {
    setIsCopyingYear(true);
    try {
      const fromYear = cohortYear - 1;
      const res = await copyCohortOffersFromYearOnServer({
        institutionId: cohortInstId,
        fromYear,
        toYear: cohortYear,
      });
      if (!res.success) {
        showError('Could not copy offers', res.error || 'Please try again.');
        return;
      }
      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: `${cohortInstId}:${cohortYear}`,
        details: `Copied ${res.copiedCount || 0} cohort offers from ${fromYear} to ${cohortYear} for ${cohortInstId}.`,
      });
      showSuccess(
        'Offers copied',
        `Copied ${res.copiedCount || 0} department offer${res.copiedCount === 1 ? '' : 's'} from ${fromYear} to ${cohortYear}.`
      );
      setIsCopyYearModalOpen(false);
      await loadOffersData(cohortInstId, cohortYear);
    } finally {
      setIsCopyingYear(false);
    }
  };

  const openNewProgrammeModal = () => {
    setEditingProgramme(null);
    setProgKind('funding');
    setProgName('');
    setProgDiscountPercent('25');
    setProgCoverageMode('per_album_cap');
    setProgCoverageCap('150');
    setProgSponsorName('KoHot');
    setProgShowRecognition(true);
    setProgValidFrom('');
    setProgValidTo('');
    setIsProgrammeModalOpen(true);
  };

  const openEditProgrammeModal = (prog: OfferProgramme) => {
    setEditingProgramme(prog);
    setProgKind(prog.kind);
    setProgName(prog.name);
    setProgDiscountPercent(String(prog.discountPercent ?? 25));
    setProgCoverageMode(prog.coverageMode || 'per_album_cap');
    setProgCoverageCap(String(prog.coverageCap ?? 150));
    setProgSponsorName(prog.sponsorName || 'KoHot');
    setProgShowRecognition(prog.showRecognition !== false);
    setProgValidFrom(prog.validFrom ? prog.validFrom.slice(0, 10) : '');
    setProgValidTo(prog.validTo ? prog.validTo.slice(0, 10) : '');
    setIsProgrammeModalOpen(true);
  };

  const handleSaveProgrammeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = progName.trim();
    if (!cleanName) {
      showError('Name required', 'Enter a programme name.');
      return;
    }

    const payload: any = {
      name: cleanName,
      kind: progKind,
      sponsorName: progSponsorName.trim() || 'KoHot',
      showRecognition: progShowRecognition,
      validFrom: progValidFrom || null,
      validTo: progValidTo || null,
    };

    if (progKind === 'discount') {
      const pct = Number(progDiscountPercent);
      if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
        showError('Invalid discount', 'Discount percentage must be a whole number from 1 to 99.');
        return;
      }
      payload.discountPercent = pct;
    } else {
      payload.coverageMode = progCoverageMode;
      if (progCoverageMode === 'per_album_cap') {
        const cap = Number(progCoverageCap);
        if (!Number.isInteger(cap) || cap < 1) {
          showError('Invalid coverage cap', 'Enter a positive profile cap.');
          return;
        }
        payload.coverageCap = cap;
      } else {
        payload.coverageCap = null;
      }
    }

    setIsSavingProgramme(true);
    try {
      const res = editingProgramme
        ? await updateOfferProgrammeOnServer(editingProgramme.id, payload)
        : await createOfferProgrammeOnServer(payload);

      if (!res.success) {
        showError('Could not save programme', res.error || 'Please check your inputs.');
        return;
      }

      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: res.programme?.id || editingProgramme?.id || 'programmes',
        details: `${editingProgramme ? 'Updated' : 'Created'} ${progKind} programme "${cleanName}"`,
      });

      showSuccess(
        editingProgramme ? 'Programme updated' : 'Programme created',
        `"${cleanName}" saved.`
      );
      setIsProgrammeModalOpen(false);
      await loadOffersData(cohortInstId, cohortYear);
    } finally {
      setIsSavingProgramme(false);
    }
  };

  const handleToggleProgrammeStatus = async (prog: OfferProgramme) => {
    const nextStatus = prog.status === 'active' ? 'paused' : 'active';
    const res = await updateOfferProgrammeOnServer(prog.id, { status: nextStatus });
    if (!res.success) {
      showError('Update failed', res.error || 'Could not update status.');
      return;
    }
    onAddAuditLog?.({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'settings_updated',
      actorUserId: currentUserEmail,
      actorRole: 'master_host',
      targetId: prog.id,
      details: `${nextStatus === 'paused' ? 'Paused' : 'Resumed'} programme "${prog.name}"`,
    });
    showSuccess(
      nextStatus === 'paused' ? 'Programme paused' : 'Programme resumed',
      `"${prog.name}" is now ${nextStatus}.`
    );
    await loadOffersData(cohortInstId, cohortYear);
  };

  const handleConfirmDeleteProgramme = async () => {
    if (!deletingProgrammeTarget) return;
    setIsDeletingProgramme(true);
    try {
      const res = await deleteOfferProgrammeOnServer(deletingProgrammeTarget.id);
      if (!res.success) {
        showError('Cannot delete programme', res.error || 'Programme is currently in use.');
        return;
      }
      onAddAuditLog?.({
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'settings_updated',
        actorUserId: currentUserEmail,
        actorRole: 'master_host',
        targetId: deletingProgrammeTarget.id,
        details: `Deleted unused programme "${deletingProgrammeTarget.name}"`,
      });
      showSuccess('Programme deleted', `"${deletingProgrammeTarget.name}" removed.`);
      setDeletingProgrammeTarget(null);
      await loadOffersData(cohortInstId, cohortYear);
    } finally {
      setIsDeletingProgramme(false);
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
    const defaultDiscountPercent = Number(defaultDiscountPercentInput);
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
    if (!Number.isFinite(defaultDiscountPercent) || defaultDiscountPercent < 0 || defaultDiscountPercent > 100) {
      showError('Invalid Founding Class discount', 'Discount percentage must be between 0% and 100%.');
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
    const cleanDiscName =
      foundingDiscountNameInput.trim() || 'Founding Class Departmental Discount';
    const cleanDiscDesc =
      foundingDiscountDescInput.trim() ||
      'Special rate for the founding graduating class of a department.';

    setIsSavingSettings(true);
    try {
      const res = await saveAdminSettingsToServer({
        student_fee_kobo: studentFeeKobo,
        default_discount_percent: Math.round(defaultDiscountPercent),
        founding_discount_name: cleanDiscName,
        founding_discount_description: cleanDiscDesc,
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

      try {
        window.dispatchEvent(new CustomEvent('kohot_pricing_updated'));
      } catch {
        // ignore
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
        details: `Updated platform financial settings: fee=${studentFeeKobo} kobo, founding_discount=${Math.round(defaultDiscountPercent)}%, min_funded=${minFunded}, cap=${profileCap}, reinstate=${reinstateDays}d, draft_retention=${draftRetention}d, recovery=${recoveryPeriod}d, default_kohot_slots=${defaultKohotSlots}`,
      });

      showSuccess('Settings saved & logged', 'All platform financial settings and public website pricing have been updated.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openAttentionFilter = (status: FinanceLedgerRowStatus) => {
    setTxStatusFilter(status);
    setTxTypeFilter('all');
    setSubTab('transactions');
  };

  const activeProgrammes = useMemo(
    () => programmes.filter((p) => p.status === 'active'),
    [programmes]
  );

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
              Confirmed revenue, Paystack ledger, cohort offers &amp; programmes, and Standard fee settings.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          className="inline-flex items-center gap-1 p-1.5 rounded-full bg-white dark:bg-[#12151e] border border-slate-200/90 dark:border-white/10 shadow-xs overflow-x-auto no-scrollbar shrink-0"
        >
          {(
            [
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'transactions', label: 'Transactions', icon: Coins },
              { id: 'slots', label: 'Offers', icon: Gift },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono-tech uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'active-clip bg-[#d4af37] text-black font-bold shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
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
          {/* Live vs Test Environment Banner */}
          <div className="p-3.5 rounded-xl bg-[#08090e] border border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-lg font-mono-tech text-[10px] uppercase font-bold border ${
                  overviewMetrics.activePaystackKeyMode === 'live'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                Active Keys: {overviewMetrics.activePaystackKeyMode === 'live' ? 'LIVE MODE' : 'TEST MODE'}
              </span>
              <p className="text-xs text-zinc-300">
                Commercial revenue metrics below count <strong className="text-white">verified LIVE payments only</strong>. Test, Voided, and Unclassified Historical records are strictly separated.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono-tech">
              <button
                type="button"
                onClick={() => {
                  setTxEnvFilter('test');
                  setTxStatusFilter('all');
                  setSubTab('transactions');
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 cursor-pointer"
              >
                Test: {formatMoneyFromKobo(overviewMetrics.testRevenueKobo)} ({overviewMetrics.testPaymentsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxEnvFilter('legacy');
                  setTxStatusFilter('all');
                  setSubTab('transactions');
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-500/15 hover:bg-zinc-500/25 border border-zinc-500/30 text-zinc-300 cursor-pointer"
              >
                Historical/Legacy: {formatMoneyFromKobo(overviewMetrics.legacyRevenueKobo)} ({overviewMetrics.legacyPaymentsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxEnvFilter('all');
                  setTxStatusFilter('voided');
                  setSubTab('transactions');
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer"
              >
                Voided: {overviewMetrics.voidedTransactionsCount} ({overviewMetrics.reversedSlotsCount} slots reversed)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400">
                  Confirmed Live Revenue (This Month)
                </span>
                <span className="text-[9px] font-mono-tech text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  LIVE ONLY • Africa/Lagos
                </span>
              </div>
              <p className="font-syne font-bold text-lg sm:text-xl text-white">
                {formatMoneyFromKobo(overviewMetrics.confirmedRevenueMonthKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                All time live:{' '}
                <span className="text-zinc-200 font-semibold">
                  {formatMoneyFromKobo(overviewMetrics.confirmedRevenueAllTimeKobo)}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 block">
                Live Student Payments
              </span>
              <p className="font-syne font-bold text-lg sm:text-xl text-white">
                {formatMoneyFromKobo(overviewMetrics.studentPaymentsKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                {overviewMetrics.studentPaymentsCount} verified live student{overviewMetrics.studentPaymentsCount === 1 ? '' : 's'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-zinc-400 block">
                Live Slot Purchases
              </span>
              <p className="font-syne font-bold text-lg sm:text-xl text-white">
                {formatMoneyFromKobo(overviewMetrics.slotPurchasesKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                {overviewMetrics.slotPurchasesCount} live batch purchase{overviewMetrics.slotPurchasesCount === 1 ? '' : 's'}
              </p>
            </div>

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

            <div className="p-4 rounded-xl bg-[#08090e] border border-emerald-500/25 space-y-1.5">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-emerald-400 block">
                Net Live Collected
              </span>
              <p className="font-syne font-bold text-lg sm:text-xl text-emerald-400">
                {formatMoneyFromKobo(overviewMetrics.netCollectedKobo)}
              </p>
              <p className="font-mono-tech text-[11px] text-zinc-400">
                Verified live revenue minus live refunds due
              </p>
            </div>

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

          {/* Historical Test Transactions (₦25,000) & Slot Reconciliation Panel */}
          {historicalAuditData && historicalAuditData.historical25kCandidates.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-syne font-bold text-sm text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Historical ₦25,000 Test Transaction Audit ({historicalAuditData.historical25kCandidates.length} Found)</span>
                  </h3>
                  <p className="font-body text-xs text-zinc-300 mt-0.5">
                    Inspect whether each ₦25,000 test transaction actually credited album slots in <code className="text-amber-200">slot_purchases</code> / <code className="text-amber-200">slot_ledger</code> before classifying or voiding. Records are never auto-deleted.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {historicalAuditData.historical25kCandidates.map((cand: any) => (
                  <div
                    key={cand.reference}
                    className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tech font-bold text-white">{cand.reference}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-tech text-[10px] uppercase">
                          Env: {cand.environment || 'legacy'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-zinc-200 font-mono-tech text-[10px] uppercase">
                          Status: {cand.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-zinc-300">
                      <strong>{formatMoneyFromKobo(cand.amountKobo)}</strong> • {cand.institutionName} — {cand.departmentName} ({cand.classYear})
                    </p>
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10 font-mono-tech text-[11px] space-y-1">
                      <p className="text-zinc-300">
                        Did Credit Slots:{' '}
                        <strong className={cand.didCreditSlots ? 'text-amber-300' : 'text-zinc-400'}>
                          {cand.didCreditSlots ? `YES (+${cand.creditedSlots} slots credited)` : 'NO (0 slots credited in slot_ledger)'}
                        </strong>
                      </p>
                      <p className="text-zinc-400">
                        Reversed Slots: <strong className="text-white">{cand.reversedSlots || 0}</strong> • Net Active Slots from Ref:{' '}
                        <strong className="text-white">{cand.netActiveSlots || 0}</strong> • Album Available Balance:{' '}
                        <strong className="text-emerald-300">{cand.albumCurrentSlotBalance ?? 0}</strong> (Used: {cand.albumTotalUsedSlots ?? 0})
                      </p>
                      {cand.voidBlockReason && cand.status !== 'voided' && (
                        <p className="text-rose-400 text-[10px]">{cand.voidBlockReason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {cand.environment !== 'test' && (
                        <button
                          type="button"
                          onClick={() => {
                            setClassifyTargetRow(cand);
                            setClassifyEnv('test');
                            setClassifyReason('Historical ₦25,000 test payment executed with Paystack test keys');
                            setClassifyConfirmedCheck(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-mono-tech text-[10px] uppercase cursor-pointer"
                        >
                          Classify as Test
                        </button>
                      )}
                      {cand.status !== 'voided' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVoidTargetRow(cand);
                            setVoidReason('Erroneous ₦25,000 Paystack test-mode transaction');
                            setVoidClassifyAsTest(true);
                            setVoidConfirmedCheck(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-mono-tech text-[10px] uppercase cursor-pointer"
                        >
                          Void Transaction{cand.netActiveSlots > 0 ? ` & Reverse ${cand.netActiveSlots} Slots` : ''}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRestoreTargetRow(cand);
                            setRestoreReason('');
                            setRestoreConfirmedCheck(false);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-mono-tech text-[10px] uppercase cursor-pointer"
                        >
                          Restore Voided Transaction
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
          <div className="p-3.5 rounded-xl bg-[#08090e] border border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
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
                value={txEnvFilter}
                onChange={(e) => setTxEnvFilter(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
              >
                <option value="all">All Environments</option>
                <option value="live">Live Only</option>
                <option value="test">Test Only</option>
                <option value="legacy">Historical / Unclassified</option>
              </select>

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
                <option value="paid">Paid / Successful</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="voided">Voided</option>
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
                  txEnvFilter !== 'all' ||
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
                      setTxEnvFilter('all');
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
                    <th className="py-2.5 px-3">Env &amp; Type</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Institution &amp; Dept</th>
                    <th className="py-2.5 px-3">Year</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Slots / Reconciliation</th>
                    <th className="py-2.5 px-3">Sponsor</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredLedgerRows.map((row) => {
                    const rowEnv = row.environment || 'legacy';
                    const envBadge =
                      rowEnv === 'live'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : rowEnv === 'test'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';

                    const statusBadge =
                      row.status === 'paid'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : row.status === 'voided'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 line-through'
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
                      <tr key={row.id} className={`hover:bg-white/[0.02] ${row.status === 'voided' ? 'opacity-65' : ''}`}>
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded border text-[9px] uppercase font-bold ${envBadge}`}>
                              {rowEnv}
                            </span>
                            <span>{row.type === 'slot_purchase' ? 'Slot purchase' : 'Student payment'}</span>
                          </div>
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
                          {row.voidReason && (
                            <p className="text-[10px] text-rose-300/90 mt-0.5 truncate max-w-[160px]" title={`Voided by ${row.voidedBy || 'Host'}: ${row.voidReason}`}>
                              Void: {row.voidReason}
                            </p>
                          )}
                          {row.refundNote && (
                            <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[140px]" title={row.refundNote}>
                              Note: {row.refundNote}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-400 whitespace-nowrap">
                          {row.reference}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tech text-[11px] text-zinc-300 whitespace-nowrap">
                          {row.type === 'slot_purchase' ? (
                            <div className="space-y-0.5">
                              {row.didCreditSlots ? (
                                <span className="text-emerald-300 font-bold">+{row.creditedSlots} credited</span>
                              ) : (
                                <span className="text-zinc-500">0 credited ({row.quantity} req)</span>
                              )}
                              {(row.reversedSlots || 0) > 0 && (
                                <span className="block text-[10px] text-rose-400">
                                  Reversed: -{row.reversedSlots} (Net: {row.netActiveSlots || 0})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span>1 profile</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-zinc-300 truncate max-w-[130px]">
                          {row.sponsor || row.payerName || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {row.status === 'pending' && (
                              <button
                                type="button"
                                disabled={verifyingRef === row.reference}
                                onClick={() => handleReverifyPendingRow(row)}
                                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-mono-tech text-[10px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${
                                    verifyingRef === row.reference ? 'animate-spin' : ''
                                  }`}
                                />
                                <span>Re-verify</span>
                              </button>
                            )}

                            {row.status !== 'voided' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidTargetRow(row);
                                  setVoidReason('');
                                  setVoidClassifyAsTest(rowEnv !== 'live');
                                  setVoidConfirmedCheck(false);
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-mono-tech text-[10px] cursor-pointer"
                              >
                                Void
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setRestoreTargetRow(row);
                                  setRestoreReason('');
                                  setRestoreConfirmedCheck(false);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] cursor-pointer"
                              >
                                Restore
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setClassifyTargetRow(row);
                                setClassifyEnv(rowEnv === 'live' ? 'live' : 'test');
                                setClassifyReason('');
                                setClassifyConfirmedCheck(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-mono-tech text-[10px] cursor-pointer"
                              title="Classify Environment (Test / Live)"
                            >
                              Env
                            </button>

                            {row.status !== 'refunded' && row.status !== 'failed' && row.status !== 'voided' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundTargetRow(row);
                                  setRefundNote(row.refundNote || '');
                                }}
                                className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-mono-tech text-[10px] cursor-pointer"
                              >
                                Refund
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
          SUB-TAB 3: OFFERS (Segmented Control: Cohorts | Programmes)
         ===================================================================== */}
      {subTab === 'slots' && (
        <div className="space-y-6">
          {/* Segmented Control: Cohorts | Programmes */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center p-1 rounded-xl bg-[#08090e] border border-white/10">
              <button
                type="button"
                onClick={() => setOffersSegment('cohorts')}
                className={`px-4 py-1.5 rounded-lg font-mono-tech text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  offersSegment === 'cohorts'
                    ? 'bg-[#d4af37] text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Cohorts
              </button>
              <button
                type="button"
                onClick={() => setOffersSegment('programmes')}
                className={`px-4 py-1.5 rounded-lg font-mono-tech text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  offersSegment === 'programmes'
                    ? 'bg-[#d4af37] text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Programmes ({programmes.length})
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono-tech text-zinc-400">
              <span>
                Standard global price:{' '}
                <strong className="text-white">{formatMoneyFromKobo(unitFeeKobo)}</strong> (automatic when no offer is assigned)
              </span>
              {offersSegment === 'programmes' && (
                <button
                  type="button"
                  onClick={openNewProgrammeModal}
                  className="px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#c5a028] text-black font-syne font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New programme</span>
                </button>
              )}
            </div>
          </div>

          {/* -----------------------------------------------------------------
              VIEW A: COHORTS
             ----------------------------------------------------------------- */}
          {offersSegment === 'cohorts' && (
            <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-4 relative">
              {/* Pickers: Institution, Year (+ Year), and Copy from previous year */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-3 border-b border-white/[0.08]">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[230px]">
                    <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                      Institution
                    </label>
                    <select
                      value={cohortInstId}
                      onChange={(e) => setCohortInstId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                    >
                      {universities.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.shortCode ? `${u.shortCode} — ${u.name}` : u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                      Cohort Graduation Year
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={cohortYear}
                        onChange={(e) => setCohortYear(Number(e.target.value))}
                        className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 font-mono-tech text-xs text-white focus:outline-none"
                      >
                        {availableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            Class of {yr}
                          </option>
                        ))}
                      </select>

                      {!isAddingYear ? (
                        <button
                          type="button"
                          onClick={() => {
                            setNewYearInput(String(cohortYear + 1));
                            setIsAddingYear(true);
                          }}
                          className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 font-mono-tech text-[11px] text-white cursor-pointer"
                        >
                          + Year
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={1980}
                            max={2100}
                            value={newYearInput}
                            onChange={(e) => setNewYearInput(e.target.value)}
                            className="w-20 px-2 py-1.5 rounded-lg bg-black border border-white/20 font-mono-tech text-xs text-white"
                            placeholder="Year"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const yr = Number(newYearInput);
                              if (Number.isInteger(yr) && yr >= 1980 && yr <= 2100) {
                                setAvailableYears((prev) =>
                                  Array.from(new Set([...prev, yr])).sort((a, b) => b - a)
                                );
                                setCohortYear(yr);
                                setIsAddingYear(false);
                              } else {
                                showError('Invalid year', 'Enter a year between 1980 and 2100.');
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#d4af37] text-black font-mono-tech text-[11px] font-bold cursor-pointer"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingYear(false)}
                            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCopyYearModalOpen(true)}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 font-mono-tech text-[11px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Copy offers from {cohortYear - 1}</span>
                  </button>
                </div>
              </div>

              {/* Four Summary Cards for Selected Year */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25">
                  <span className="font-mono-tech text-[10px] uppercase text-emerald-400 block">
                    Funding
                  </span>
                  <p className="font-syne font-bold text-lg text-emerald-300 mt-0.5">
                    {cohortYearCounts.funding}
                  </p>
                  <span className="font-body text-[11px] text-zinc-400">
                    Covered department{cohortYearCounts.funding === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/25">
                  <span className="font-mono-tech text-[10px] uppercase text-amber-400 block">
                    Discount
                  </span>
                  <p className="font-syne font-bold text-lg text-amber-300 mt-0.5">
                    {cohortYearCounts.discount}
                  </p>
                  <span className="font-body text-[11px] text-zinc-400">
                    Percentage-off department{cohortYearCounts.discount === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                  <span className="font-mono-tech text-[10px] uppercase text-zinc-400 block">
                    Standard (automatic)
                  </span>
                  <p className="font-syne font-bold text-lg text-white mt-0.5">
                    {cohortYearCounts.standard}
                  </p>
                  <span className="font-body text-[11px] text-zinc-400">
                    Pays {formatMoneyFromKobo(unitFeeKobo)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                  <span className="font-mono-tech text-[10px] uppercase text-zinc-400 block">
                    Departments
                  </span>
                  <p className="font-syne font-bold text-lg text-white mt-0.5">
                    {cohortYearCounts.total}
                  </p>
                  <span className="font-body text-[11px] text-zinc-400">
                    In {selectedCohortUni?.shortCode || selectedCohortUni?.name}
                  </span>
                </div>
              </div>

              {/* Filter Chips & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: `All (${cohortYearCounts.total})` },
                      { id: 'funding', label: `Funding (${cohortYearCounts.funding})` },
                      { id: 'discount', label: `Discount (${cohortYearCounts.discount})` },
                      { id: 'standard', label: `Standard (${cohortYearCounts.standard})` },
                    ] as const
                  ).map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setCohortFilter(chip.id)}
                      className={`px-3 py-1 rounded-full font-mono-tech text-[11px] border transition-colors cursor-pointer ${
                        cohortFilter === chip.id
                          ? 'bg-white text-black border-white font-bold'
                          : 'bg-black/40 text-zinc-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 font-mono-tech text-[10px] text-zinc-300 cursor-pointer ml-1"
                  >
                    Select all ({filteredCohortRows.length} in filtered list)
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cohortSearch}
                    onChange={(e) => setCohortSearch(e.target.value)}
                    placeholder="Search department or offer..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {lastBulkResultSummary && (
                <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                  <span className="font-mono-tech">{lastBulkResultSummary}</span>
                  <button
                    type="button"
                    onClick={() => setLastBulkResultSummary(null)}
                    className="text-emerald-300/70 hover:text-emerald-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Sticky Bulk Action Bar when rows are selected */}
              {selectedDeptIds.length > 0 && (
                <div className="sticky top-2 z-20 p-3 rounded-xl bg-[#14151a]/95 backdrop-blur-md border border-[#d4af37]/50 shadow-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/40 font-mono-tech text-xs font-bold text-[#d4af37]">
                      {selectedDeptIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-mono-tech text-[11px] text-zinc-200 cursor-pointer"
                    >
                      Select all ({filteredCohortRows.length} filtered)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeptIds([])}
                      className="text-zinc-400 hover:text-white font-mono-tech text-[11px] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={assignProgrammeId}
                      onChange={(e) => setAssignProgrammeId(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-black border border-white/15 text-xs text-white focus:outline-none"
                    >
                      <option value="">Choose active programme...</option>
                      {activeProgrammes.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.kind === 'funding' ? 'Funding' : `Discount ${p.discountPercent}%`}] {p.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isApplyingBulk || !assignProgrammeId}
                      onClick={() => handleBulkAssignOrRemove('assign')}
                      className="px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#c5a028] text-black font-syne font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                    >
                      Assign offer
                    </button>

                    <button
                      type="button"
                      disabled={isApplyingBulk}
                      onClick={() => handleBulkAssignOrRemove('remove')}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-mono-tech text-xs cursor-pointer disabled:opacity-50"
                    >
                      Remove offer
                    </button>
                  </div>
                </div>
              )}

              {/* Directory Department Rows */}
              <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-black/30 max-h-[480px] overflow-y-auto">
                {filteredCohortRows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-400">
                    No departments match the current filter.
                  </div>
                ) : (
                  filteredCohortRows.map((row) => {
                    const isChecked = selectedDeptIds.includes(row.dept.id);
                    const prog = row.programme;

                    return (
                      <div
                        key={row.dept.id}
                        onClick={() => toggleDeptSelection(row.dept.id)}
                        className={`px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isChecked ? 'bg-[#d4af37]/[0.08]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDeptSelection(row.dept.id);
                            }}
                            className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-[#d4af37]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-syne font-semibold text-xs sm:text-sm text-white truncate">
                                {row.dept.name}
                              </span>

                              {/* Small Album Status Badge */}
                              <span
                                className={`px-2 py-0.5 rounded font-mono-tech text-[9px] uppercase border ${
                                  row.albumState === 'published'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : row.albumState === 'draft'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-white/[0.03] text-zinc-500 border-white/10'
                                }`}
                              >
                                {row.albumState === 'published'
                                  ? 'Published'
                                  : row.albumState === 'draft'
                                  ? 'Draft'
                                  : 'No album'}
                              </span>
                            </div>
                            {row.dept.faculty && (
                              <p className="font-body text-[11px] text-zinc-500 truncate">
                                {row.dept.faculty}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Effective Price Colored Tag + Expiry Warning */}
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                          {row.expiresBeforeGrad && prog && (
                            <span
                              className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono-tech text-[10px] flex items-center gap-1"
                              title={`Assigned programme expires on ${prog.validTo}, before Cohort ${cohortYear} graduates`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Expires {prog.validTo} (before graduation)</span>
                            </span>
                          )}

                          {prog && prog.status === 'paused' && (
                            <span className="px-2 py-0.5 rounded bg-zinc-700/40 border border-zinc-600 text-zinc-300 font-mono-tech text-[10px]">
                              Paused (Standard {formatMoneyFromKobo(unitFeeKobo)} applies)
                            </span>
                          )}

                          {prog?.kind === 'funding' ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono-tech text-[11px] font-semibold">
                              Funding · {prog.name} (
                              {prog.coverageMode === 'all'
                                ? 'All profiles'
                                : `${prog.coverageCap} profiles`}{' '}
                              · {prog.sponsorName || 'KoHot'})
                            </span>
                          ) : prog?.kind === 'discount' ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono-tech text-[11px] font-semibold">
                              Discount {prog.discountPercent}% ·{' '}
                              {formatMoneyFromKobo(
                                Math.round(
                                  (unitFeeKobo * (100 - (Number(prog.discountPercent) || 0))) / 100
                                )
                              )}{' '}
                              <span className="line-through text-zinc-500 ml-1">
                                {formatMoneyFromKobo(unitFeeKobo)}
                              </span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-transparent border border-white/15 text-zinc-300 font-mono-tech text-[11px]">
                              Standard {formatMoneyFromKobo(unitFeeKobo)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              VIEW B: PROGRAMMES
             ----------------------------------------------------------------- */}
          {offersSegment === 'programmes' && (
            <div className="space-y-3">
              {programmes.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#08090e] border border-white/10 text-center space-y-2">
                  <p className="font-syne font-bold text-sm text-white">No programmes created yet</p>
                  <p className="font-body text-xs text-zinc-400">
                    All departments automatically pay the Standard price ({formatMoneyFromKobo(unitFeeKobo)}). Create a Funding or Discount programme to assign cohort offers.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {programmes.map((prog) => {
                    const isFunding = prog.kind === 'funding';
                    const isUnused = (Number(prog.usedCohortsCount) || 0) === 0;
                    const keyValueLabel = isFunding
                      ? prog.coverageMode === 'all'
                        ? 'Covers all profiles'
                        : `Covers ${prog.coverageCap || 0} profiles`
                      : `${prog.discountPercent}% off (${formatMoneyFromKobo(
                          Math.round((unitFeeKobo * (100 - (Number(prog.discountPercent) || 0))) / 100)
                        )})`;

                    return (
                      <div
                        key={prog.id}
                        className="p-4 rounded-xl bg-[#08090e] border border-white/10 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded font-mono-tech text-[10px] uppercase font-bold border ${
                                  isFunding
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {isFunding ? 'Funding' : 'Discount'}
                              </span>
                              <h4 className="font-syne font-bold text-sm text-white">
                                {prog.name}
                              </h4>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full font-mono-tech text-[10px] uppercase border ${
                                prog.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                  : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                              }`}
                            >
                              {prog.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-tech text-xs">
                            <span className="text-[#d4af37] font-semibold">{keyValueLabel}</span>
                            <span className="text-zinc-300">
                              Sponsor: <strong>{prog.sponsorName || 'KoHot'}</strong>
                              {prog.showRecognition ? ' (Recognised)' : ' (Hidden)'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono-tech text-zinc-400">
                            <span>
                              Valid:{' '}
                              {prog.validFrom || prog.validTo
                                ? `${prog.validFrom || 'Any'} → ${prog.validTo || 'Ongoing'}`
                                : 'Always in-date'}
                            </span>
                            <span className="text-zinc-300">
                              used by {prog.usedDepartmentsCount || 0} department
                              {prog.usedDepartmentsCount === 1 ? '' : 's'} in{' '}
                              {prog.usedCohortsCount || 0} cohort
                              {prog.usedCohortsCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() => handleToggleProgrammeStatus(prog)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-mono-tech text-[11px] text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
                          >
                            {prog.status === 'active' ? (
                              <>
                                <Pause className="w-3 h-3 text-amber-400" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 text-emerald-400" />
                                <span>Resume</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditProgrammeModal(prog)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-mono-tech text-[11px] text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3 text-[#d4af37]" />
                            <span>Edit</span>
                          </button>

                          {isUnused && (
                            <button
                              type="button"
                              onClick={() => setDeletingProgrammeTarget(prog)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 font-mono-tech text-[11px] text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Per-Album Slot Balance & Sponsors */}
          <div className="p-4 rounded-xl bg-[#08090e] border border-white/10 space-y-3">
            <div>
              <h3 className="font-syne font-bold text-sm text-white">
                Per-Album Slot Balance &amp; Sponsors ({liveSets.length})
              </h3>
              <p className="font-body text-xs text-zinc-400 mt-0.5">
                Grant free slots (reason required) or edit/remove public sponsor names. Funding coverage reuses slot_ledger grant rows so approvals and sponsor footers stay synced.
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
                Standard Price is the single global price (student_fee_kobo). A department with no offer pays Standard in every institution and every year.
              </p>
            </div>

            {/* 3 Major Pricing & Sponsorship Programs Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-2">
              <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/25">
                <span className="text-[10px] font-mono-tech uppercase text-emerald-400 font-bold">
                  Program 1 • Full Sponsorship
                </span>
                <p className="font-syne font-bold text-xs text-white mt-0.5">
                  100% Covered by Sponsor or KoHot
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  An individual alumnus, patron, or KoHot funds graduate slots so students publish free.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-[#d4af37]/30">
                <span className="text-[10px] font-mono-tech uppercase text-[#d4af37] font-bold">
                  Program 2 • Founding Class Discount
                </span>
                <p className="font-syne font-bold text-xs text-white mt-0.5">
                  {Number(defaultDiscountPercentInput) || 20}% Departmental Discount (₦
                  {Math.max(
                    0,
                    Math.round(
                      (Number(studentFeeNairaInput) || 1000) *
                        (1 - (Number(defaultDiscountPercentInput) || 20) / 100)
                    )
                  ).toLocaleString()}{' '}
                  / profile)
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Reflected dynamically on the public website pricing card for pioneer departmental sets.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                <span className="text-[10px] font-mono-tech uppercase text-sky-400 font-bold">
                  Program 3 • Standard Price
                </span>
                <p className="font-syne font-bold text-xs text-white mt-0.5">
                  ₦{(Number(studentFeeNairaInput) || 1000).toLocaleString()} per Graduate Profile
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  One-time lifetime archival contribution when no sponsorship or discount applies.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Standard Price / Student Fee (₦ NGN)
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
                  Stored as {Math.round((Number(studentFeeNairaInput) || 0) * 100)} kobo (Default: ₦1,000)
                </span>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Founding Class / Dept Discount (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={defaultDiscountPercentInput}
                  onChange={(e) => setDefaultDiscountPercentInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
                <span className="font-mono-tech text-[10px] text-[#d4af37] mt-0.5 block">
                  Founding Class pays ₦
                  {Math.max(
                    0,
                    Math.round(
                      (Number(studentFeeNairaInput) || 1000) *
                        (1 - (Number(defaultDiscountPercentInput) || 0) / 100)
                    )
                  ).toLocaleString()}{' '}
                  per profile
                </span>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Founding Discount Offer Title
                </label>
                <input
                  type="text"
                  value={foundingDiscountNameInput}
                  onChange={(e) => setFoundingDiscountNameInput(e.target.value)}
                  placeholder="Founding Class Departmental Discount"
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Founding Discount Offer Description
                </label>
                <input
                  type="text"
                  value={foundingDiscountDescInput}
                  onChange={(e) => setFoundingDiscountDescInput(e.target.value)}
                  placeholder="Special rate for the founding graduating class of a department."
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none"
                />
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
          MODAL: CREATE / EDIT PROGRAMME
         ===================================================================== */}
      {isProgrammeModalOpen && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsProgrammeModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base">
                {editingProgramme ? 'Edit Programme' : 'New Programme'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProgrammeModalOpen(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProgrammeSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Programme Kind *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProgKind('funding')}
                    className={`py-2 px-3 rounded-xl border font-mono-tech text-xs uppercase cursor-pointer ${
                      progKind === 'funding'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-black/40 border-white/10 text-zinc-400'
                    }`}
                  >
                    Funding (Free / Covered)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgKind('discount')}
                    className={`py-2 px-3 rounded-xl border font-mono-tech text-xs uppercase cursor-pointer ${
                      progKind === 'discount'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-black/40 border-white/10 text-zinc-400'
                    }`}
                  >
                    Discount (1–99% Off)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Programme Name *
                </label>
                <input
                  type="text"
                  required
                  value={progName}
                  onChange={(e) => setProgName(e.target.value)}
                  placeholder={
                    progKind === 'funding'
                      ? 'e.g. KoHot Campus Grant 150'
                      : 'e.g. Early Bird 25% Off'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                />
              </div>

              {progKind === 'discount' ? (
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                    Discount Percentage (1 to 99%) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={progDiscountPercent}
                    onChange={(e) => setProgDiscountPercent(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                  />
                  <span className="font-mono-tech text-[10px] text-zinc-400 mt-1 block">
                    Effective price:{' '}
                    {formatMoneyFromKobo(
                      Math.round(
                        (unitFeeKobo * (100 - Math.min(99, Math.max(1, Number(progDiscountPercent) || 0)))) /
                          100
                      )
                    )}{' '}
                    (Standard: {formatMoneyFromKobo(unitFeeKobo)})
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                      Coverage Limit Mode *
                    </label>
                    <select
                      value={progCoverageMode}
                      onChange={(e) => setProgCoverageMode(e.target.value as 'all' | 'per_album_cap')}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                    >
                      <option value="per_album_cap">Per-album profile cap (then Standard)</option>
                      <option value="all">Covers all profiles in album</option>
                    </select>
                  </div>

                  {progCoverageMode === 'per_album_cap' && (
                    <div>
                      <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                        Coverage Cap (Profiles per Album) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        required
                        value={progCoverageCap}
                        onChange={(e) => setProgCoverageCap(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                    Sponsor Name
                  </label>
                  <input
                    type="text"
                    value={progSponsorName}
                    onChange={(e) => setProgSponsorName(e.target.value)}
                    placeholder="KoHot"
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={progShowRecognition}
                      onChange={(e) => setProgShowRecognition(e.target.checked)}
                      className="rounded accent-[#d4af37]"
                    />
                    <span className="font-mono-tech text-[11px] text-zinc-300">
                      Show sponsor recognition
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                    Valid From (Optional)
                  </label>
                  <input
                    type="date"
                    value={progValidFrom}
                    onChange={(e) => setProgValidFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                    Valid To (Optional)
                  </label>
                  <input
                    type="date"
                    value={progValidTo}
                    onChange={(e) => setProgValidTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProgrammeModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProgramme}
                  className="px-4 py-2 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                >
                  {isSavingProgramme ? 'Saving...' : 'Save Programme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CONFIRM DELETE UNUSED PROGRAMME
         ===================================================================== */}
      {deletingProgrammeTarget && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeletingProgrammeTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <h3 className="font-syne font-bold text-base">Delete unused programme?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">{deletingProgrammeTarget.name}</strong>? This programme is not assigned to any cohort.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProgrammeTarget(null)}
                className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingProgramme}
                onClick={handleConfirmDeleteProgramme}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-syne font-bold text-xs uppercase cursor-pointer"
              >
                Delete Programme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CONFIRM COPY OFFERS FROM PREVIOUS YEAR
         ===================================================================== */}
      {isCopyYearModalOpen && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCopyYearModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <h3 className="font-syne font-bold text-base">
              Copy offers from {cohortYear - 1} to {cohortYear}?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This will copy all assigned department offers for{' '}
              <strong className="text-white">
                {selectedCohortUni?.shortCode || selectedCohortUni?.name}
              </strong>{' '}
              from Class of <strong className="text-white">{cohortYear - 1}</strong> into Class of{' '}
              <strong className="text-white">{cohortYear}</strong>. Departments without an offer remain on Standard price.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCopyYearModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCopyingYear}
                onClick={handleConfirmCopyFromPreviousYear}
                className="px-4 py-2 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                {isCopyingYear ? 'Copying...' : `Confirm Copy to ${cohortYear}`}
              </button>
            </div>
          </div>
        </div>
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

      {/* =====================================================================
          MODAL: VOID TRANSACTION & COMPENSATING SLOT REVERSAL
         ===================================================================== */}
      {voidTargetRow && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setVoidTargetRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-amber-500/30 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base text-amber-300">Void Transaction</h3>
              <button
                type="button"
                onClick={() => setVoidTargetRow(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmVoidTransaction} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <p className="text-zinc-300">
                  Reference: <strong className="text-white font-mono-tech">{voidTargetRow.reference}</strong>
                </p>
                <p className="text-zinc-300">
                  Amount (preserved): <strong className="text-white">{formatMoneyFromKobo(voidTargetRow.amountKobo)}</strong> • Current Status:{' '}
                  <strong className="text-white uppercase">{voidTargetRow.status}</strong>
                </p>
                <p className="text-zinc-300">
                  Cohort: <strong className="text-white">{voidTargetRow.institutionName} — {voidTargetRow.departmentName} ({voidTargetRow.classYear})</strong>
                </p>
                {voidTargetRow.type === 'slot_purchase' && (
                  <p className="text-amber-300 font-mono-tech text-[11px] pt-1">
                    {voidTargetRow.netActiveSlots && voidTargetRow.netActiveSlots > 0
                      ? `Reconciles slots: will insert a compensating void_reversal entry (-${voidTargetRow.netActiveSlots} slots) in slot_ledger. Blocked automatically if those slots are already consumed.`
                      : 'No active credited slots found in slot_ledger for this reference (0 slots will be deducted).'}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Mandatory Void Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Erroneous Paystack test transaction — voiding before live launch"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={voidClassifyAsTest}
                  onChange={(e) => setVoidClassifyAsTest(e.target.checked)}
                  className="rounded accent-amber-400"
                />
                <span className="text-zinc-300">
                  Also classify transaction environment as <strong className="text-amber-300">TEST</strong>
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer select-none p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <input
                  type="checkbox"
                  checked={voidConfirmedCheck}
                  onChange={(e) => setVoidConfirmedCheck(e.target.checked)}
                  className="mt-0.5 rounded accent-amber-400"
                />
                <span className="text-[11px] text-amber-200 leading-relaxed">
                  I confirm voiding this transaction. Original transaction ID, reference, and amount remain preserved in financial audit history.
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidTargetRow(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoid || !voidConfirmedCheck || voidReason.trim().length < 3}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-syne font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingVoid ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: RESTORE VOIDED TRANSACTION
         ===================================================================== */}
      {restoreTargetRow && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRestoreTargetRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-emerald-500/30 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base text-emerald-300">Restore Voided Transaction</h3>
              <button
                type="button"
                onClick={() => setRestoreTargetRow(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRestoreTransaction} className="space-y-3 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                Restoring <strong className="text-white font-mono-tech">{restoreTargetRow.reference}</strong> (
                {formatMoneyFromKobo(restoreTargetRow.amountKobo)}) to its previous status (
                <strong className="text-white">{restoreTargetRow.previousStatus || 'Paid'}</strong>).
                {(restoreTargetRow.reversedSlots || 0) > 0 && (
                  <span className="block text-emerald-300 mt-1">
                    Will also insert a compensating <code className="font-mono-tech">void_restore</code> entry (+
                    {restoreTargetRow.reversedSlots} slots) into <code className="font-mono-tech">slot_ledger</code>.
                  </span>
                )}
              </p>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Mandatory Restoration Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="e.g. Voided in error — verified payment should remain active"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer select-none p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <input
                  type="checkbox"
                  checked={restoreConfirmedCheck}
                  onChange={(e) => setRestoreConfirmedCheck(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-400"
                />
                <span className="text-[11px] text-emerald-200 leading-relaxed">
                  I confirm restoring this voided transaction and any reversed slot credits.
                </span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreTargetRow(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRestore || !restoreConfirmedCheck || restoreReason.trim().length < 3}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-syne font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingRestore ? 'Restoring...' : 'Confirm Restore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CLASSIFY TRANSACTION ENVIRONMENT (TEST / LIVE / LEGACY)
         ===================================================================== */}
      {classifyTargetRow && (
        <div
          className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setClassifyTargetRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#14151a] border border-white/15 p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-syne font-bold text-base">Classify Transaction Environment</h3>
              <button
                type="button"
                onClick={() => setClassifyTargetRow(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmClassifyEnvironment} className="space-y-3 text-xs">
              <p className="text-zinc-400">
                Reference <strong className="text-white font-mono-tech">{classifyTargetRow.reference}</strong> (
                {formatMoneyFromKobo(classifyTargetRow.amountKobo)}) is currently marked as{' '}
                <strong className="text-white uppercase">{classifyTargetRow.environment || 'legacy'}</strong>.
              </p>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Target Environment *
                </label>
                <select
                  value={classifyEnv}
                  onChange={(e) => setClassifyEnv(e.target.value as TransactionEnvironment)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                >
                  <option value="test">TEST (Excluded from live commercial revenue)</option>
                  <option value="live">LIVE (Requires independent live Paystack verification)</option>
                  <option value="legacy">LEGACY / UNCLASSIFIED (Excluded from live revenue)</option>
                </select>
                {classifyEnv === 'live' && (
                  <p className="mt-1.5 text-[11px] text-amber-300 font-mono-tech leading-relaxed">
                    Security Guard: Classifying a transaction as LIVE requires server-side verification of this reference against the live Paystack API. Test or unverified references will be rejected.
                  </p>
                )}
              </div>
              <div>
                <label className="block font-mono-tech text-[10px] uppercase text-zinc-400 mb-1">
                  Classification Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={classifyReason}
                  onChange={(e) => setClassifyReason(e.target.value)}
                  placeholder="e.g. Verified against Paystack dashboard as a test-mode transaction"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none"
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer select-none p-2.5 rounded-xl bg-white/5 border border-white/10">
                <input
                  type="checkbox"
                  checked={classifyConfirmedCheck}
                  onChange={(e) => setClassifyConfirmedCheck(e.target.checked)}
                  className="mt-0.5 rounded accent-[#d4af37]"
                />
                <span className="text-[11px] text-zinc-300 leading-relaxed">
                  I confirm updating the environment classification for this transaction and its linked slot records.
                </span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClassifyTargetRow(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-zinc-300 font-mono-tech text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClassify || !classifyConfirmedCheck || classifyReason.trim().length < 3}
                  className="px-4 py-2 rounded-xl bg-[#d4af37] text-black font-syne font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingClassify ? 'Saving...' : 'Save Classification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
