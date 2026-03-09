const WAYBACK_CDX_BASE = 'https://web.archive.org/cdx/search/cdx';
const MAX_SNAPSHOTS = 12;
const FETCH_TIMEOUT = 8000;

interface WaybackSnapshot {
  timestamp: string;
  date: string;
  statusCode: string;
  url: string;
}

export async function getWaybackSnapshots(domain: string): Promise<WaybackSnapshot[]> {
  try {
    const params = new URLSearchParams({
      url: domain,
      output: 'json',
      fl: 'timestamp,statuscode,original',
      filter: 'statuscode:200',
      collapse: 'timestamp:6',
      limit: MAX_SNAPSHOTS.toString(),
    });

    const res = await fetch(`${WAYBACK_CDX_BASE}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return [];

    return data.slice(1).map((row: string[]) => ({
      timestamp: row[0],
      date: `${row[0].slice(0, 4)}-${row[0].slice(4, 6)}-${row[0].slice(6, 8)}`,
      statusCode: row[1],
      url: `https://web.archive.org/web/${row[0]}/${row[2]}`,
    }));
  } catch {
    return [];
  }
}

export async function getWaybackPageCount(domain: string): Promise<number> {
  try {
    const params = new URLSearchParams({
      url: `${domain}/*`,
      output: 'json',
      fl: 'timestamp',
      filter: 'statuscode:200',
      showNumPages: 'true',
    });

    const res = await fetch(`${WAYBACK_CDX_BASE}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return 0;
    const text = await res.text();
    return parseInt(text.trim(), 10) || 0;
  } catch {
    return 0;
  }
}
