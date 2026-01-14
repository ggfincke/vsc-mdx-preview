// Tests for Starlight Steps component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Steps } from './Steps';

describe('Steps', () => {
  it('renders children in container', () => {
    render(
      <Steps>
        <ol>
          <li>Step one</li>
          <li>Step two</li>
        </ol>
      </Steps>
    );

    expect(screen.getByText('Step one')).toBeInTheDocument();
    expect(screen.getByText('Step two')).toBeInTheDocument();
  });

  it('applies mdx-preview-starlight-steps class', () => {
    const { container } = render(
      <Steps>
        <ol>
          <li>Step content</li>
        </ol>
      </Steps>
    );

    const stepsDiv = container.querySelector('.mdx-preview-starlight-steps');
    expect(stepsDiv).toBeInTheDocument();
  });
});
