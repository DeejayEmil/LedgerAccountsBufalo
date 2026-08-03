import { gql } from '@apollo/client';

export const TRANSACTIONS_QUERY = gql`
  query Transactions($filter: TransactionFilterInput!) {
    transactions(filter: $filter) {
      total
      page
      limit
      totalPages
      items {
        id
        accountId
        type
        amount
        balanceAfter
        description
        createdAt
      }
    }
  }
`;

export const BALANCE_SUMMARY_QUERY = gql`
  query BalanceSummary($accountId: String!) {
    balanceSummary(accountId: $accountId) {
      accountId
      currentBalance
      totalCredits
      totalDebits
      transactionCount
    }
  }
`;

export const CREATE_TRANSACTION_MUTATION = gql`
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      id
      accountId
      type
      amount
      balanceAfter
      description
      createdAt
    }
  }
`;

export const TRANSFER_MUTATION = gql`
  mutation TransferToAccount($input: TransferInput!) {
    transferToAccount(input: $input) {
      toAccountNumber
      sourceTransaction {
        id
        accountId
        type
        amount
        balanceAfter
        description
        createdAt
      }
    }
  }
`;

export const BALANCE_HISTORY_QUERY = gql`
  query BalanceHistory($accountId: String!, $days: Int) {
    balanceHistory(accountId: $accountId, days: $days) {
      date
      closingBalance
    }
  }
`;
