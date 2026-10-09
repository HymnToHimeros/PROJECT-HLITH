import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';

it('renders the name with Ð and Á', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'HLIÐSKJÁLF' })).toBeInTheDocument();
});
