import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { MediaImage } from './media-image';
import { ClearFilters, CpfField, PhoneField, TextArea } from './ui';

function Controlled({ kind }: { readonly kind: 'cpf' | 'phone' | 'landline' }) {
  const [value, setValue] = useState('');

  return kind === 'cpf' ? (
    <CpfField label="CPF" value={value} onValueChange={setValue} />
  ) : (
    <PhoneField
      label="Telefone"
      value={value}
      onValueChange={setValue}
      allowLandline={kind === 'landline'}
    />
  );
}

describe('campos padronizados (docs/29 §3)', () => {
  it('aplica a máscara de CPF e acusa CPF inválido ao sair do campo', () => {
    render(<Controlled kind="cpf" />);

    const input = screen.getByLabelText('CPF');

    fireEvent.change(input, { target: { value: '52998224724' } });
    expect(input).toHaveValue('529.982.247-24');
    fireEvent.blur(input);
    expect(screen.getByText('CPF inválido. Confira os números.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '52998224725' } });
    fireEvent.blur(input);
    expect(screen.queryByText(/CPF inválido/)).not.toBeInTheDocument();
  });

  it('aplica a máscara de celular e recusa fixo quando não permitido', () => {
    render(<Controlled kind="phone" />);

    const input = screen.getByLabelText('Telefone');

    expect(input).toHaveAttribute('inputmode', 'tel');
    fireEvent.change(input, { target: { value: '6832220000' } });
    expect(input).toHaveValue('(68) 3222-0000');
    fireEvent.blur(input);
    expect(screen.getByText(/Celular inválido/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '68999990000' } });
    expect(input).toHaveValue('(68) 99999-0000');
  });

  it('aceita fixo quando permitido', () => {
    render(<Controlled kind="landline" />);

    const input = screen.getByLabelText('Telefone');

    fireEvent.change(input, { target: { value: '6832220000' } });
    fireEvent.blur(input);
    expect(screen.queryByText(/inválido/)).not.toBeInTheDocument();
  });

  it('mostra contador nos campos longos e destaca perto do limite', () => {
    const { rerender } = render(
      <TextArea label="Descrição" maxLength={200} value="abc" onChange={() => undefined} />
    );

    expect(screen.getByText('3/200')).not.toHaveClass('is-near');
    rerender(
      <TextArea
        label="Descrição"
        maxLength={200}
        value={'x'.repeat(190)}
        onChange={() => undefined}
      />
    );
    expect(screen.getByText('190/200')).toHaveClass('is-near');
    expect(screen.getByLabelText('Descrição')).toHaveAttribute('maxlength', '200');
  });

  it('não mostra contador em campos curtos', () => {
    render(<TextArea label="Apelido" maxLength={120} value="" onChange={() => undefined} />);

    expect(screen.queryByText('0/120')).not.toBeInTheDocument();
  });

  it('mostra "Limpar filtros" só com filtro ativo', () => {
    const onClear = jest.fn();
    const { rerender } = render(<ClearFilters active={0} onClear={onClear} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<ClearFilters active={2} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros (2)' }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('MediaImage', () => {
  it('usa a logo Fênix quando não há imagem', () => {
    const { container } = render(<MediaImage src={null} alt="" />);

    expect(container.querySelector('.media-frame')).toHaveClass('is-fallback');
    expect(container.querySelector('img')).toHaveAttribute('src', '/brand/logo-fenix.png');
  });

  it('troca para a logo quando a imagem falha ao carregar', () => {
    const { container } = render(<MediaImage src="/api/v1/media/x" alt="Capa" />);
    const img = container.querySelector('img') as HTMLImageElement;

    expect(img).toHaveAttribute('src', '/api/v1/media/x');
    fireEvent.error(img);
    expect(container.querySelector('.media-frame')).toHaveClass('is-fallback');
  });
});
