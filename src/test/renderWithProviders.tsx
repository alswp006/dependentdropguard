import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppDataProvider } from '@/state/AppDataContext';

export interface RenderWithProvidersOptions {
  route?: string;
  state?: unknown;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
  renderOptions?: Omit<RenderOptions, 'wrapper'>,
) {
  const { route = '/', state = null } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[{ pathname: route, state }]}>
        <AppDataProvider>{children}</AppDataProvider>
      </MemoryRouter>
    ),
    ...renderOptions,
  });
}
