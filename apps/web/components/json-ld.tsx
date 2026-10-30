/**
 * Dados estruturados (JSON-LD) para buscadores. O `<` vira `<` para o texto da
 * diretoria nunca fechar a tag `<script>` (DT-034: conteúdo é texto, não HTML).
 */
export function JsonLd({ data }: { readonly data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
