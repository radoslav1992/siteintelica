/**
 * Keyword visibility estimation from on-page signals.
 * Extracts keyword intent from title, meta description, headings, and body content,
 * then estimates search visibility based on content depth and keyword distribution.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'or',
  'if', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'we',
  'you', 'he', 'she', 'they', 'me', 'him', 'her', 'us', 'them', 'my',
  'your', 'his', 'our', 'their', 'what', 'which', 'who', 'whom',
  'about', 'up', 'also', 'get', 'new', 'one', 'two', 'like', 'make',
]);

const MIN_WORD_LENGTH = 3;
const MAX_KEYWORDS = 20;

export interface KeywordIntel {
  primaryKeywords: KeywordEntry[];
  longTailPhrases: string[];
  topicClusters: TopicCluster[];
  contentGaps: string[];
  estimatedKeywordCoverage: number;
  searchIntentSignals: SearchIntent;
}

interface KeywordEntry {
  keyword: string;
  frequency: number;
  prominence: number;
  source: string[];
}

interface TopicCluster {
  topic: string;
  keywords: string[];
  strength: number;
}

interface SearchIntent {
  informational: number;
  transactional: number;
  navigational: number;
  commercial: number;
}

export function analyzeKeywordVisibility(
  title: string,
  description: string,
  headings: string[],
  bodyText: string,
  url: string
): KeywordIntel {
  const titleWords = extractWords(title);
  const descWords = extractWords(description);
  const headingWords = headings.flatMap(h => extractWords(h));
  const bodyWords = extractWords(bodyText);
  const urlWords = extractWords(url.replace(/https?:\/\//, '').replace(/[\/\-_.]/g, ' '));

  const keywordScores: Record<string, { freq: number; prominence: number; sources: Set<string> }> = {};

  const addWord = (word: string, weight: number, source: string) => {
    if (!keywordScores[word]) {
      keywordScores[word] = { freq: 0, prominence: 0, sources: new Set() };
    }
    keywordScores[word].freq++;
    keywordScores[word].prominence += weight;
    keywordScores[word].sources.add(source);
  };

  titleWords.forEach(w => addWord(w, 10, 'title'));
  descWords.forEach(w => addWord(w, 5, 'meta description'));
  headingWords.forEach(w => addWord(w, 3, 'headings'));
  urlWords.forEach(w => addWord(w, 4, 'URL'));
  bodyWords.forEach(w => addWord(w, 1, 'body'));

  const primaryKeywords: KeywordEntry[] = Object.entries(keywordScores)
    .map(([keyword, data]) => ({
      keyword,
      frequency: data.freq,
      prominence: Math.round(data.prominence * 10) / 10,
      source: [...data.sources],
    }))
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, MAX_KEYWORDS);

  const longTailPhrases = extractPhrases(title, description, headings);

  const topicClusters = buildTopicClusters(primaryKeywords);

  const contentGaps = detectContentGaps(primaryKeywords, title, description, headings);

  const estimatedKeywordCoverage = calculateCoverage(primaryKeywords, bodyWords.length);

  const searchIntentSignals = detectSearchIntent(title, description, bodyText, url);

  return {
    primaryKeywords,
    longTailPhrases,
    topicClusters,
    contentGaps,
    estimatedKeywordCoverage,
    searchIntentSignals,
  };
}

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w));
}

function extractPhrases(title: string, description: string, headings: string[]): string[] {
  const sources = [title, description, ...headings].filter(Boolean);
  const phrases = new Set<string>();

  sources.forEach(text => {
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const words = clean.split(/\s+/).filter(w => w.length >= MIN_WORD_LENGTH);

    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i + 1])) {
        phrases.add(bigram);
      }
      if (i < words.length - 2) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        phrases.add(trigram);
      }
    }
  });

  return [...phrases].slice(0, 15);
}

function buildTopicClusters(keywords: KeywordEntry[]): TopicCluster[] {
  const clusters: TopicCluster[] = [];
  const used = new Set<string>();

  keywords.forEach(kw => {
    if (used.has(kw.keyword)) return;

    const related = keywords.filter(other =>
      other.keyword !== kw.keyword &&
      !used.has(other.keyword) &&
      other.source.some(s => kw.source.includes(s))
    );

    if (related.length >= 1) {
      const clusterKeywords = [kw.keyword, ...related.slice(0, 4).map(r => r.keyword)];
      clusterKeywords.forEach(k => used.add(k));
      clusters.push({
        topic: kw.keyword,
        keywords: clusterKeywords,
        strength: Math.round(clusterKeywords.length / keywords.length * 100),
      });
    }
  });

  return clusters.slice(0, 5);
}

function detectContentGaps(keywords: KeywordEntry[], title: string, description: string, headings: string[]): string[] {
  const gaps: string[] = [];
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();

  const topKeywords = keywords.slice(0, 5);
  topKeywords.forEach(kw => {
    if (!titleLower.includes(kw.keyword)) {
      gaps.push(`Top keyword "${kw.keyword}" missing from page title`);
    }
    if (!descLower.includes(kw.keyword)) {
      gaps.push(`Top keyword "${kw.keyword}" missing from meta description`);
    }
  });

  if (headings.length === 0) {
    gaps.push('No heading tags found — add H1/H2 with target keywords');
  }

  if (description.length < 50) {
    gaps.push('Meta description too short — aim for 150-160 characters with keywords');
  } else if (description.length > 160) {
    gaps.push('Meta description may be truncated in SERPs (over 160 chars)');
  }

  return gaps.slice(0, 8);
}

function calculateCoverage(keywords: KeywordEntry[], totalWords: number): number {
  if (totalWords === 0) return 0;
  const multiSourceKeywords = keywords.filter(k => k.source.length >= 2).length;
  const highPromKeywords = keywords.filter(k => k.prominence >= 10).length;
  const coverageScore = Math.min(100, Math.round(
    (multiSourceKeywords / Math.max(keywords.length, 1)) * 40 +
    (highPromKeywords / Math.max(keywords.length, 1)) * 30 +
    Math.min(totalWords / 500, 1) * 30
  ));
  return coverageScore;
}

function detectSearchIntent(title: string, description: string, body: string, url: string): SearchIntent {
  const all = `${title} ${description} ${body} ${url}`.toLowerCase();

  const transactionalSignals = ['buy', 'price', 'shop', 'order', 'purchase', 'deal', 'discount', 'coupon', 'cart', 'checkout', 'subscribe', 'plan', 'pricing', 'free trial'];
  const informationalSignals = ['how to', 'what is', 'guide', 'tutorial', 'learn', 'tips', 'best practices', 'examples', 'definition', 'explained', 'introduction'];
  const commercialSignals = ['best', 'top', 'review', 'comparison', 'vs', 'alternative', 'versus', 'compare', 'recommendation'];
  const navigationalSignals = ['login', 'sign in', 'dashboard', 'account', 'my ', 'profile', 'settings', 'support', 'contact', 'about us'];

  const count = (signals: string[]) => signals.filter(s => all.includes(s)).length;

  const raw = {
    transactional: count(transactionalSignals),
    informational: count(informationalSignals),
    commercial: count(commercialSignals),
    navigational: count(navigationalSignals),
  };

  const total = Math.max(raw.transactional + raw.informational + raw.commercial + raw.navigational, 1);

  return {
    informational: Math.round((raw.informational / total) * 100),
    transactional: Math.round((raw.transactional / total) * 100),
    navigational: Math.round((raw.navigational / total) * 100),
    commercial: Math.round((raw.commercial / total) * 100),
  };
}
