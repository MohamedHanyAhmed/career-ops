// Client-safe platform classification for the inbox. This is deliberately
// broader than Explore's ATS list: the inbox also receives public job boards
// such as LinkedIn and WUZZUF, and hiding those under "unknown" made the source
// mix impossible to audit.

export const INBOX_PLATFORMS = ["linkedin", "wuzzuf", "greenhouse", "lever", "ashby", "workday", "other"];

export const INBOX_PLATFORM_LABEL = {
  linkedin: "LinkedIn",
  wuzzuf: "WUZZUF",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
  other: "Other",
};

export function platformLabel(platform) {
  return INBOX_PLATFORM_LABEL[platform] ?? platform;
}

export function platformFromUrl(url) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  const domainIs = (base) => host === base || host.endsWith(`.${base}`);
  if (domainIs("linkedin.com")) return "linkedin";
  if (domainIs("wuzzuf.net")) return "wuzzuf";
  if (domainIs("greenhouse.io")) return "greenhouse";
  if (domainIs("lever.co")) return "lever";
  if (domainIs("ashbyhq.com")) return "ashby";
  if (domainIs("myworkdayjobs.com") || domainIs("workday.com")) return "workday";
  return "other";
}

export function platformCounts(rows, platformOf = (row) => platformFromUrl(row.url)) {
  const counts = new Map();
  for (const row of rows) {
    const platform = platformOf(row);
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return INBOX_PLATFORMS.filter((platform) => counts.has(platform)).map((platform) => ({
    platform,
    count: counts.get(platform),
  }));
}
