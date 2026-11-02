import type { Account, TransferPurpose } from './types';

export interface Draft {
  kind: 'expense' | 'income' | 'transfer';
  date: string;
  amount: number | null;
  accountId: string | null;
  toId: string | null;
  category: string;
  description: string;
  fee: number | null;
  purpose: TransferPurpose;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const CATEGORY_WORDS: [RegExp, string][] = [
  [/\b(coffee|latte|starbucks|cafe|milk ?tea|boba|donut|croissant|frozen yogurt|froyo|ice ?cream|snacks?|lunch|dinner|breakfast|brunch|merienda|kfc|jollibee|mcdo|mcdonald'?s|burger king|shakey'?s|pizza|ramen|grab ?food|foodpanda)\b/, 'Dining Out'],
  [/\b(grocer(y|ies)|supermarket|fruits?|yogurt|protein bars?|s&r|puregold|landers)\b/, 'Groceries'],
  [/\b(angkas|move ?it|joyride|grab(?! ?food)|indrive|taxi|jeep(ney)?|bus|train|lrt|mrt|transpo(rtation)?|fare|toll|parking|gas|fuel)\b/, 'Transportation'],
  [/\b(rent)\b/, 'Housing & Rent'],
  [/\b(electric(ity)?|meralco|water|utilit(y|ies))\b/, 'Utilities'],
  [/\b(netflix|spotify|disney|youtube|google one|icloud|chatgpt|claude|subscription|prime)\b/, 'Subscriptions'],
  [/\b(load|globe|smart|internet|wifi|pldt|converge)\b/, 'Phone & Internet'],
  [/\b(doctor|clinic|hospital|medicine|pharmacy|peptide|surgery|dental|checkup|lab)\b/, 'Health & Medical'],
  [/\b(insurance|policy)\b/, 'Insurance'],
  [/\b(massage|spa|haircut|salon|muji|ikea|uniqlo|shopee|lazada|tiktok shop|headset|clothes|shoes)\b/, 'Shopping & Personal'],
  [/\b(flight|airfare|hotel|airbnb|travel|tour)\b/, 'Travel'],
  [/\b(dogs?|cats?|pets?|vet|dog food)\b/, 'Pets'],
  [/\b(gift|donation)\b/, 'Gifts & Donations'],
  [/\b(fee|charge|interest)\b/, 'Fees & Interest'],
  [/\b(photocopy|print(ing)?|passport|id photo)\b/, 'Other'],
];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Turns "290 - rcbc cc - lunch at heybo" or "yesterday 10000 maya savings 1 to mp2 fee 5" into a draft. */
export function parseEntry(input: string, accounts: Account[], today = new Date()): Draft {
  let text = ' ' + input.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ') + ' ';
  const cut = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(re, ' ');
    return m;
  };

  // ---- Date ----
  let date = iso(today);
  let m: RegExpMatchArray | null;
  if ((m = cut(/\b(\d{4})-(\d{2})-(\d{2})\b/))) date = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = cut(/\b(yesterday|last night|kagabi|kahapon)\b/))) {
    const d = new Date(today); d.setDate(d.getDate() - 1); date = iso(d);
  } else if ((m = cut(/\b(today|tonight|ngayon)\b/))) date = iso(today);
  else if ((m = cut(/\b(?:last |this )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?\b/))) {
    const idx = WEEKDAYS.findIndex((w) => w.startsWith(m![1].slice(0, 3)));
    const d = new Date(today);
    let back = (d.getDay() - idx + 7) % 7;
    if (back === 0) back = 7;
    d.setDate(d.getDate() - back);
    date = iso(d);
  } else if ((m = cut(new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.? (\\d{1,2})\\b`)))) {
    const mo = MONTHS.indexOf(m[1]);
    let y = today.getFullYear();
    if (mo > today.getMonth() + 1) y -= 1;
    date = `${y}-${pad(mo + 1)}-${pad(Number(m[2]))}`;
  }

  // ---- Accounts (longest alias first, so "maya cc" beats "maya") ----
  const aliases: { a: Account; alias: string }[] = [];
  for (const a of accounts.filter((x) => !x.archived)) {
    for (const alias of new Set([a.name.toLowerCase(), ...a.aliases.map((x) => x.toLowerCase())])) aliases.push({ a, alias });
  }
  aliases.sort((x, y) => y.alias.length - x.alias.length);
  const found: { a: Account; pos: number; afterTo: boolean }[] = [];
  for (const { a, alias } of aliases) {
    const re = new RegExp(`(^|[^a-z0-9])(${escapeRe(alias)})(?=$|[^a-z0-9])`);
    const hit = text.match(re);
    if (!hit || hit.index === undefined) continue;
    if (found.some((f) => f.a.id === a.id)) continue;
    const pos = hit.index + hit[1].length;
    const before = text.slice(0, pos);
    found.push({ a, pos, afterTo: /\b(to|into|sa)\s*$/.test(before) });
    text = text.slice(0, pos) + ' '.repeat(alias.length) + text.slice(pos + alias.length);
  }
  found.sort((x, y) => x.pos - y.pos);

  // ---- Fee ----
  let fee: number | null = null;
  if ((m = cut(/\+?\s*₱?(\d+(?:\.\d+)?)\s*(?:pesos?|php)?\s*(?:convenience|conv|transaction|transfer|service)?\s*fee\b/)) ||
      (m = cut(/\b(?:with |plus |\+ ?)?(?:a )?(?:convenience|conv|transaction|transfer|service)?\s*fee(?: of)?\s*₱?(\d+(?:\.\d+)?)/))) {
    fee = Number(m[1]);
  }

  // ---- Amount ----
  let amount: number | null = null;
  const parts = [...text.matchAll(/(?:₱|php\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/g)];
  if (parts.length) {
    // "85 + 12" style: add them up.
    const sumMatch = text.match(/(\d[\d,]*(?:\.\d+)?(?:\s*\+\s*\d[\d,]*(?:\.\d+)?)+)/);
    if (sumMatch) {
      amount = sumMatch[1].split('+').reduce((s, x) => s + Number(x.replace(/,/g, '')), 0);
      text = text.replace(sumMatch[1], ' ');
    } else {
      const p = parts[0];
      amount = Number(p[1].replace(/,/g, '')) * (p[2] ? 1000 : 1);
      text = text.replace(p[0], ' ');
    }
  }

  // ---- Kind ----
  const raw = input.toLowerCase();
  let kind: Draft['kind'] = 'expense';
  let accountId: string | null = found[0]?.a.id ?? null;
  let toId: string | null = null;
  let purpose: TransferPurpose = 'transfer';
  const isIncome = /\b(salary|received|receive|refund|reimburse|repaid|paid me|interest earned|sahod|bonus)\b/.test(raw);

  if (found.length >= 2) {
    kind = 'transfer';
    const to = found.find((f) => f.afterTo) ?? found[1];
    const from = found.find((f) => f !== to)!;
    accountId = from.a.id;
    toId = to.a.id;
  } else if (/\bwithdr(ew|aw|awal)\b/.test(raw) && found[0]) {
    kind = 'transfer';
    accountId = found[0].a.id;
    toId = accounts.find((a) => a.type === 'cash' && a.currency === 'PHP')?.id ?? null;
    purpose = 'withdrawal';
  } else if (isIncome) {
    kind = 'income';
  }

  if (kind === 'transfer' && toId) {
    const to = accounts.find((a) => a.id === toId)!;
    const from = accounts.find((a) => a.id === accountId);
    if (purpose !== 'withdrawal') {
      if (to.type === 'credit' || to.type === 'paylater') purpose = 'card_payment';
      else if (to.type === 'investment' || to.type === 'government') purpose = 'investment';
      else if (from && from.currency !== to.currency) purpose = 'conversion';
    }
  }

  // ---- Category & description ----
  let category = kind === 'income' ? (/\bsalary|sahod\b/.test(raw) ? 'Salary' : /\b(refund|reimburse|repaid|paid me)\b/.test(raw) ? 'Refund' : 'Other') : 'Other';
  if (kind === 'expense') {
    for (const [re, c] of CATEGORY_WORDS) if (re.test(raw)) { category = c; break; }
  }
  const description = text
    .replace(/\b(paid|pay|payment|via|thru|through|using|deducted|from|in|on|with|to|sa|for|my|pesos?|php|peso|received|receive|withdrew|withdraw|withdrawal)\b/g, ' ')
    .replace(/[-;:,|/.]+(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    kind,
    date,
    amount,
    accountId,
    toId,
    category,
    description: description ? description[0].toUpperCase() + description.slice(1) : '',
    fee,
    purpose,
  };
}
