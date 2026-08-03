import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formatea montos positivos con separador de miles y símbolo USD', () => {
    expect(formatMoney('1234.5', 'USD')).toBe('$1,234.50');
  });

  it('formatea montos negativos anteponiendo el signo antes del símbolo', () => {
    expect(formatMoney('-42.10', 'USD')).toBe('-$42.10');
  });

  it('usa el código de moneda como prefijo para monedas no-USD', () => {
    expect(formatMoney('100', 'MXN')).toBe('MXN 100.00');
  });

  it('devuelve el string original si no es un número válido', () => {
    expect(formatMoney('no-es-numero')).toBe('no-es-numero');
  });
});
