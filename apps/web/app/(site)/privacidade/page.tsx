import type { Metadata } from 'next';

import { getPublicTeam } from '../../../lib/server-api';

export const metadata: Metadata = { title: 'Política de privacidade' };

const DEFAULT_POLICY = `O Fênix Vôlei trata dados pessoais somente para as finalidades informadas em cada formulário: contato com interessados, inscrições em seletivas, gestão de atletas, cobrança de mensalidades, pedidos da loja e comunicação do time.

Coletamos o mínimo necessário, não vendemos dados e não coletamos dados de saúde. Senhas são armazenadas com hash e dados financeiros sensíveis são cifrados.

Você pode solicitar acesso, correção ou exclusão dos seus dados pelos canais de contato do time.

O texto completo da política será publicado pela diretoria.`;

export default async function PrivacyPage() {
  const team = await getPublicTeam();

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Política de privacidade</h1>
      <div className="card prose">{team.privacyPolicy ?? DEFAULT_POLICY}</div>
    </div>
  );
}
