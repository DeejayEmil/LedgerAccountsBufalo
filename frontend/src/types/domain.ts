export type AccountType = 'CHECKING' | 'SAVINGS';
export type TransactionType = 'CREDIT' | 'DEBIT';

export interface UserPublic {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface Account {
  id: string;
  accountNumber: string;
  type: AccountType;
  currency: string;
  balance: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BalanceSummary {
  accountId: string;
  currentBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
}

export interface BalanceHistoryPoint {
  date: string;
  closingBalance: string;
}

export interface TransferResult {
  sourceTransaction: Transaction;
  toAccountNumber: string;
}
