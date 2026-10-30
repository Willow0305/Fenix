import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { ProductDetail } from '../../../../lib/store-types';
import { ProductPurchase } from './product-purchase';

let authStatus: 'authenticated' | 'anonymous' = 'authenticated';
let alertedIds: string[] = [];
const api = jest.fn();
const reload = jest.fn();

jest.mock('../../../../lib/auth-context', () => ({
  useAuth: () => ({ status: authStatus })
}));
jest.mock('../../../../lib/cart-context', () => ({
  useCart: () => ({ cart: null, setQuantity: jest.fn() })
}));
jest.mock('../../../../lib/use-resource', () => ({
  useResource: (path: string | null) => ({
    data: path?.startsWith('/me/stock-alerts') ? { variantIds: alertedIds } : undefined,
    reload
  })
}));
jest.mock('../../../../lib/api-client', () => ({
  api: (...args: unknown[]) => api(...args),
  errorMessage: () => 'Falha'
}));

const soldOut = {
  id: 'p1',
  slug: 'camisa',
  name: 'Camisa',
  fulfillmentType: 'STOCK',
  purchasable: true,
  priceFrom: { amount: '80.00' },
  buyerLimit: null,
  sizeGuide: null,
  personalizationFields: [],
  variants: [
    {
      id: 'v1',
      name: 'P',
      isActive: true,
      inStock: false,
      lowStock: false,
      price: { amount: '80.00' },
      listPrice: { amount: '80.00' }
    }
  ]
} as unknown as ProductDetail;

describe('avise-me quando chegar na página do produto', () => {
  beforeEach(() => {
    authStatus = 'authenticated';
    alertedIds = [];
    api.mockReset().mockResolvedValue(undefined);
    reload.mockReset();
  });

  it('sem conta, convida a entrar e volta para o produto', () => {
    authStatus = 'anonymous';
    render(<ProductPurchase product={soldOut} />);

    expect(screen.getByRole('link', { name: /Entre para ser avisado/ })).toHaveAttribute(
      'href',
      '/entrar?next=/loja/camisa'
    );
  });

  it('com conta, pede o aviso da opção esgotada', async () => {
    render(<ProductPurchase product={soldOut} />);
    fireEvent.click(screen.getByRole('button', { name: /Avise-me quando chegar/ }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/me/stock-alerts/v1', { method: 'PUT' }));
    expect(reload).toHaveBeenCalled();
  });

  it('com aviso pedido, mostra a situação e permite cancelar', async () => {
    alertedIds = ['v1'];
    render(<ProductPurchase product={soldOut} />);

    expect(screen.getByText(/Você será avisado quando chegar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancelar aviso/ }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/me/stock-alerts/v1', { method: 'DELETE' })
    );
  });
});
