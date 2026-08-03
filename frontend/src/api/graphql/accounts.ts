import { gql } from '@apollo/client';

export const ACCOUNT_FIELDS = gql`
  fragment AccountFields on Account {
    id
    accountNumber
    type
    currency
    balance
    createdAt
  }
`;

export const ACCOUNTS_QUERY = gql`
  query Accounts {
    accounts {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;

export const ACCOUNT_QUERY = gql`
  query Account($id: ID!) {
    account(id: $id) {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;

export const CREATE_ACCOUNT_MUTATION = gql`
  mutation CreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
      ...AccountFields
    }
  }
  ${ACCOUNT_FIELDS}
`;
