/** wa.me link with a prefilled message; 10-digit numbers are treated as Indian (+91). */
export const waLink = (phone: string | null | undefined, text: string) => {
  const digits = String(phone ?? '').replace(/[^\d]/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
};
