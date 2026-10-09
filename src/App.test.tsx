import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';

it('renders the shell with the name', () => {
  render(<App />);
  expect(screen.getAllByText('HLIÐSKJÁLF').length).toBeGreaterThan(0);
});
