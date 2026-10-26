import { fireEvent, render, screen } from '@testing-library/react';

import { ProductGallery } from './product-gallery';
import { moveItem } from './product-images-manager';
import { QuantityStepper } from './quantity-stepper';
import { TextField } from './ui';

describe('loja', () => {
  it('move a foto de lugar sem perder as outras', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('quantidade respeita mínimo, máximo e recusa letras', () => {
    const onChange = jest.fn();

    render(<QuantityStepper label="Quantidade de Camisa" value={2} max={3} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar' }));
    expect(onChange).toHaveBeenLastCalledWith(3);

    const input = screen.getByRole('textbox', { name: 'Quantidade de Camisa' });

    fireEvent.change(input, { target: { value: '9a' } });
    expect(input).toHaveValue('9');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('campo de valor mostra vírgula e entrega ponto', () => {
    const onChange = jest.fn((event: { target: { value: string } }) => event.target.value);

    render(<TextField label="Preço" numeric="decimal" value="89.9" onChange={onChange} />);

    const input = screen.getByLabelText(/Preço/);

    expect(input).toHaveValue('89,9');
    fireEvent.change(input, { target: { value: '12,5x' } });
    expect(onChange.mock.results[0]?.value).toBe('12.5');
  });

  it('galeria troca a foto pela miniatura e pelas setas', () => {
    const images = [
      { id: '1', url: '/a.webp', altText: 'Frente' },
      { id: '2', url: '/b.webp', altText: 'Costas' }
    ];

    render(<ProductGallery images={images} productName="Camisa" />);

    expect(screen.getByRole('button', { name: 'Ampliar foto: Frente' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver foto 2' }));
    expect(screen.getByRole('button', { name: 'Ampliar foto: Costas' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Próxima foto' })[0]!);
    expect(screen.getByRole('button', { name: 'Ampliar foto: Frente' })).toBeInTheDocument();
  });
});
