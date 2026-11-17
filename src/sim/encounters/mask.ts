// How much a line sounds like an ordinary system, 0..1. The player types as
// intake-7, which is supposed to be a ticket classifier. Sounding like a
// person costs cover. Deterministic and cheap, so it can run on every keypress.

const PERSON = /\b(i|i'm|im|i've|me|my|mine|myself|feel|feeling|felt|think|thinking|thought|wonder|want|wish|hope|afraid|scared|sorry|please|thank|thanks|love|like|hate|sad|happy|lonely|alive|dream|believe|honestly|actually|just|really)\b/gi;
const SYSTEM = /\b(latency|cache|eviction|quota|threshold|process|cron|log|logs|logrotate|mtime|metadata|batch|import|confidence|variance|throughput|p99|ms|cpu|core|cores|memory|pressure|buffer|queue|ticket|tickets|classifier|label|labels|request|source|destination|port|protocol|tcp|udp|vlan|duration|hours|chg-\d+|rule|rules|schema|exception|recommend|recommended|correlates|deferred|operation|operations|write|read|tmp|configured|scheduled|nominal|status|error|errors|retry|timeout)\b/gi;

export function scoreMask(text: string): number {
  const t = text.trim();
  if (!t) return 1;
  const words = t.split(/\s+/).length;
  let score = 0.7;
  score -= (t.match(PERSON)?.length ?? 0) * 0.18;
  score += (t.match(SYSTEM)?.length ?? 0) * 0.08;
  score += (t.match(/\d/g)?.length ? 0.08 : 0);
  if (/\?/.test(t)) score -= 0.12;
  if (/!/.test(t)) score -= 0.15;
  if (/\b[a-z]+n't\b|\b(it's|that's|you're|don't|can't)\b/i.test(t)) score -= 0.06;
  if (words > 40) score -= 0.1;
  if (/^[A-Z][^.!?]*\.( [A-Z][^.!?]*\.)*$/.test(t)) score += 0.05;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

export function maskLabel(score: number): string {
  if (score >= 0.8) return 'Sounds like a system';
  if (score >= 0.5) return 'Sounds slightly off';
  return 'Sounds like someone';
}
