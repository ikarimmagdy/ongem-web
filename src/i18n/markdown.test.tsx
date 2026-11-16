import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { inline } from './markdown';

describe('OG-050 markdown links', () => {
  it('keeps paths, https and mailto links and drops any other scheme to text', () => {
    render(
      <MemoryRouter>
        <p>
          {inline(
            '[a](/pricing) [b](https://ongem.com) [c](mailto:security@ongem.com) [d](javascript:alert(1)) [e](data:text/html,x)',
          )}
        </p>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'a' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: 'b' })).toHaveAttribute('rel', 'noreferrer noopener');
    expect(screen.getByRole('link', { name: 'c' })).toHaveAttribute('href', 'mailto:security@ongem.com');
    expect(screen.queryByRole('link', { name: 'd' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'e' })).toBeNull();
    expect(screen.getByText(/d/)).toBeInTheDocument();
  });
});
