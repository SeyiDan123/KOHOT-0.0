import { EmailEventType, EmailLog, EmailTemplate, ClassSet } from '../types';
import { getAppBaseUrl } from './urlHelper';

// =========================================================================
// 1. EXACTLY THREE AUTOMATED PRODUCT EMAILS:
//    - Class Album Approved (sent to the approved class administrator)
//    - Class Album Is Live (sent to registered/published class members on publication)
//    - Annual Legacy Reminder (sent annually to registered graduates/class members)
//
// 2. EXACTLY TWO OWNER GMAIL ROUTINE APPROVAL/EXCEPTION ALERTS:
//    - New Class Album / Admin Approval Request
//    - Administration Takeover / Review Request
// =========================================================================

export const KOHOT_DEFAULT_TEMPLATES: Record<EmailEventType, EmailTemplate> = {
  // --- PRODUCT AUTOMATED EMAIL 1: Class Album Approved ---
  album_registration_approved: {
    id: 'album_registration_approved',
    name: 'Class Album Approved',
    description: 'Sent to the approved class administrator when their cohort is officially verified and approved.',
    subjectTemplate: 'Class Album Approved — {departmentName} (Class of {graduationYear})',
    bodyTemplate: `Dear {recipientName},

Congratulations! Your Class Album registration for {departmentName} (Class of {graduationYear}) at {institutionName} has been officially approved.

Your cohort’s digital Class Album workspace is now live and ready to collect classmate profiles, memories, and senior leadership quotes.

Open your Class Album Admin Workspace:
{adminPortalUrl}

Shareable Classmate Submission Link:
{submissionInviteUrl}

Best regards,
KoHot Archival Operations`,
    availableVariables: ['{recipientName}', '{departmentName}', '{graduationYear}', '{institutionName}', '{adminPortalUrl}', '{submissionInviteUrl}'],
  },

  // --- PRODUCT AUTOMATED EMAIL 2: Class Album Is Live ---
  class_album_is_live: {
    id: 'class_album_is_live',
    name: 'Class Album Is Live',
    description: 'Sent to relevant registered/published class members when the Class Album Admin completes the 3 publication steps.',
    subjectTemplate: 'Your Class Album is Now Live — {departmentName} (Class of {graduationYear})',
    bodyTemplate: `Congratulations {recipientName},

The official digital Class Album for {departmentName} (Class of {graduationYear}) at {institutionName} has been officially published and is permanently live!

Explore your class album:
{albumUrl}

You can now view your peers' portraits, read senior quotes, and relive all the memorable moments of your university journey for decades to come.

Preserved for generations,
KoHot Permanent Archive`,
    availableVariables: ['{recipientName}', '{departmentName}', '{graduationYear}', '{institutionName}', '{albumUrl}'],
  },

  // --- PRODUCT AUTOMATED EMAIL 3: Annual Legacy Reminder ---
  annual_legacy_reminder: {
    id: 'annual_legacy_reminder',
    name: 'Annual Legacy Reminder',
    description: 'Sent annually to relevant registered graduates/class members on the anniversary of their graduation/convocation.',
    subjectTemplate: 'Relive Your Cohort Legacy — Class of {graduationYear} Anniversary',
    bodyTemplate: `Hello {recipientName},

Another year has passed since your graduation from {departmentName}, {institutionName}!

Today is a milestone moment to pause, remember the journey you shared with your classmates, and revisit the memories that defined your university tenure.

Step back into your permanent digital album:
{albumUrl}

Campus Legacy Plaque:
{legacyPlaqueDetails}

Always your home,
KoHot Legacy Reconnect Service

Notification Preferences:
You receive this annual milestone reminder as a verified member of the Class of {graduationYear}.
Manage reminder preferences or unsubscribe: {unsubscribeUrl}`,
    availableVariables: ['{recipientName}', '{departmentName}', '{graduationYear}', '{institutionName}', '{albumUrl}', '{legacyPlaqueDetails}', '{unsubscribeUrl}'],
  },

  // --- OWNER GMAIL ROUTINE ALERT 1: New Class Album / Admin Approval Request ---
  owner_new_album_approval_alert: {
    id: 'owner_new_album_approval_alert',
    name: 'Owner Alert: New Class Album / Admin Approval Request',
    description: 'Alert sent to the KoHot Owner Gmail when a new cohort registration / founding request requires review.',
    subjectTemplate: '[KoHot Action Required] New Class Album Request: {departmentName} ({graduationYear}) - {institutionName}',
    bodyTemplate: `KoHot Archival Operations Alert:

A new Class Album & Administration request has been submitted and is awaiting your review.

Applicant Details:
• Representative: {applicantName} ({applicantEmail}, {applicantPhone})
• Role: {applicantRole}
• Department: {departmentName}
• Graduation Year: Class of {graduationYear}
• Institution: {institutionName}
• Estimated Cohort Size: {estimatedClassSize} graduates
• Submitted At: {submissionDate}

Direct Owner Dashboard Review Link:
{ownerReviewActionUrl}

Review the application to grant administrative access.`,
    availableVariables: ['{applicantName}', '{applicantEmail}', '{applicantPhone}', '{applicantRole}', '{departmentName}', '{graduationYear}', '{institutionName}', '{estimatedClassSize}', '{submissionDate}', '{ownerReviewActionUrl}'],
  },

  // --- OWNER GMAIL ROUTINE ALERT 2: Album Admin Help / Review Request ---
  owner_admin_takeover_review_alert: {
    id: 'owner_admin_takeover_review_alert',
    name: 'Owner Alert: Album Admin Help / Review Request',
    description: 'Alert sent to the KoHot Owner Gmail when an exceptional Album Admin Help request is submitted.',
    subjectTemplate: '[KoHot Support] Album Admin Help Request: {departmentName} ({graduationYear})',
    bodyTemplate: `KoHot Album Administration Support Alert:

An exceptional Album Admin Help request has been submitted for a Class Album.

Request Details:
• Cohort: {departmentName} (Class of {graduationYear})
• Institution: {institutionName}
• Requester Name: {claimantName} ({claimantEmail}, {claimantPhone})
• Reason: "{claimReason}"
• Current Class Admin: {currentAdminName} ({currentAdminEmail})
• Submitted At: {submittedAt}

Direct Owner Dashboard Review:
{ownerTakeoverActionUrl}

Review administration history and communicate with the requester as appropriate.`,
    availableVariables: ['{departmentName}', '{graduationYear}', '{institutionName}', '{claimantName}', '{claimantEmail}', '{claimantPhone}', '{claimantRole}', '{claimReason}', '{currentAdminName}', '{currentAdminEmail}', '{submittedAt}', '{ownerTakeoverActionUrl}'],
  },

  // Backwards compatibility / legacy mapping
  album_registration_received: {
    id: 'album_registration_received',
    name: 'Class Album Registration Received',
    description: 'Archival acknowledgment record.',
    subjectTemplate: 'Registration Received — {departmentName} Class Album',
    bodyTemplate: `Dear {recipientName},\n\nWe have received your registration for {departmentName} (Class of {graduationYear}). Review in progress.\n\nKoHot Operations`,
    availableVariables: ['{recipientName}', '{departmentName}', '{graduationYear}'],
  },
  owner_manual_whatsapp_followup: {
    id: 'owner_manual_whatsapp_followup',
    name: 'New admin Follow-up Message',
    description: 'Personalized outreach template for the Owner to follow up with nominated incoming class representatives and next set administrators via WhatsApp or SMS under Next-Class Handoffs.',
    subjectTemplate: 'WhatsApp Follow-up: {departmentName} ({targetClassYear})',
    bodyTemplate: `Hello {targetContactName}, this is KoHot Archival Operations following up on the Class of {targetClassYear} baton handoff for {departmentName} at {institutionName}. The graduating Class of {fromClassYear} nominated you as the incoming representative to create your cohort's permanent digital Class Album. Explore the department legacy and start here: {inviteLink}`,
    availableVariables: ['{targetContactName}', '{targetClassYear}', '{departmentName}', '{institutionName}', '{fromClassYear}', '{inviteLink}'],
  },
  admin_next_class_invitation: {
    id: 'admin_next_class_invitation',
    name: 'Next Class Handoff Invitation Message',
    description: 'Personalized invitation sent directly by the current Class Administrator to the immediate next class representative.',
    subjectTemplate: 'Pass the Legacy Forward — Class of {targetClassYear}',
    bodyTemplate: `Hello {targetContactName}! The graduating class of {fromClassYear} ({departmentName}) has preserved our legacy on KoHot and officially passed the department baton to your set (Class of {targetClassYear}). Explore our legacy and start your class album here: {inviteLink}`,
    availableVariables: ['{targetContactName}', '{fromClassYear}', '{departmentName}', '{targetClassYear}', '{inviteLink}'],
  },
  admin_invite_other_departments: {
    id: 'admin_invite_other_departments',
    name: 'Invite Other Departments Message',
    description: 'Invitation sent by a graduating class representative to counterparts in other departments to preserve their cohort album.',
    subjectTemplate: 'Preserve Your Graduating Class Album — {targetDepartment}',
    bodyTemplate: `Hello {targetContactName}! I'm {repName}, Class Representative for {fromDepartmentName} (Class of {fromClassYear}). We recently preserved our graduating class memories on KoHot. Your graduating class in {targetDepartment} deserves to have its students, portraits, and milestones permanently preserved too! You can start and build your official department class album here: {inviteLink}`,
    availableVariables: ['{targetContactName}', '{repName}', '{fromDepartmentName}', '{fromClassYear}', '{targetDepartment}', '{inviteLink}'],
  },
};

// =========================================================================
// STORAGE KEYS & CACHE
// =========================================================================
const EMAIL_LOGS_STORAGE_KEY = 'kohot_communications_audit_logs_v3';
const EMAIL_TEMPLATES_STORAGE_KEY = 'kohot_communications_templates_v3';

export function getStoredEmailTemplates(): Record<EmailEventType, EmailTemplate> {
  if (typeof window === 'undefined') return KOHOT_DEFAULT_TEMPLATES;
  try {
    const raw = localStorage.getItem(EMAIL_TEMPLATES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const merged = { ...KOHOT_DEFAULT_TEMPLATES, ...parsed };
    const sanitized: Record<string, EmailTemplate> = {};
    Object.entries(merged).forEach(([k, val]) => {
      const t = val as EmailTemplate;
      if (t && typeof t === 'object') {
        sanitized[k] = {
          ...t,
          name: t.name ? t.name.replace(/\s+Template$/i, ' Message') : t.name,
        };
      }
    });
    return sanitized as Record<EmailEventType, EmailTemplate>;
  } catch (err) {
    console.error('Failed reading email templates:', err);
    return KOHOT_DEFAULT_TEMPLATES;
  }
}

export function saveStoredEmailTemplates(templates: Record<EmailEventType, EmailTemplate>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EMAIL_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Failed saving email templates:', err);
  }
}

export function interpolateTemplate(
  templateText: string,
  variables: Record<string, string | number | undefined>
): string {
  let result = templateText;
  Object.entries(variables).forEach(([key, val]) => {
    const safeVal = val !== undefined && val !== null ? String(val) : '';
    const regex = new RegExp(`\\{${key.replace(/[{}]/g, '')}\\}`, 'g');
    result = result.replace(regex, safeVal);
  });
  return result;
}

export function getStoredEmailLogs(): EmailLog[] {
  if (typeof window === 'undefined') return getInitialSeedEmailLogs();
  try {
    const raw = localStorage.getItem(EMAIL_LOGS_STORAGE_KEY);
    if (!raw) {
      const initial = getInitialSeedEmailLogs();
      saveStoredEmailLogs(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getInitialSeedEmailLogs();
  } catch (err) {
    console.error('Failed reading email logs:', err);
    return getInitialSeedEmailLogs();
  }
}

export function saveStoredEmailLogs(logs: EmailLog[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EMAIL_LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed saving email logs:', err);
  }
}

// =========================================================================
// DISPATCH ENGINE: AUTOMATED EMAILS
// =========================================================================
export function logAndDispatchEmail(params: {
  event: EmailEventType;
  recipientEmail: string;
  recipientName: string;
  variables: Record<string, string | number | undefined>;
  category?: 'automated_product_email' | 'owner_routine_alert' | 'manual_operational';
  metadata?: EmailLog['metadata'];
}): EmailLog {
  const templates = getStoredEmailTemplates();
  const template = templates[params.event] || KOHOT_DEFAULT_TEMPLATES[params.event];

  const subject = interpolateTemplate(template?.subjectTemplate || 'KoHot Notification', params.variables);
  const body = interpolateTemplate(template?.bodyTemplate || '', params.variables);

  // Determine category automatically if not supplied
  const category = params.category || (
    params.event.startsWith('owner_') ? 'owner_routine_alert' : 'automated_product_email'
  );

  const newLog: EmailLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    recipientEmail: params.recipientEmail,
    recipientName: params.recipientName,
    subject,
    body,
    event: params.event,
    status: 'sent',
    category,
    channel: 'email',
    metadata: params.metadata,
  };

  const currentLogs = getStoredEmailLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveStoredEmailLogs(updatedLogs);

  console.log(`[KoHot Communications] Dispatched email [${category}]: "${subject}" to ${params.recipientEmail}`);

  return newLog;
}

// =========================================================================
// DISPATCH ENGINE: MANUAL OPERATIONAL COMMUNICATIONS (WHATSAPP, SMS, ETC.)
// =========================================================================
export function logManualCommunication(params: {
  channel: 'whatsapp' | 'sms' | 'telegram' | 'native_share';
  recipientContact: string; // phone or identifier
  recipientName: string;
  event: EmailEventType | string;
  subjectOrSummary: string;
  bodySnippet: string;
  metadata?: EmailLog['metadata'];
}): EmailLog {
  const newLog: EmailLog = {
    id: `man-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    recipientEmail: params.recipientContact, // phone/contact stored here
    recipientName: params.recipientName,
    subject: `[${params.channel.toUpperCase()}] ${params.subjectOrSummary}`,
    body: params.bodySnippet,
    event: params.event as EmailEventType,
    status: 'sent',
    category: 'manual_operational',
    channel: params.channel,
    metadata: {
      ...params.metadata,
      targetPhone: params.recipientContact,
    },
  };

  const currentLogs = getStoredEmailLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveStoredEmailLogs(updatedLogs);

  console.log(`[KoHot Manual Communications] Logged [${params.channel}]: to ${params.recipientName} (${params.recipientContact})`);
  return newLog;
}

// =========================================================================
// WORKFLOW TRIGGERS
// =========================================================================

/**
 * Triggered on Album Publication:
 * Sends the automated "Class Album Is Live" email to registered graduates of the cohort.
 */
export function triggerClassAlbumIsLiveCommunication(set: ClassSet): EmailLog[] {
  const liveUrl = `${getAppBaseUrl()}/#album-${set.id}`;
  const logs: EmailLog[] = [];

  // 1. Send to the Class Administrator
  if (set.classRepEmail) {
    const adminLog = logAndDispatchEmail({
      event: 'class_album_is_live',
      recipientEmail: set.classRepEmail,
      recipientName: set.classRepName || 'Class Administrator',
      category: 'automated_product_email',
      variables: {
        recipientName: set.classRepName || 'Class Administrator',
        departmentName: set.departmentName,
        graduationYear: set.graduationYear,
        institutionName: set.institutionName,
        albumUrl: liveUrl,
      },
      metadata: {
        setId: set.id,
        departmentName: set.departmentName,
        graduationYear: set.graduationYear,
        albumUrl: liveUrl,
      },
    });
    logs.push(adminLog);
  }

  // 2. Send to verified student profiles that have emails
  const verifiedStudents = (set.students || []).filter((s) => s.approved !== false && s.email && s.email.includes('@'));
  verifiedStudents.slice(0, 8).forEach((st) => {
    const studentLog = logAndDispatchEmail({
      event: 'class_album_is_live',
      recipientEmail: st.email!,
      recipientName: st.fullName,
      category: 'automated_product_email',
      variables: {
        recipientName: st.fullName,
        departmentName: set.departmentName,
        graduationYear: set.graduationYear,
        institutionName: set.institutionName,
        albumUrl: liveUrl,
      },
      metadata: {
        setId: set.id,
        departmentName: set.departmentName,
        graduationYear: set.graduationYear,
        studentId: st.id,
        albumUrl: liveUrl,
      },
    });
    logs.push(studentLog);
  });

  return logs;
}

/**
 * Triggered when a new Class Album / Admin Request is submitted:
 * Alerts KoHot Owner Gmail with a direct review link.
 */
export function triggerOwnerNewAlbumApprovalAlert(params: {
  requestId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantRole: string;
  departmentName: string;
  graduationYear: number;
  institutionName: string;
  estimatedClassSize: number;
}): EmailLog {
  const ownerReviewActionUrl = `${getAppBaseUrl()}/#owner-review?tab=founding_requests&request_id=${params.requestId}`;

  return logAndDispatchEmail({
    event: 'owner_new_album_approval_alert',
    recipientEmail: 'owner@kohot.live',
    recipientName: 'KoHot Master Host',
    category: 'owner_routine_alert',
    variables: {
      applicantName: params.applicantName,
      applicantEmail: params.applicantEmail,
      applicantPhone: params.applicantPhone,
      applicantRole: params.applicantRole,
      departmentName: params.departmentName,
      graduationYear: params.graduationYear,
      institutionName: params.institutionName,
      estimatedClassSize: params.estimatedClassSize,
      submissionDate: new Date().toLocaleDateString(),
      ownerReviewActionUrl,
    },
    metadata: {
      actionLink: ownerReviewActionUrl,
      departmentName: params.departmentName,
      graduationYear: params.graduationYear,
    },
  });
}

/**
 * Triggered when an Administration Takeover / Dispute Claim is filed:
 * Alerts KoHot Owner Gmail with a direct arbitration link.
 */
export function triggerOwnerAdminTakeoverReviewAlert(params: {
  disputeId: string;
  departmentName: string;
  graduationYear: number;
  institutionName: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  claimantRole: string;
  claimReason: string;
  currentAdminName: string;
  currentAdminEmail: string;
}): EmailLog {
  const ownerTakeoverActionUrl = `${getAppBaseUrl()}/#owner-review?tab=disputes&dispute_id=${params.disputeId}`;

  return logAndDispatchEmail({
    event: 'owner_admin_takeover_review_alert',
    recipientEmail: 'owner@kohot.live',
    recipientName: 'KoHot Master Host',
    category: 'owner_routine_alert',
    variables: {
      departmentName: params.departmentName,
      graduationYear: params.graduationYear,
      institutionName: params.institutionName,
      claimantName: params.claimantName,
      claimantEmail: params.claimantEmail,
      claimantPhone: params.claimantPhone,
      claimantRole: params.claimantRole,
      claimReason: params.claimReason,
      currentAdminName: params.currentAdminName,
      currentAdminEmail: params.currentAdminEmail,
      submittedAt: new Date().toLocaleString(),
      ownerTakeoverActionUrl,
    },
    metadata: {
      actionLink: ownerTakeoverActionUrl,
      departmentName: params.departmentName,
      graduationYear: params.graduationYear,
    },
  });
}

// =========================================================================
// CSV EXPORT FOR AUDIT LOGS
// =========================================================================
export function exportEmailLogsToCsv(logs: EmailLog[]): void {
  const headers = ['Timestamp', 'Channel', 'Category', 'Recipient Name', 'Recipient Contact', 'Event', 'Status', 'Subject', 'Body Snippet'];
  const rows = logs.map((log) => [
    new Date(log.timestamp).toLocaleString(),
    log.channel || 'email',
    log.category || 'automated_product_email',
    `"${log.recipientName.replace(/"/g, '""')}"`,
    `"${log.recipientEmail.replace(/"/g, '""')}"`,
    log.event,
    log.status,
    `"${log.subject.replace(/"/g, '""')}"`,
    `"${log.body.slice(0, 140).replace(/"/g, '""').replace(/\n/g, ' ')}..."`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `kohot-communications-audit-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =========================================================================
// SEED AUDIT LOGS FOR DEMO
// =========================================================================
function getInitialSeedEmailLogs(): EmailLog[] {
  const now = Date.now();
  return [
    {
      id: 'log-seed-1',
      timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
      recipientEmail: 'adewale.f@alumni.unilag.edu.ng',
      recipientName: 'Adewale Fakorede',
      subject: 'Your Class Album is Now Live — Computer Sciences (Class of 2026)',
      body: `Congratulations Adewale Fakorede,\n\nThe official digital Class Album for Computer Sciences (Class of 2026) at University of Lagos is now published and permanently live!\n\nOpen your live Class Album:\nhttps://kohot.live/#album-unilag-cs-2026\n\nPreserved for generations,\nKoHot Permanent Archive`,
      event: 'class_album_is_live',
      category: 'automated_product_email',
      channel: 'email',
      status: 'sent',
      metadata: {
        setId: 'unilag-cs-2026',
        departmentName: 'Computer Sciences',
        graduationYear: 2026,
      },
    },
    {
      id: 'log-seed-2',
      timestamp: new Date(now - 1000 * 60 * 180).toISOString(),
      recipientEmail: 'rep.cs26@unilag.edu.ng',
      recipientName: 'Oluwaseun Danladi',
      subject: 'Class Album Approved — Computer Sciences (Class of 2026)',
      body: `Dear Oluwaseun Danladi,\n\nYour registration for Computer Sciences (Class of 2026) has been approved! Your Class Album Admin portal is ready.\n\nPreserved forever,\nKoHot Archival Operations`,
      event: 'album_registration_approved',
      category: 'automated_product_email',
      channel: 'email',
      status: 'sent',
      metadata: {
        setId: 'unilag-cs-2026',
        departmentName: 'Computer Sciences',
        graduationYear: 2026,
      },
    },
    {
      id: 'log-seed-3',
      timestamp: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      recipientEmail: 'alumni.cs24@unilag.edu.ng',
      recipientName: 'Class of 2024 Alumni Cohort',
      subject: 'Relive Your Cohort Legacy — Class of 2024 Anniversary',
      body: `Hello Class of 2024 Alumni,\n\nAnother year has passed since your graduation from Computer Sciences, University of Lagos! Today is a milestone moment to pause, remember the journey you shared with your classmates, and revisit the memories that defined your university tenure.\n\nhttps://kohot.live/#album-unilag-cs-2024\n\nCampus Legacy Plaque: Faculty of Science Foyer, North Wing\n\nKoHot Legacy Reconnect Service`,
      event: 'annual_legacy_reminder',
      category: 'automated_product_email',
      channel: 'email',
      status: 'sent',
      metadata: {
        setId: 'unilag-cs-2024',
        departmentName: 'Computer Sciences',
        graduationYear: 2024,
      },
    },
    {
      id: 'log-seed-4',
      timestamp: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
      recipientEmail: 'owner@kohot.live',
      recipientName: 'KoHot Master Host',
      subject: '[KoHot Action Required] New Class Album Request: Economics (2026) - Covenant University',
      body: `KoHot Archival Operations Alert:\n\nA new Class Album & Administration request has been submitted for Economics (Class of 2026) at Covenant University.\nRepresentative: Blessing Adeyemi\n\nDirect review link:\nhttps://kohot.live/#owner-review?tab=founding_requests&request_id=found-102`,
      event: 'owner_new_album_approval_alert',
      category: 'owner_routine_alert',
      channel: 'email',
      status: 'sent',
      metadata: {
        departmentName: 'Economics',
        graduationYear: 2026,
        actionLink: 'https://kohot.live/#owner-review?tab=founding_requests&request_id=found-102',
      },
    },
    {
      id: 'log-seed-5',
      timestamp: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
      recipientEmail: '+234 809 333 4455',
      recipientName: 'Chidinma Okafor',
      subject: '[WHATSAPP] Manual Follow-up: Computer Science (2027)',
      body: `Hello Chidinma, this is KoHot Archival Operations following up on the Class of 2027 baton handoff for Computer Science at University of Lagos. The graduating Class of 2026 nominated you as the incoming representative...`,
      event: 'owner_manual_whatsapp_followup',
      category: 'manual_operational',
      channel: 'whatsapp',
      status: 'sent',
      metadata: {
        departmentName: 'Computer Science',
        graduationYear: 2026,
        nextClassYear: 2027,
        targetPhone: '+234 809 333 4455',
        initiatedBy: 'KoHot Master Host',
      },
    },
  ];
}
