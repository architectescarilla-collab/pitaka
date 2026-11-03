import type { Account, Data, Receivable, Recurring } from './types';

const acct = (
  id: string,
  name: string,
  institution: string,
  type: Account['type'],
  aliases: string[],
  extra: Partial<Account> = {},
): Account => ({ id, name, institution, type, currency: 'PHP', aliases, archived: false, ...extra });

export const seedAccounts: Account[] = [
  acct('cash', 'Cash on Hand', '—', 'cash', ['cash', 'hard cash']),
  acct('cash-usd', 'Cash on Hand (USD)', '—', 'cash', ['usd cash', 'cash usd'], { currency: 'USD' }),
  acct('maya-wallet', 'Maya Wallet', 'Maya', 'wallet', ['maya wallet']),
  acct('maya-sav-1', 'Maya Savings 1', 'Maya', 'savings', ['maya savings 1', 'maya savings', 'savings 1', 'maya']),
  acct('maya-sav-2', 'Maya Savings 2', 'Maya', 'savings', ['maya savings 2', 'savings 2']),
  acct('gotyme-wallet', 'GoTyme Wallet', 'GoTyme', 'wallet', ['gotyme wallet']),
  acct('gotyme-sav', 'GoTyme Savings', 'GoTyme', 'savings', ['gotyme savings', 'gotyme']),
  acct('gcash', 'GCash Wallet', 'GCash', 'wallet', ['gcash']),
  acct('gcash-stocks', 'GCash Stocks', 'GCash', 'investment', ['gstocks', 'gcash stocks']),
  acct('gcash-mf', 'GCash Mutual Fund', 'GCash', 'investment', ['gfunds', 'gcash mutual fund']),
  acct('rcbc-sav', 'RCBC Hexagon Club', 'RCBC', 'savings', ['rcbc savings', 'hexagon club']),
  acct('bpi-payroll-php', 'BPI Payroll (PHP)', 'BPI', 'savings', ['bpi php payroll', 'bpi payroll php', 'php payroll', 'bpi php', 'bpi payroll', 'bpi'], {
    note: 'HTH salary lands here',
  }),
  acct('bpi-personal', 'BPI Personal', 'BPI', 'savings', ['bpi personal']),
  acct('bpi-payroll-usd', 'BPI Payroll (USD)', 'BPI', 'savings', ['bpi usd', 'usd payroll', 'bpi payroll usd'], { currency: 'USD' }),
  acct('wise-usd', 'Wise USD', 'Wise', 'wallet', ['wise'], { currency: 'USD', note: 'Flow payroll lands here' }),
  acct('bpi-mf', 'BPI Mutual Funds', 'BPI', 'investment', ['bpi mutual funds', 'bpi mf']),
  acct('pagibig-mp1', 'Pag-IBIG MP1', 'Pag-IBIG', 'government', ['mp1', 'pagibig mp1']),
  acct('pagibig-mp2', 'Pag-IBIG MP2', 'Pag-IBIG', 'government', ['mp2', 'pagibig mp2', 'pagibig']),
  acct('pagibig-mp2-nanay', 'Pag-IBIG MP2 - Nanay', 'Pag-IBIG', 'government', ['mp2 nanay']),
  acct('maya-black', 'Maya Black', 'Maya', 'credit', ['maya cc', 'maya black', 'maya credit'], { due: '1st week of month' }),
  acct('rcbc-cc', 'RCBC Hexagon CC', 'RCBC', 'credit', ['rcbc cc', 'rcbc'], { due: '1st week of month' }),
  acct('bpi-gold', 'BPI Gold', 'BPI', 'credit', ['bpi cc', 'bpi gold'], { due: '2nd week of month' }),
  acct('ub-rewards', 'UB Rewards', 'Union Bank', 'credit', ['ub cc', 'ub', 'unionbank'], { due: '3rd week of month' }),
  acct('shopee-paylater', 'Shopee PayLater', 'Shopee', 'paylater', ['shopee paylater', 'spaylater']),
  acct('tiktok-paylater', 'TikTok PayLater', 'TikTok', 'paylater', ['tiktok paylater', 'tiktok pay later']),
];

export const seedCategories = [
  'Dining Out',
  'Groceries',
  'Transportation',
  'Housing & Rent',
  'Utilities',
  'Subscriptions',
  'Phone & Internet',
  'Health & Medical',
  'Insurance',
  'Shopping & Personal',
  'Travel',
  'Family Support',
  'Gifts & Donations',
  'Pets',
  'Education',
  'Fees & Interest',
  'Loan / Debt Payment',
  'Home Maintenance',
  'Entertainment',
  'Taxes',
  'Other',
];

const rec = (id: string, name: string, category: string, amount: number, cycle: Recurring['cycle'], accountId?: string, extra: Partial<Recurring> = {}): Recurring => ({
  id, name, category, amount, currency: 'PHP', cycle, accountId, active: true, ...extra,
});

export const seedRecurring: Recurring[] = [
  rec('r-mytown-rent', 'MyTown Rent', 'Housing & Rent', 6750, 'monthly', 'maya-sav-1', { note: 'Electricity and water billed separately' }),
  rec('r-mytown-util', 'MyTown Group Utilities', 'Utilities', 350, 'monthly', 'maya-sav-1'),
  rec('r-nonoy-rent', 'Nonoy Rent', 'Housing & Rent', 19000, 'monthly', 'ub-rewards', { endMonth: '2026-12' }),
  rec('r-phone-nonoy', 'Phone (Nonoy)', 'Phone & Internet', 1472.22, 'monthly', 'ub-rewards'),
  rec('r-phone-akon', 'Phone (Akon)', 'Phone & Internet', 1400, 'monthly', 'ub-rewards'),
  rec('r-tablet', 'Tablet installment', 'Shopping & Personal', 1624.92, 'monthly', 'bpi-gold', { endMonth: '2027-08' }),
  rec('r-netflix', 'Netflix', 'Subscriptions', 619, 'monthly', 'ub-rewards'),
  rec('r-spotify', 'Spotify', 'Subscriptions', 169, 'monthly', 'rcbc-cc'),
  rec('r-google-one', 'Google One', 'Subscriptions', 275, 'monthly', 'rcbc-cc'),
  rec('r-amazon', 'Amazon Prime', 'Subscriptions', 14.99, 'monthly', 'rcbc-cc', { currency: 'USD' }),
  rec('r-disney', 'Disney+', 'Subscriptions', 4850, 'annual', 'rcbc-cc'),
  rec('r-claude', 'Claude', 'Subscriptions', 14138.66, 'annual', 'gotyme-sav', { nextDue: '2027-10-04', note: 'USD 223.71 a year' }),
];

export const seedReceivables: Receivable[] = [
  {
    id: 'rcv-car',
    name: 'CAR',
    principal: 930000,
    total: 1224000,
    firstDue: '2026-04',
    steps: [{ from: '2026-04', amount: 18000 }],
    priorCollected: 126000,
    note: 'Collected to date includes payments through Oct 2026',
  },
  {
    id: 'rcv-calubihan',
    name: 'Calubihan',
    principal: 375000,
    total: 500000,
    firstDue: '2026-03',
    steps: [
      { from: '2026-03', amount: 10000 },
      { from: '2026-07', amount: 15500 },
    ],
    priorCollected: 102000,
    note: 'Collected to date includes payments through Oct 2026',
  },
];

export function seedData(): Data {
  return {
    version: 1,
    accounts: structuredClone(seedAccounts),
    txns: [],
    recurring: structuredClone(seedRecurring),
    receivables: structuredClone(seedReceivables),
    categories: [...seedCategories],
    settings: { usdRate: 63.41, monthlySavingsTarget: 20000 },
  };
}

/** For new cloud users: common Philippine accounts at ₱0, no personal bills or loans. */
export function starterCommon(): Data {
  return {
    version: 1,
    accounts: structuredClone(seedAccounts.filter((a) => a.id !== 'pagibig-mp2-nanay')),
    txns: [],
    recurring: [],
    receivables: [],
    categories: [...seedCategories],
    settings: { usdRate: 58, monthlySavingsTarget: 0 },
  };
}

/** For new cloud users who want to add every account themselves. */
export function starterBlank(): Data {
  return { ...starterCommon(), accounts: structuredClone(seedAccounts.filter((a) => a.id === 'cash')) };
}
