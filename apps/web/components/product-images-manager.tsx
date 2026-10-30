import type { ProductDetail } from '../lib/store-types';
import { ImageGalleryManager } from './image-gallery-manager';

export { moveItem } from './image-gallery-manager';

/**
 * Fotos do produto no painel (DT-051). A primeira foto é a capa na vitrine, no carrinho e no
 * compartilhamento.
 */
export function ProductImagesManager({
  productId,
  images,
  onChange
}: {
  readonly productId: string;
  readonly images: ProductDetail['images'];
  readonly onChange: (detail: ProductDetail) => void;
}) {
  return (
    <ImageGalleryManager<ProductDetail>
      imagesOf={(detail) => detail.images}
      basePath={`/store/products/${productId}/images`}
      images={images}
      onChange={onChange}
      max={12}
      firstIsCover
      noun="por produto"
      intro="A primeira foto é a capa. Arraste para mudar a ordem ou use as setas. A descrição ajuda quem usa leitor de tela e aparece na busca."
      emptyText="Nenhuma foto ainda. Produtos com foto vendem mais."
      placeholder="Ex.: camisa vermelha, frente"
      removeDescription="A foto sai da loja. Pedidos antigos não são afetados."
    />
  );
}
