import { todayCivil } from './format';

/** Idade completa a partir de data civil `YYYY-MM-DD` (mesma regra da API). */
export function ageFrom(birthDate: string, today: string = todayCivil()): number | null {
  const birth = birthDate.split('-').map(Number);
  const ref = today.split('-').map(Number);

  if (birth.length !== 3 || birth.some(Number.isNaN)) {
    return null;
  }

  const [by, bm, bd] = birth as [number, number, number];
  const [ry, rm, rd] = ref as [number, number, number];
  let age = ry - by;

  if (rm < bm || (rm === bm && rd < bd)) {
    age -= 1;
  }

  return age;
}
