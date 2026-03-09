const MIN_CONTRAST_RATIO = 4.5;

export interface AccessibilityAudit {
  score: number;
  grade: string;
  issues: AccessibilityIssue[];
  passedChecks: string[];
  totalChecks: number;
}

interface AccessibilityIssue {
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  message: string;
  count: number;
}

export function auditAccessibility(html: string): AccessibilityAudit {
  const issues: AccessibilityIssue[] = [];
  const passed: string[] = [];

  // 1. Images without alt text
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgs.filter(i => !i.includes('alt=') || /alt=["']\s*["']/i.test(i)).length;
  if (missingAlt > 0) {
    issues.push({ severity: 'serious', message: `${missingAlt} image(s) missing alt text`, count: missingAlt });
  } else if (imgs.length > 0) {
    passed.push(`All ${imgs.length} images have alt text`);
  }

  // 2. Form inputs without labels
  const inputs = html.match(/<input[^>]*>/gi) || [];
  const inputsWithoutLabel = inputs.filter(i => {
    if (/type=["'](hidden|submit|button|reset|image)["']/i.test(i)) return false;
    const idMatch = i.match(/id=["']([^"']+)["']/i);
    if (!idMatch) return true;
    const labelPattern = new RegExp(`for=["']${idMatch[1]}["']`, 'i');
    return !labelPattern.test(html);
  });
  const ariaLabeled = inputsWithoutLabel.filter(i => /aria-label/i.test(i)).length;
  const noLabel = inputsWithoutLabel.length - ariaLabeled;
  if (noLabel > 0) {
    issues.push({ severity: 'serious', message: `${noLabel} form input(s) without associated labels`, count: noLabel });
  } else {
    passed.push('All form inputs have labels');
  }

  // 3. Missing document language
  const hasLang = /<html[^>]+lang=["'][^"']+["']/i.test(html);
  if (!hasLang) {
    issues.push({ severity: 'serious', message: 'HTML element missing lang attribute', count: 1 });
  } else {
    passed.push('Document language is set');
  }

  // 4. Skip navigation link
  const hasSkipLink = /skip[- ]?(to[- ]?)?(main|content|nav)/i.test(html);
  if (!hasSkipLink) {
    issues.push({ severity: 'moderate', message: 'No skip-to-content navigation link found', count: 1 });
  } else {
    passed.push('Skip navigation link present');
  }

  // 5. ARIA landmarks
  const hasMain = /<main[\s>]/i.test(html) || /role=["']main["']/i.test(html);
  const hasNav = /<nav[\s>]/i.test(html) || /role=["']navigation["']/i.test(html);
  if (!hasMain) {
    issues.push({ severity: 'moderate', message: 'No <main> landmark region found', count: 1 });
  } else {
    passed.push('Main landmark present');
  }
  if (!hasNav) {
    issues.push({ severity: 'minor', message: 'No <nav> landmark region found', count: 1 });
  } else {
    passed.push('Navigation landmark present');
  }

  // 6. Heading hierarchy
  const headingMatches = html.match(/<h([1-6])[^>]*>/gi) || [];
  const levels = headingMatches.map(h => parseInt(h.match(/<h([1-6])/i)?.[1] || '0'));
  if (levels.length > 0 && levels[0] !== 1) {
    issues.push({ severity: 'moderate', message: 'First heading is not H1', count: 1 });
  } else if (levels.length > 0) {
    passed.push('Heading hierarchy starts with H1');
  }
  let skippedLevels = 0;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) skippedLevels++;
  }
  if (skippedLevels > 0) {
    issues.push({ severity: 'moderate', message: `Heading hierarchy skips ${skippedLevels} level(s)`, count: skippedLevels });
  }

  // 7. Interactive elements without accessible names
  const buttons = html.match(/<button[^>]*>[\s]*<\/button>/gi) || [];
  if (buttons.length > 0) {
    const emptyButtons = buttons.filter(b => !(/aria-label/i.test(b) || /title=/i.test(b))).length;
    if (emptyButtons > 0) {
      issues.push({ severity: 'serious', message: `${emptyButtons} empty button(s) without accessible name`, count: emptyButtons });
    }
  }

  // 8. Links with generic text
  const genericLinks = (html.match(/<a[^>]*>(click here|read more|here|learn more|more)<\/a>/gi) || []).length;
  if (genericLinks > 0) {
    issues.push({ severity: 'minor', message: `${genericLinks} link(s) with generic text like "click here"`, count: genericLinks });
  } else {
    passed.push('No generic link text detected');
  }

  // 9. Viewport zoom disabled
  const viewportMeta = html.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i);
  if (viewportMeta && /user-scalable\s*=\s*(no|0)/i.test(viewportMeta[1])) {
    issues.push({ severity: 'critical', message: 'Viewport disables user zoom (user-scalable=no)', count: 1 });
  } else {
    passed.push('Viewport allows user zoom');
  }

  // 10. Tab index > 0
  const tabIndexPositive = (html.match(/tabindex=["']\d+["']/gi) || []).filter(t => {
    const val = parseInt(t.match(/\d+/)?.[0] || '0');
    return val > 0;
  }).length;
  if (tabIndexPositive > 0) {
    issues.push({ severity: 'minor', message: `${tabIndexPositive} element(s) with positive tabindex (disrupts natural tab order)`, count: tabIndexPositive });
  }

  const totalChecks = issues.length + passed.length;
  const passedCount = passed.length;
  const score = totalChecks > 0 ? Math.round((passedCount / totalChecks) * 100) : 0;

  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 35) grade = 'D';
  else grade = 'F';

  return { score, grade, issues, passedChecks: passed, totalChecks };
}
