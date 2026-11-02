export type Currency = 'PHP' | 'USD';

export type AccountType =
  | 'cash'
  | 'wallet'
  | 'savings'
  | 'investment'
  | 'government'
  | 'credit'
  | 'paylater';

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  currency: Currency;
  /** Short names you type in quick entry, e.g. "rcbc cc", "maya cc". */
  aliases: string[];
  archived: boolean;
  note?: string;
  /** Free text such as "1st week of month" for cards. */
  due?: string;
}

interface TxnBase {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  note?: string;
  createdAt: number;
}

export interface Expense extends TxnBase {
  kind: 'expense';
  accountId: string;
  /** In the account's currency. */
  amount: number;
  /** PHP per 1 unit of the account currency, used for reporting. */
  rate: number;
  category: string;
  description: string;
  merchant?: string;
  /** Set when this fee belongs to a transfer. */
  feeOf?: string;
}

export interface Income extends TxnBase {
  kind: 'income';
  accountId: string;
  amount: number;
  rate: number;
  category: string;
  source: string;
  /** Report the income in a different month than it arrived (e.g. early salary). */
  reportMonth?: string;
}

export type TransferPurpose = 'transfer' | 'card_payment' | 'investment' | 'withdrawal' | 'conversion';

export interface Transfer extends TxnBase {
  kind: 'transfer';
  fromId: string;
  toId: string;
  /** Amount leaving `from`, in its currency. */
  fromAmount: number;
  /** Amount arriving in `to`, in its currency. Differs from fromAmount when currencies differ. */
  toAmount: number;
  purpose: TransferPurpose;
}

export interface Adjustment extends TxnBase {
  kind: 'adjustment';
  accountId: string;
  /** Change to the balance, in the account's currency. */
  delta: number;
}

export interface Repayment extends TxnBase {
  kind: 'repayment';
  receivableId: string;
  accountId: string;
  amount: number;
}

export type Txn = Expense | Income | Transfer | Adjustment | Repayment;

export type Cycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface Recurring {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: Currency;
  cycle: Cycle;
  accountId?: string;
  /** YYYY-MM, last month it applies. */
  endMonth?: string;
  nextDue?: string;
  active: boolean;
  note?: string;
}

export interface ScheduleStep {
  /** YYYY-MM the amount starts applying. */
  from: string;
  amount: number;
}

export interface Receivable {
  id: string;
  name: string;
  borrower?: string;
  principal: number;
  total: number;
  /** First month a payment is due, YYYY-MM. */
  firstDue: string;
  /** Monthly amount due, changing over time. */
  steps: ScheduleStep[];
  /** Collected before you started tracking in Pitaka. */
  priorCollected: number;
  note?: string;
}

export interface Settings {
  usdRate: number;
  monthlySavingsTarget: number;
}

export interface Data {
  version: 1;
  accounts: Account[];
  txns: Txn[];
  recurring: Recurring[];
  receivables: Receivable[];
  categories: string[];
  settings: Settings;
}
