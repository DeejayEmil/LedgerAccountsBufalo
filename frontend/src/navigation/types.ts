export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Accounts: undefined;
  AccountDetail: { accountId: string };
  NewTransaction: { accountId: string };
};
