import { redirect } from 'next/navigation';

/** Endereço antigo: a carteirinha agora fica na aba Afiliação (DT-072). */
export default function MovedPage() {
  redirect('/admin/afiliacao/carteirinhas');
}
