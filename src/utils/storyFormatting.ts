import { ClassSet, StudentProfile } from '../types';
import { isLeaderProfile, calculateIntuitiveHierarchyRank } from './leadershipHierarchy';

export interface StoryBlock {
  type: 'heading' | 'paragraph' | 'boldClosing';
  content: string;
}

/**
 * Detects generic boilerplate in `ourStory` so it is never displayed on album cards
 * or as a custom "About this class" summary.
 */
export function isBoilerplateOurStory(text?: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();

  const boilerplatePrefixes = [
    'preserving the heritage of ',
    'as the verified founding class of ',
    'permanent digital archive',
    'official permanent digital archive for ',
    'permanent digital class album capturing',
    'explore portraits, memories, awards',
    'we arrived at crownfield university with boundless optimism',
    'the phoenix set rose through unprecedented challenges',
    'the frontiers charted unexplored territory',
    'apex stands as the culmination of half a decade',
  ];

  return boilerplatePrefixes.some((prefix) => lower.startsWith(prefix));
}

/**
 * Returns the cleaned custom class summary if one exists and is not boilerplate.
 */
export function getCleanClassSummary(ourStory?: string): string {
  if (!ourStory || isBoilerplateOurStory(ourStory)) return '';
  return ourStory.trim();
}

/**
 * Cleans WhatsApp markup when text is pasted into "My story / parting words":
 * - A line wrapped in single asterisks (*Heading*) becomes a heading line (stored as `*Heading*` on its own line so it renders as a heading).
 * - Removes stray * and _ markers around words inside paragraphs.
 * - Keeps paragraph breaks and a closing paragraph wrapped in **...** as bold.
 * - Preserves the author's wording otherwise.
 */
export function cleanWhatsAppStoryText(raw: string): string {
  if (!raw) return '';

  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rawParagraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const cleanedParagraphs = rawParagraphs.map((para, pIndex) => {
    const isLastParagraph = pIndex === rawParagraphs.length - 1;

    if (
      isLastParagraph &&
      para.startsWith('**') &&
      para.endsWith('**') &&
      para.length > 4
    ) {
      const inner = para.slice(2, -2).trim();
      const cleanedInner = stripStrayInlineMarkers(inner);
      return `**${cleanedInner}**`;
    }

    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    const processedLines = lines.map((line, lIndex) => {
      const isLastLineOverall = isLastParagraph && lIndex === lines.length - 1;

      if (
        isLastLineOverall &&
        line.startsWith('**') &&
        line.endsWith('**') &&
        line.length > 4
      ) {
        const inner = line.slice(2, -2).trim();
        return `**${stripStrayInlineMarkers(inner)}**`;
      }

      if (/^(\*)([^*]+)(\*)$/.test(line) && !line.startsWith('**')) {
        const headingInner = line.slice(1, -1).trim();
        return `*${stripStrayInlineMarkers(headingInner)}*`;
      }

      if (/^#{1,3}\s+/.test(line)) {
        const headingInner = line.replace(/^#{1,3}\s+/, '').trim();
        return `*${stripStrayInlineMarkers(headingInner)}*`;
      }

      return stripStrayInlineMarkers(line);
    });

    return processedLines.join('\n');
  });

  return cleanedParagraphs.join('\n\n').slice(0, 10000);
}

function stripStrayInlineMarkers(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|\s)_([^_\n]+)_($|\s|[.,!?;:'")\]])/g, '$1$2$3')
    .replace(/(^|\s)[*_]+(?=\S)/g, '$1')
    .replace(/(?<=\S)[*_]+($|\s|[.,!?;:'")\]])/g, '$1');
}

/**
 * Parses a story string into structured blocks (headings, paragraphs, bold closing paragraph).
 */
export function parseStoryBlocks(text?: string): StoryBlock[] {
  if (!text || !text.trim()) return [];

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const rawParagraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: StoryBlock[] = [];

  rawParagraphs.forEach((para, pIndex) => {
    const isLastParagraph = pIndex === rawParagraphs.length - 1;

    if (
      isLastParagraph &&
      para.startsWith('**') &&
      para.endsWith('**') &&
      para.length > 4 &&
      !para.slice(2, -2).includes('\n')
    ) {
      blocks.push({
        type: 'boldClosing',
        content: para.slice(2, -2).trim(),
      });
      return;
    }

    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    let currentParagraphLines: string[] = [];

    const flushParagraph = () => {
      if (currentParagraphLines.length > 0) {
        blocks.push({
          type: 'paragraph',
          content: currentParagraphLines.join(' '),
        });
        currentParagraphLines = [];
      }
    };

    lines.forEach((line, lIndex) => {
      const isLastLineOverall = isLastParagraph && lIndex === lines.length - 1;

      if (
        isLastLineOverall &&
        line.startsWith('**') &&
        line.endsWith('**') &&
        line.length > 4
      ) {
        flushParagraph();
        blocks.push({
          type: 'boldClosing',
          content: line.slice(2, -2).trim(),
        });
        return;
      }

      if (/^\*([^*]+)\*$/.test(line)) {
        flushParagraph();
        blocks.push({
          type: 'heading',
          content: line.slice(1, -1).trim(),
        });
        return;
      }

      if (/^#{1,3}\s+/.test(line)) {
        flushParagraph();
        blocks.push({
          type: 'heading',
          content: line.replace(/^#{1,3}\s+/, '').trim(),
        });
        return;
      }

      currentParagraphLines.push(line);
    });

    flushParagraph();
  });

  return blocks;
}

/**
 * Converts story text to plain readable words for word counting and preview slicing.
 */
export function getPlainStoryWords(text?: string): string[] {
  if (!text || !text.trim()) return [];
  const blocks = parseStoryBlocks(text);
  const plain = blocks.map((b) => b.content).join(' ');
  return plain.split(/\s+/).filter(Boolean);
}

export function countStoryWords(text?: string): number {
  return getPlainStoryWords(text).length;
}

/**
 * - A story of up to about 80 words shows in full on its card with no "Read more" / "Read full message".
 * - Longer stories (> 80 words) show the first ~100 words and "Read full message" / "Read full story".
 */
export function getStoryCardPreview(text?: string): {
  isTruncated: boolean;
  wordCount: number;
  previewBlocks: StoryBlock[];
  previewPlainText: string;
} {
  const blocks = parseStoryBlocks(text);
  const words = getPlainStoryWords(text);
  const wordCount = words.length;

  if (wordCount <= 80) {
    return {
      isTruncated: false,
      wordCount,
      previewBlocks: blocks,
      previewPlainText: blocks.map((b) => b.content).join('\n\n'),
    };
  }

  const maxWords = 100;
  let remaining = maxWords;
  const previewBlocks: StoryBlock[] = [];

  for (const block of blocks) {
    if (remaining <= 0) break;
    const blockWords = block.content.split(/\s+/).filter(Boolean);
    if (blockWords.length <= remaining) {
      previewBlocks.push(block);
      remaining -= blockWords.length;
    } else {
      previewBlocks.push({
        type: block.type === 'boldClosing' ? 'paragraph' : block.type,
        content: blockWords.slice(0, remaining).join(' ') + '…',
      });
      remaining = 0;
    }
  }

  return {
    isTruncated: true,
    wordCount,
    previewBlocks,
    previewPlainText: words.slice(0, maxWords).join(' ') + '…',
  };
}

/**
 * Resolves the effective story text for a student profile.
 * Uses `student.myStory` as the primary source of truth.
 */
export function getProfileStoryText(student?: StudentProfile | null): string {
  if (!student) return '';
  if (student.hideMyStory) return '';
  return (student.myStory || student.bio || '').trim();
}

/**
 * Formats the dynamic "From the {Actual Role}" heading based on the featured person's role.
 */
export function getFromRoleHeading(role?: string): string {
  const rawRole = (role || '').replace(/\blawsan\b\s*/gi, '').trim();
  if (!rawRole) return 'From the President';

  const primaryRole = rawRole.split(/[,|/•·]/)[0].trim();
  if (!primaryRole) return 'From the President';

  const lower = primaryRole.toLowerCase();
  if (lower.includes('president') && !lower.includes('vice')) {
    return 'From the President';
  }
  if (lower === 'member' || lower === 'student' || lower === 'classmate' || lower === 'graduate') {
    return 'From the Class Representative';
  }
  if (lower.startsWith('the ')) {
    return `From ${primaryRole}`;
  }
  return `From the ${primaryRole}`;
}

/**
 * Formats the clean role label used on profile and story cards (stripping legacy prefix like LAWSAN)
 */
export function getDisplayRoleLabel(student?: StudentProfile | null, fallback = 'Class Member'): string {
  if (!student) return fallback;
  const cleanRole = (val: string) => val.replace(/\blawsan\b\s*/gi, '').trim();
  const pos = cleanRole(student.position || '');
  if (pos && pos.toLowerCase() !== 'member') return pos;
  const cat = cleanRole(student.roleCategory || '');
  if (cat && cat.toLowerCase() !== 'member') return cat;
  return pos || fallback;
}

/**
 * Finds the primary featured leader profile (President -> Class Governor -> Class Rep -> top leader).
 */
export function getFeaturedLeaderProfile(
  set?: ClassSet | null,
  includeWithoutStory = false
): StudentProfile | null {
  if (!set || !Array.isArray(set.students)) return null;

  const approvedStudents = set.students.filter((s) => s.approved !== false);
  const eligibleStudents = includeWithoutStory
    ? approvedStudents
    : approvedStudents.filter((s) => Boolean(getProfileStoryText(s)));

  if (set.featuredLeaderProfileId) {
    const explicit = eligibleStudents.find((s) => s.id === set.featuredLeaderProfileId);
    if (explicit) return explicit;
  }

  const roleText = (s: StudentProfile) =>
    `${s.position || ''} ${s.roleCategory || ''}`.toLowerCase();

  // 1. President (not Vice President)
  const mainPresident = eligibleStudents.find((s) => {
    const r = roleText(s);
    return r.includes('president') && !r.includes('vice');
  });
  if (mainPresident) return mainPresident;

  // 2. Class Governor / Governor
  const governor = eligibleStudents.find((s) => {
    const r = roleText(s);
    return r.includes('class governor') || r.includes('governor');
  });
  if (governor) return governor;

  // 3. Class Representative / Class Rep
  const classRep = eligibleStudents.find((s) => {
    const r = roleText(s);
    return r.includes('class rep') || r.includes('representative');
  });
  if (classRep) return classRep;

  // 4. Any President
  const anyPresident = eligibleStudents.find((s) => roleText(s).includes('president'));
  if (anyPresident) return anyPresident;

  // 5. Any other recognized leader with a story
  const anyLeader = eligibleStudents.find((s) => isLeaderProfile(s));
  if (anyLeader) return anyLeader;

  return null;
}

/**
 * Automatically returns all approved leader stories for "Final thoughts":
 * - `primaryLeader`: The top leader story (President -> Class Governor -> Class Rep -> first leader)
 * - `otherLeaders`: Other approved leaders who have submitted a story (up to 3 on public album, or all in admin)
 * - `allLeaderStories`: All approved leaders who have a story (including hidden ones when `includeHidden = true`, for the dashboard read-only list)
 */
export function getAutomaticLeaderStories(
  set?: ClassSet | null,
  includeHidden = false
): {
  primaryLeader: StudentProfile | null;
  otherLeaders: StudentProfile[];
  allLeaderStories: StudentProfile[];
} {
  if (!set || !Array.isArray(set.students)) {
    return { primaryLeader: null, otherLeaders: [], allLeaderStories: [] };
  }

  const approvedLeadersWithStory = set.students
    .filter((s) => {
      if (s.approved === false) return false;
      const isLeader = isLeaderProfile(s) || Boolean(s.featuredInOurStory);
      if (!isLeader) return false;
      const rawStory = (s.myStory || '').trim();
      if (!rawStory) return false;
      if (!includeHidden && s.hideMyStory) return false;
      return true;
    })
    .sort((a, b) => {
      const rankA = a.leaderOrder ?? calculateIntuitiveHierarchyRank(a.position || '');
      const rankB = b.leaderOrder ?? calculateIntuitiveHierarchyRank(b.position || '');
      return rankA - rankB;
    });

  const primaryLeader = getFeaturedLeaderProfile(set, false);
  const effectivePrimary =
    primaryLeader && approvedLeadersWithStory.some((s) => s.id === primaryLeader.id)
      ? primaryLeader
      : approvedLeadersWithStory[0] || null;

  const otherLeaders = approvedLeadersWithStory
    .filter((s) => s.id !== effectivePrimary?.id)
    .slice(0, 3);

  return {
    primaryLeader: effectivePrimary,
    otherLeaders,
    allLeaderStories: approvedLeadersWithStory,
  };
}

/**
 * Legacy helper kept for compatibility: returns up to 3 additional leader/executive profiles with stories.
 */
export function getExecutiveFeaturedProfiles(
  set?: ClassSet | null,
  excludeLeaderId?: string | null,
  includeWithoutStory = false
): StudentProfile[] {
  if (!set || !Array.isArray(set.students)) return [];
  const { otherLeaders, allLeaderStories } = getAutomaticLeaderStories(set, includeWithoutStory);
  if (!excludeLeaderId) return otherLeaders;
  return allLeaderStories.filter((s) => s.id !== excludeLeaderId).slice(0, 3);
}
