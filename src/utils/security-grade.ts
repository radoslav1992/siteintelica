/**
 * Calculates an A–F security grade based on HTTP security headers.
 */
export function calculateSecurityGrade(security: any): { grade: string, score: number, recommendations: string[] } {
    if (!security) return { grade: 'F', score: 0, recommendations: ['No security headers detected.'] };

    let score = 0;
    const recommendations: string[] = [];

    // HSTS (Strict-Transport-Security) — 20 pts
    if (security.hsts) { score += 20; }
    else { recommendations.push('Add Strict-Transport-Security header to force HTTPS connections.'); }

    // Content Security Policy — 25 pts (most important)
    if (security.csp) { score += 25; }
    else { recommendations.push('Add Content-Security-Policy header to prevent XSS and injection attacks.'); }

    // X-Frame-Options — 15 pts
    if (security.xframe) { score += 15; }
    else { recommendations.push('Add X-Frame-Options header to prevent clickjacking attacks.'); }

    // X-Content-Type-Options — 15 pts
    if (security.xContentTypeOptions) { score += 15; }
    else { recommendations.push('Add X-Content-Type-Options: nosniff to prevent MIME-type sniffing.'); }

    // Referrer-Policy — 10 pts
    if (security.referrerPolicy) { score += 10; }
    else { recommendations.push('Add Referrer-Policy header to control information leakage.'); }

    // Permissions-Policy — 15 pts
    if (security.permissionsPolicy) { score += 15; }
    else { recommendations.push('Add Permissions-Policy header to restrict browser feature access.'); }

    let grade: string;
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 55) grade = 'C';
    else if (score >= 35) grade = 'D';
    else grade = 'F';

    return { grade, score, recommendations };
}
