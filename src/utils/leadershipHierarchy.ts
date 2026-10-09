import { StudentProfile } from '../types';

/**
 * Normalizes title string and checks whether a student profile holds an executive / leadership title.
 * Excludes generic placeholder roles like "Member", "Student", or empty values.
 */
export function isLeaderProfile(student: Pick<StudentProfile, 'position'>): boolean {
  if (!student.position) return false;
  const pos = student.position.trim().toLowerCase();
  if (!pos) return false;

  const genericExclusions = [
    'member',
    'student',
    'graduand',
    'diplomate',
    'classmate',
    'none',
    'n/a',
    '-',
    'nil',
    'ordinary member',
    'regular student',
  ];

  return !genericExclusions.includes(pos);
}

/**
 * KoHot Intuitive Leadership Hierarchy Calculation.
 * Intuitively assigns hierarchical ranks based on standard Nigerian tertiary institution 
 * and departmental student executive structures (President/Class Rep -> VP/Assistant Rep -> Sec Gen -> Fin Sec -> etc.)
 */
export function calculateIntuitiveHierarchyRank(position?: string): number {
  if (!position) return 999;
  const p = position.toLowerCase().trim();

  // Tier 1: Supreme Executives / Department Head / Class Rep / Governor / President
  if (
    p.includes('president') && !p.includes('vice') ||
    p.includes('class representative') ||
    p.includes('class rep') ||
    p.includes('class governor') ||
    p.includes('head boy') ||
    p.includes('head girl') ||
    p.includes('chairman') && !p.includes('vice') ||
    p.includes('chairperson') && !p.includes('vice')
  ) {
    return 10;
  }

  // Tier 2: Vice President / Assistant Class Representative / Deputy Governor
  if (
    p.includes('vice president') ||
    p.includes('vice-president') ||
    p.includes('vp') ||
    p.includes('assistant class representative') ||
    p.includes('assistant class rep') ||
    p.includes('deputy governor') ||
    p.includes('vice chairman') ||
    p.includes('vice chairperson') ||
    p.includes('assistant governor')
  ) {
    return 20;
  }

  // Tier 3: General Secretary / Secretary General
  if (
    p.includes('general secretary') ||
    p.includes('secretary general') ||
    p.includes('gen sec') ||
    p.includes('general sec') ||
    (p.includes('secretary') && !p.includes('asst') && !p.includes('assistant') && !p.includes('financial') && !p.includes('social') && !p.includes('welfare') && !p.includes('sports'))
  ) {
    return 30;
  }

  // Tier 4: Assistant General Secretary / Assistant Secretary
  if (
    p.includes('assistant general secretary') ||
    p.includes('asst. general secretary') ||
    p.includes('asst gen sec') ||
    p.includes('assistant secretary') ||
    p.includes('asst secretary')
  ) {
    return 40;
  }

  // Tier 5: Financial Secretary / Treasurer
  if (
    p.includes('financial secretary') ||
    p.includes('fin sec') ||
    p.includes('treasurer') ||
    p.includes('director of finance') ||
    p.includes('finance officer') ||
    p.includes('bursar')
  ) {
    return 50;
  }

  // Tier 6: Public Relations Officer (PRO) / Media / Publicity
  if (
    p.includes('public relations') ||
    p.includes('pro') ||
    p.includes('publicity') ||
    p.includes('media') ||
    p.includes('editorial') ||
    p.includes('press') ||
    p.includes('communications') ||
    p.includes('information officer')
  ) {
    return 60;
  }

  // Tier 7: Academics / Technical Lead / GDSC
  if (
    p.includes('academic') ||
    p.includes('tutorial') ||
    p.includes('technical lead') ||
    p.includes('tech lead') ||
    p.includes('gdsc') ||
    p.includes('librarian') ||
    p.includes('director of studies')
  ) {
    return 70;
  }

  // Tier 8: Socials & Welfare
  if (
    p.includes('social') ||
    p.includes('welfare') ||
    p.includes('entertainment') ||
    p.includes('events')
  ) {
    return 80;
  }

  // Tier 9: Sports & Logistics
  if (
    p.includes('sport') ||
    p.includes('games') ||
    p.includes('logistics') ||
    p.includes('athletics')
  ) {
    return 90;
  }

  // Tier 10: Provost / Chief Whip / Auditor / Protocol / Security / Infrastructure
  if (
    p.includes('provost') ||
    p.includes('chief whip') ||
    p.includes('auditor') ||
    p.includes('protocol') ||
    p.includes('infrastructure') ||
    p.includes('security')
  ) {
    return 100;
  }

  // Tier 11: Other titles / executive offices
  return 150;
}

/**
 * Returns the effective hierarchy rank of a leader.
 * If the Class Rep/Admin manually specified a leaderOrder, it takes precedence.
 * Otherwise, KoHot's intuitive algorithm determines the ranking.
 */
export function getLeaderRank(student: StudentProfile): number {
  if (typeof student.leaderOrder === 'number' && student.leaderOrder > 0) {
    return student.leaderOrder;
  }
  return calculateIntuitiveHierarchyRank(student.position);
}

/**
 * Sorts leaders strictly according to hierarchy (admin manual order first, then intuitive rank),
 * with alphabetical tie-breaking for equal ranks.
 */
export function sortLeadersByHierarchy(leaders: StudentProfile[]): StudentProfile[] {
  return [...leaders].sort((a, b) => {
    const rankA = getLeaderRank(a);
    const rankB = getLeaderRank(b);

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
  });
}

/**
 * Sorts student profiles strictly alphabetically by full name.
 */
export function sortProfilesAlphabetically(students: StudentProfile[]): StudentProfile[] {
  return [...students].sort((a, b) => 
    a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' })
  );
}

/**
 * Reorders leaders in an array by moving an item from sourceIndex to targetIndex,
 * and updates every leader's `leaderOrder` with 1-based sequential integers.
 */
export function reorderLeadersHierarchy(
  leaders: StudentProfile[],
  sourceIndex: number,
  targetIndex: number
): StudentProfile[] {
  const result = Array.from(leaders);
  const [removed] = result.splice(sourceIndex, 1);
  result.splice(targetIndex, 0, removed);

  return result.map((student, idx) => ({
    ...student,
    leaderOrder: idx + 1,
  }));
}

/**
 * Applies the intuitive hierarchy algorithm to all current leaders and sets sequential leaderOrder (1, 2, 3...).
 */
export function autoApplyIntuitiveOrder(leaders: StudentProfile[]): StudentProfile[] {
  const sorted = [...leaders].sort((a, b) => {
    const rankA = calculateIntuitiveHierarchyRank(a.position);
    const rankB = calculateIntuitiveHierarchyRank(b.position);
    if (rankA !== rankB) return rankA - rankB;
    return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
  });

  return sorted.map((student, idx) => ({
    ...student,
    leaderOrder: idx + 1,
  }));
}
