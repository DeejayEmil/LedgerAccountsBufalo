/**
 * Formatea un string decimal ("1234.50") como moneda legible ("$1,234.50").
 * El backend siempre manda montos como string (ver DECISIONS.md: se evita
 * Float para dinero), así que el formateo también trabaja sobre strings en
 * vez de convertir a Number innecesariamente para el separador de miles.
 */
export function formatMoney(amount: string, currency: string = 'USD'): string {
  const value = Number(amount);
  if (Number.isNaN(value)) {
    return amount;
  }

  const symbol = currency === 'USD' ? '$' : `${currency} `;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  return `${value < 0 ? '-' : ''}${symbol}${formatted}`;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
