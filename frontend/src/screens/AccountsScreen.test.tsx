import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { MockedProvider } from '@apollo/client/testing/react';
import { AccountsScreen } from './AccountsScreen';
import { ACCOUNTS_QUERY } from '../api/graphql/accounts';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.Mock;

function renderScreen(mocks: unknown[]) {
  return render(
    <MockedProvider mocks={mocks as never}>
      <AccountsScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
    </MockedProvider>,
  );
}

describe('AccountsScreen', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'ana@example.com', fullName: 'Ana Pérez' },
      logout: jest.fn(),
      updateUser: jest.fn(),
    });
  });

  it('muestra el estado vacío cuando el usuario no tiene cuentas', async () => {
    const mocks = [
      {
        request: { query: ACCOUNTS_QUERY },
        result: { data: { accounts: [] } },
      },
    ];

    const { findByText } = await renderScreen(mocks);

    expect(await findByText('Todavía no tienes cuentas')).toBeTruthy();
  });

  it('lista las cuentas devueltas por la API', async () => {
    const mocks = [
      {
        request: { query: ACCOUNTS_QUERY },
        result: {
          data: {
            accounts: [
              {
                __typename: 'Account',
                id: 'acc-1',
                accountNumber: '1234567890',
                type: 'CHECKING',
                currency: 'USD',
                balance: '150.00',
                createdAt: new Date().toISOString(),
              },
            ],
          },
        },
      },
    ];

    const { findByText } = await renderScreen(mocks);

    expect(await findByText('$150.00')).toBeTruthy();
    expect(await findByText('Nº de cuenta: 1234567890')).toBeTruthy();
  });
});
