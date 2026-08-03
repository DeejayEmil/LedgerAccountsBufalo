import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.Mock;
const navigate = jest.fn();

// @testing-library/react-native v14 es async de punta a punta (concurrent
// rendering de React 19): tanto `render()` como cada `fireEvent.*` devuelven
// una Promise y deben esperarse con await, o el estado no llega a
// actualizarse antes de la siguiente aserción.
function renderScreen() {
  return render(
    <LoginScreen
      navigation={{ navigate } as never}
      route={{ key: 'Login', name: 'Login', params: undefined } as never}
    />,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('mantiene el botón de ingresar deshabilitado hasta llenar el formulario', async () => {
    mockedUseAuth.mockReturnValue({ login: jest.fn() });
    const { findByTestId, getByTestId } = await renderScreen();

    const submitButton = await findByTestId('login-submit');
    expect(submitButton.props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(getByTestId('login-email'), 'ana@example.com');
    await fireEvent.changeText(getByTestId('login-password'), 'Str0ngP@ssword');

    expect(getByTestId('login-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('llama a login con las credenciales ingresadas', async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ login });
    const { findByTestId, getByTestId } = await renderScreen();

    await findByTestId('login-email');
    await fireEvent.changeText(getByTestId('login-email'), 'Ana@Example.com');
    await fireEvent.changeText(getByTestId('login-password'), 'Str0ngP@ssword');
    await fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('ana@example.com', 'Str0ngP@ssword');
    });
  });

  it('muestra un mensaje de error si login falla', async () => {
    const login = jest.fn().mockRejectedValue(new Error('Credenciales inválidas'));
    mockedUseAuth.mockReturnValue({ login });
    const { findByTestId, getByTestId, findByText } = await renderScreen();

    await findByTestId('login-email');
    await fireEvent.changeText(getByTestId('login-email'), 'ana@example.com');
    await fireEvent.changeText(getByTestId('login-password'), 'incorrecta');
    await fireEvent.press(getByTestId('login-submit'));

    expect(await findByText('No se pudo iniciar sesión.')).toBeTruthy();
  });
});
