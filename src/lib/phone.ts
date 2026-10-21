// Téléphone français : 10 chiffres commençant par 0 (ou +33 suivi de 9 chiffres).
// Renvoie le numéro sous la forme 0612345678, ou null s'il n'est pas valable.
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, "");
  if (/^0[1-9]\d{8}$/.test(compact)) return compact;
  if (/^\+33[1-9]\d{8}$/.test(compact)) return "0" + compact.slice(3);
  return null;
}

/** 0612345678 -> 06 12 34 56 78 */
export function formatPhone(phone: string): string {
  return phone.replace(/(\d{2})(?=\d)/g, "$1 ");
}
