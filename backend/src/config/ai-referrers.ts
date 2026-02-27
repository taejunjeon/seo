export type AiReferrer = {
  domain: string;
  label: string;
};

// AI referrer allowlist (suffix match; subdomains allowed).
// Add/remove entries here when expanding AI sources.
export const AI_REFERRERS: readonly AiReferrer[] = [
  { domain: "chatgpt.com", label: "ChatGPT" },
  { domain: "chat.openai.com", label: "ChatGPT" },
  { domain: "perplexity.ai", label: "Perplexity" },
  { domain: "gemini.google.com", label: "Gemini" },
  { domain: "bard.google.com", label: "Bard" },
  { domain: "copilot.microsoft.com", label: "Copilot" },
  { domain: "claude.ai", label: "Claude" },
  { domain: "you.com", label: "You.com" },
  { domain: "komo.ai", label: "Komo" },
  { domain: "phind.com", label: "Phind" },
  { domain: "meta.ai", label: "Meta AI" },
  { domain: "search.brave.com", label: "Brave Search" },
] as const;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const makeDomainSuffixPattern = (domain: string) => `(^|.*\\.)${escapeRegex(domain.toLowerCase())}$`;

export const AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST = AI_REFERRERS.map((r) => makeDomainSuffixPattern(r.domain));

const REFERRER_REGEXES = AI_REFERRERS.map((r) => ({
  ...r,
  re: new RegExp(makeDomainSuffixPattern(r.domain)),
}));

export const matchAiReferrer = (sessionSource: string): { matched: boolean; label: string | null } => {
  const normalized = (sessionSource ?? "").trim().toLowerCase();
  if (!normalized) return { matched: false, label: null };
  for (const entry of REFERRER_REGEXES) {
    if (entry.re.test(normalized)) return { matched: true, label: entry.label };
  }
  return { matched: false, label: null };
};

