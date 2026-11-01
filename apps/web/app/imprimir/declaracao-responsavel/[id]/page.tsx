'use client';

import { useParams } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { RequireAuth } from '../../../../components/require-auth';
import { Alert, Loading } from '../../../../components/ui';
import type { PublicTeam } from '../../../../lib/api-types';
import { formatDate } from '../../../../lib/format';
import type { AthleteDetail } from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';

/**
 * Declaração do responsável para a conta do atleta menor (DT-092), para imprimir e assinar.
 * Modelo provisório: o texto precisa de revisão jurídica antes de dados reais (PEN-010).
 */
function Declaration() {
  const { id } = useParams<{ id: string }>();
  const athlete = useResource<AthleteDetail>(`/athletes/${id}`);
  const team = useResource<PublicTeam>('/public/team');

  if (!athlete.data) {
    return athlete.error ? <Alert kind="error">{athlete.error}</Alert> : <Loading />;
  }

  const a = athlete.data;
  const club = team.data?.officialName ?? 'Time Fênix Volleyball';

  return (
    <div className="guardian-declaration stack">
      <div className="no-print stack">
        <p className="muted m-0">
          Imprima, peça a um dos responsáveis para preencher e assinar, e envie a foto ou o PDF da
          declaração assinada na ficha do atleta.
        </p>
        <div>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Icon name="printer" /> Imprimir
          </button>
        </div>
      </div>

      <article className="stack">
        <h1 className="m-0">Declaração de autorização do responsável</h1>
        <p>
          Eu, <span className="blank" />, responsável legal (relação com o atleta:{' '}
          <span className="blank short" />
          ), documento de identidade nº <span className="blank" />, autorizo a criação de uma conta
          pessoal no site do {club} para o atleta <strong>{a.fullName}</strong>
          {a.birthDate ? `, nascido(a) em ${formatDate(a.birthDate)}` : ''}, que faz parte de uma
          equipe do time.
        </p>
        <p>Declaro estar ciente de que:</p>
        <ul>
          <li>
            a conta dá acesso à área do atleta (ficha, equipes, mensalidades, pedidos e avisos) e
            fica no e-mail informado à diretoria;
          </li>
          <li>
            enquanto o atleta for menor de 18 anos, a conta não participa do fórum e o perfil fica
            privado;
          </li>
          <li>
            os dados são tratados conforme a Política de Privacidade publicada no site, somente para
            a participação esportiva e o atendimento do atleta;
          </li>
          <li>
            posso pedir a qualquer momento, à diretoria, o acesso, a correção ou a exclusão dos
            dados, ou o encerramento da conta.
          </li>
        </ul>
        <div className="signature-lines">
          <p>
            Local e data: <span className="blank" />
          </p>
          <p>
            Assinatura do responsável: <span className="blank long" />
          </p>
          <p>
            Telefone do responsável: <span className="blank" />
          </p>
        </div>
      </article>
    </div>
  );
}

export default function GuardianDeclarationPage() {
  return (
    <RequireAuth>
      <Declaration />
    </RequireAuth>
  );
}
