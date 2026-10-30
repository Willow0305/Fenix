import { render } from '@testing-library/react';

import { NewsViewBeacon } from './news-view-beacon';

describe('contagem de leitura (D5, DT-081)', () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('conta uma vez por aba, sem credenciais nem dados da pessoa', () => {
    const { unmount } = render(<NewsViewBeacon slug="final" />);

    unmount();
    render(<NewsViewBeacon slug="final" />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/news/final/view', {
      method: 'POST',
      keepalive: true
    });
  });

  it('notícias diferentes contam separadamente', () => {
    render(<NewsViewBeacon slug="a" />);
    render(<NewsViewBeacon slug="b" />);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
