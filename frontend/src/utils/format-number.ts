/** "1300000" or 1300000 -> "1,300,000"; empty/invalid -> "". Digits only. */
export function formatThousands(value: number | string): string {
  const digits = String(value).replace(/\D/g, '');
  if (digits === '') return '';
  return Number(digits).toLocaleString('en-US');
}

/** "1,300,000" -> 1300000; empty -> 0. Digits only. */
export function parseThousands(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits === '' ? 0 : Number(digits);
}
