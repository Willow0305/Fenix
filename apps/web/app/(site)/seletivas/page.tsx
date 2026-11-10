import { permanentRedirect } from 'next/navigation';

/**
 * A lista de seletivas saiu do site (DT-099): as abertas aparecem em destaque no topo de
 * Eventos. Links antigos e favoritos para `/seletivas` vão para lá. A página de cada
 * seletiva (`/seletivas/<slug>`), com o formulário de inscrição, continua igual.
 */
export default function TryoutsPage(): never {
  permanentRedirect('/eventos#seletivas');
}
