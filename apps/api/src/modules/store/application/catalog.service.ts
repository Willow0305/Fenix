import { Injectable } from '@nestjs/common';

import { ProductFieldsService } from './product-fields.service';
import { CatalogReader } from './catalog-view';
import { CatalogCategoriesService } from './catalog-categories.service';
import { ProductsService } from './products.service';
import { ProductImagesService } from './product-images.service';

export { interestFree, iso } from './catalog-view';
export type {
  ProductCategoryView,
  VariantView,
  PersonalizationFieldView,
  PersonalizationFieldInput,
  ProductSummary,
  ProductDetail,
  ProductInput,
  VariantInput,
  ProductRow
} from './catalog-view';

/**
 * Catálogo da loja (RF-015, RF-035, RCF-007/008). Fachada com os mesmos métodos de antes da divisão
 * (PEN-077): cada um repassa ao serviço do assunto — leitura (`CatalogReader`), categorias,
 * campos de personalização, produtos e fotos. Os outros módulos continuam usando esta classe.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly productFields: ProductFieldsService,
    private readonly reader: CatalogReader,
    private readonly catalogCategories: CatalogCategoriesService,
    private readonly products: ProductsService,
    private readonly productImages: ProductImagesService
  ) {}

  createField(
    ...args: Parameters<ProductFieldsService['createField']>
  ): ReturnType<ProductFieldsService['createField']> {
    return this.productFields.createField(...args);
  }

  updateField(
    ...args: Parameters<ProductFieldsService['updateField']>
  ): ReturnType<ProductFieldsService['updateField']> {
    return this.productFields.updateField(...args);
  }

  /** Exclusão lógica: pedidos já feitos guardam a própria cópia da personalização. */
  deleteField(
    ...args: Parameters<ProductFieldsService['deleteField']>
  ): ReturnType<ProductFieldsService['deleteField']> {
    return this.productFields.deleteField(...args);
  }

  categories(
    ...args: Parameters<CatalogReader['categories']>
  ): ReturnType<CatalogReader['categories']> {
    return this.reader.categories(...args);
  }

  createCategory(
    ...args: Parameters<CatalogCategoriesService['createCategory']>
  ): ReturnType<CatalogCategoriesService['createCategory']> {
    return this.catalogCategories.createCategory(...args);
  }

  updateCategory(
    ...args: Parameters<CatalogCategoriesService['updateCategory']>
  ): ReturnType<CatalogCategoriesService['updateCategory']> {
    return this.catalogCategories.updateCategory(...args);
  }

  /** Vitrine pública: somente produtos ativos e de parceiros aprovados (RN-PAR-001). */
  publicList(
    ...args: Parameters<CatalogReader['publicList']>
  ): ReturnType<CatalogReader['publicList']> {
    return this.reader.publicList(...args);
  }

  publicDetail(
    ...args: Parameters<CatalogReader['publicDetail']>
  ): ReturnType<CatalogReader['publicDetail']> {
    return this.reader.publicDetail(...args);
  }

  adminList(
    ...args: Parameters<CatalogReader['adminList']>
  ): ReturnType<CatalogReader['adminList']> {
    return this.reader.adminList(...args);
  }

  adminDetail(
    ...args: Parameters<CatalogReader['adminDetail']>
  ): ReturnType<CatalogReader['adminDetail']> {
    return this.reader.adminDetail(...args);
  }

  /**
   * Novo plano de afiliação pela aba Afiliação: é um produto da loja (carrinho, pagamento e
   * estorno iguais), na categoria "Afiliação", criada na primeira vez se não existir.
   */
  createMembership(
    ...args: Parameters<ProductsService['createMembership']>
  ): ReturnType<ProductsService['createMembership']> {
    return this.products.createMembership(...args);
  }

  create(...args: Parameters<ProductsService['create']>): ReturnType<ProductsService['create']> {
    return this.products.create(...args);
  }

  update(...args: Parameters<ProductsService['update']>): ReturnType<ProductsService['update']> {
    return this.products.update(...args);
  }

  /** "Exclusão" de produto é arquivamento auditado com motivo (RF-024). */
  setStatus(
    ...args: Parameters<ProductsService['setStatus']>
  ): ReturnType<ProductsService['setStatus']> {
    return this.products.setStatus(...args);
  }

  addVariant(
    ...args: Parameters<ProductsService['addVariant']>
  ): ReturnType<ProductsService['addVariant']> {
    return this.products.addVariant(...args);
  }

  updateVariant(
    ...args: Parameters<ProductsService['updateVariant']>
  ): ReturnType<ProductsService['updateVariant']> {
    return this.products.updateVariant(...args);
  }

  addImage(
    ...args: Parameters<ProductImagesService['addImage']>
  ): ReturnType<ProductImagesService['addImage']> {
    return this.productImages.addImage(...args);
  }

  /** Ordem das fotos; a primeira é a capa (DT-051). */
  reorderImages(
    ...args: Parameters<ProductImagesService['reorderImages']>
  ): ReturnType<ProductImagesService['reorderImages']> {
    return this.productImages.reorderImages(...args);
  }

  updateImageAlt(
    ...args: Parameters<ProductImagesService['updateImageAlt']>
  ): ReturnType<ProductImagesService['updateImageAlt']> {
    return this.productImages.updateImageAlt(...args);
  }

  removeImage(
    ...args: Parameters<ProductImagesService['removeImage']>
  ): ReturnType<ProductImagesService['removeImage']> {
    return this.productImages.removeImage(...args);
  }

  /** Exclusão lógica só sem uso (docs/29 COR-022); em uso, a resposta sugere inativar. */
  deleteCategory(
    ...args: Parameters<CatalogCategoriesService['deleteCategory']>
  ): ReturnType<CatalogCategoriesService['deleteCategory']> {
    return this.catalogCategories.deleteCategory(...args);
  }
}
