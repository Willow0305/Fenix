/**
 * Direitos de quem compra na loja (DT-070), mostrados no checkout e em Termos. Texto fixo:
 * não depende da diretoria para existir, porque vem do Código de Defesa do Consumidor.
 */
export function ConsumerRights({ compact = false }: { readonly compact?: boolean }) {
  if (compact) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Compra pela internet: você pode desistir em até 7 dias depois de receber, com estorno
        integral (exceto itens personalizados). Todo item tem garantia contra defeito por 90 dias.
      </p>
    );
  }

  return (
    <section className="card stack" aria-labelledby="direitos-loja">
      <h2 id="direitos-loja" style={{ margin: 0 }}>
        Seus direitos nas compras da loja
      </h2>
      <ul className="stack" style={{ gap: '0.4rem', margin: 0 }}>
        <li>
          <strong>Desistência (art. 49 do CDC):</strong> até 7 dias depois de receber o pedido (ou
          da ativação, na afiliação), sem precisar dizer o motivo, com estorno integral. Peça em
          Minha conta → Pedidos (ou em Consultar pedido, se comprou sem conta). Pedido ainda não
          retirado também pode ser desistido.
        </li>
        <li>
          <strong>Itens personalizados</strong> (nome, número etc.) são feitos sob medida e não têm
          desistência por arrependimento.
        </li>
        <li>
          <strong>Defeito (arts. 18 e 26 do CDC):</strong> qualquer item, inclusive personalizado,
          tem garantia por 90 dias depois de receber; a diretoria resolve com troca, conserto ou
          estorno.
        </li>
        <li>
          <strong>Entrega comprovada:</strong> os prazos contam a partir da foto da entrega feita
          pela diretoria ou de quando você toca em &quot;Recebi&quot; no pedido.
        </li>
      </ul>
    </section>
  );
}
