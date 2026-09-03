import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  OpenRouterIcon,
  OllamaIcon,
  GeminiIcon,
  HermesIcon,
  OpenCodeIcon,
  FrugaLLMIcon,
  getProviderIcon,
} from '../ProviderIcons';

describe('ProviderIcons', () => {
  it('renders FrugaLLMIcon with custom size and accessible title', () => {
    render(<FrugaLLMIcon size={14} title="FrugaLLM" data-testid="frugallm-icon" />);
    const icon = screen.getByTestId('frugallm-icon');
    expect(icon).toBeInTheDocument();
    expect(screen.getByTitle('FrugaLLM')).toBeInTheDocument();
    expect(icon).toHaveAttribute('width', '14');
    expect(icon).toHaveAttribute('height', '14');
  });

  it('renders OpenRouterIcon with accessible title and default size', () => {
    render(<OpenRouterIcon title="OpenRouter" data-testid="openrouter-icon" />);
    const icon = screen.getByTestId('openrouter-icon');
    expect(icon).toBeInTheDocument();
    expect(screen.getByTitle('OpenRouter')).toBeInTheDocument();
    expect(icon).toHaveAttribute('width', '18');
    expect(icon).toHaveAttribute('height', '18');
  });

  it('renders OllamaIcon with custom size and accessible title', () => {
    render(<OllamaIcon size={24} title="Ollama" data-testid="ollama-icon" />);
    const icon = screen.getByTestId('ollama-icon');
    expect(icon).toBeInTheDocument();
    expect(screen.getByTitle('Ollama')).toBeInTheDocument();
    expect(icon).toHaveAttribute('width', '24');
    expect(icon).toHaveAttribute('height', '24');
  });

  it('renders GeminiIcon with accessible title', () => {
    render(<GeminiIcon title="Gemini" data-testid="gemini-icon" />);
    const icon = screen.getByTestId('gemini-icon');
    expect(icon).toBeInTheDocument();
    expect(screen.getByTitle('Gemini')).toBeInTheDocument();
  });

  it('renders HermesIcon with accessible title', () => {
    render(<HermesIcon title="Hermes" data-testid="hermes-icon" />);
    const icon = screen.getByTestId('hermes-icon');
    expect(icon).toBeInTheDocument();
    expect(screen.getByTitle('Hermes')).toBeInTheDocument();
  });

  it('renders OpenCodeIcon with accessible title', () => {
    render(<OpenCodeIcon title="OpenCode" data-testid="opencode-icon" />);
    const icon = screen.getByTestId('opencode-icon');
    expect(icon).toBeInTheDocument();
    expect(screen.getByTitle('OpenCode')).toBeInTheDocument();
  });

  it('renders with aria-hidden="true" when title is omitted', () => {
    render(<OllamaIcon data-testid="decorative-icon" />);
    const icon = screen.getByTestId('decorative-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTitle('Ollama')).toBeNull();
  });

  describe('getProviderIcon', () => {
    it('resolves icons correctly based on node id or provider name', () => {
      const or = render(<>{getProviderIcon('node-openrouter')}</>);
      expect(or.container.querySelector('svg')).toBeInTheDocument();

      const ol = render(<>{getProviderIcon('node-ollama')}</>);
      expect(ol.container.querySelector('svg')).toBeInTheDocument();

      const gm = render(<>{getProviderIcon('node-google')}</>);
      expect(gm.container.querySelector('svg')).toBeInTheDocument();

      const hm = render(<>{getProviderIcon('node-hermes')}</>);
      expect(hm.container.querySelector('svg')).toBeInTheDocument();

      const oc = render(<>{getProviderIcon('node-opencode')}</>);
      expect(oc.container.querySelector('svg')).toBeInTheDocument();

      const fl = render(<>{getProviderIcon('node-frugallm')}</>);
      expect(fl.container.querySelector('svg')).toBeInTheDocument();
    });

    it('returns null for unknown provider strings', () => {
      expect(getProviderIcon('unknown-provider')).toBeNull();
    });
  });
});
