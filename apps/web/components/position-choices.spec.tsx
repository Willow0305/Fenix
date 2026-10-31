import { fireEvent, render, screen } from '@testing-library/react';

import { PositionChoices, togglePosition } from './position-choices';

describe('posições do atleta', () => {
  it('aceita várias; "Ainda não sei" não combina com as outras', () => {
    const two = togglePosition(['Levantador(a)'], 'Ponteiro(a)', true);

    expect(two).toEqual(['Levantador(a)', 'Ponteiro(a)']);
    expect(togglePosition(two, 'Ainda não sei', true)).toEqual(['Ainda não sei']);
    expect(togglePosition(['Ainda não sei'], 'Central', true)).toEqual(['Central']);
    expect(togglePosition(two, 'Levantador(a)', false)).toEqual(['Ponteiro(a)']);
  });

  it('mantém visível a posição antiga fora da lista e avisa a mudança', () => {
    const onChange = jest.fn();

    render(<PositionChoices legend="Posições" value={['Oposto']} onChange={onChange} />);

    expect(screen.getByRole('group', { name: 'Posições' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Oposto' })).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Líbero' }));

    expect(onChange).toHaveBeenCalledWith(['Oposto', 'Líbero']);
  });
});
