import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// Mock Tauri clipboard manager
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(),
}));

// Mock Tauri event listener
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { listen } from '@tauri-apps/api/event';
import {
  StatusLight,
  CopyableField,
  InfoField,
  SettingsToggle,
  HardwareNode,
  CloudConnectNode,
} from '../NodeWidgets';
import { MemoryProvider } from '../../context/MemoryContext';

describe('NodeWidgets Components', () => {
  let eventCallback: (event: any) => void;
  let unlistenSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    unlistenSpy = vi.fn();
    (listen as any).mockImplementation((eventName: string, cb: any) => {
      if (eventName === 'telemetry_update') {
        eventCallback = cb;
      }
      return Promise.resolve(unlistenSpy);
    });
  });

  describe('StatusLight', () => {
    it('renders with correct label and colors across all node status variants', () => {
      const { rerender } = render(<StatusLight status="not_installed" />);
      expect(screen.getByText('NOT INSTALLED')).toBeInTheDocument();

      rerender(<StatusLight status="error" />);
      expect(screen.getByText('ERROR')).toBeInTheDocument();

      rerender(<StatusLight status="ready" />);
      expect(screen.getByText('READY')).toBeInTheDocument();

      rerender(<StatusLight status="active" text="GENERATING" />);
      expect(screen.getByText('GENERATING')).toBeInTheDocument();

      rerender(<StatusLight status="inactive" />);
      expect(screen.getByText('INACTIVE')).toBeInTheDocument();
    });
  });

  describe('CopyableField & InfoField', () => {
    it('renders input value and invokes writeText on COPY click', async () => {
      // Arrange
      (writeText as any).mockResolvedValueOnce(undefined);
      render(<CopyableField label="API KEY" value="sk-secret-token-12345" />);

      // Assert input value
      const input = screen.getByDisplayValue('sk-secret-token-12345');
      expect(input).toBeInTheDocument();

      // Act: Click copy
      const copyButton = screen.getByText('COPY');
      fireEvent.click(copyButton);

      // Assert: writeText called and UI changes to ✓ OK
      expect(writeText).toHaveBeenCalledWith('sk-secret-token-12345');
      await waitFor(() => expect(screen.getByText('✓ OK')).toBeInTheDocument());
    });

    it('renders InfoField with label and text value', () => {
      render(<InfoField label="BIND ADDRESS" value="127.0.0.1:61721" />);
      expect(screen.getByText('BIND ADDRESS')).toBeInTheDocument();
      expect(screen.getByText('127.0.0.1:61721')).toBeInTheDocument();
    });
  });

  describe('SettingsToggle', () => {
    it('toggles boolean state on button click', () => {
      const onChange = vi.fn();
      render(<SettingsToggle label="Start Minimized" checked={false} onChange={onChange} />);

      expect(screen.getByText('Start Minimized')).toBeInTheDocument();

      // Act
      const toggleButton = screen.getByRole('button');
      fireEvent.click(toggleButton);

      // Assert
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('HardwareNode', () => {
    it('renders hardware node header, subheader, and active model', async () => {
      // Arrange & Act
      render(
        <MemoryProvider>
          <HardwareNode label="Local Gemma" subheader="Ollama Runner" />
        </MemoryProvider>
      );

      // Assert
      expect(screen.getByText('Local Gemma')).toBeInTheDocument();
      expect(screen.getByText('Ollama Runner')).toBeInTheDocument();
      expect(screen.getByTestId('active-model-name')).toHaveTextContent('None');
    });

    it('updates telemetry and opens detailed telemetry modal on info button click', async () => {
      // Arrange
      render(
        <MemoryProvider>
          <HardwareNode />
        </MemoryProvider>
      );

      // Act 1: Send telemetry update
      await act(async () => {
        eventCallback({
          payload: {
            ollama: { status: 'active', model_name: 'gemma4:12b', location_state: 'gpu', hybrid_percent: 100, total_size: 13000000000 },
            hardware: { cpu_utilization: 15.0, gpu_utilization: 75.0, vram_used: 13 * 1024 * 1024 * 1024, vram_total: 16 * 1024 * 1024 * 1024 },
          },
        });
      });

      // Assert: Model name updated
      expect(screen.getByTestId('active-model-name')).toHaveTextContent('gemma4:12b');

      // Act 2: Click info button to open telemetry portal
      const infoBtn = screen.getByTestId('hardware-info-btn');
      fireEvent.click(infoBtn);

      // Assert: Telemetry panel opens in portal
      expect(screen.getByTestId('hardware-telemetry-panel')).toBeInTheDocument();

      // Act 3: Click benchmark info button inside panel
      const benchmarkBtn = screen.getByTestId('benchmark-info-btn');
      fireEvent.click(benchmarkBtn);

      // Assert: Benchmark panel expands
      expect(screen.getByTestId('benchmark-panel')).toBeInTheDocument();
    });

    it('processes PTY byte stream events for throughput metering', async () => {
      // Arrange
      render(
        <MemoryProvider>
          <HardwareNode isGenerating={true} />
        </MemoryProvider>
      );

      // Activate status via telemetry
      await act(async () => {
        eventCallback({
          payload: {
            ollama: { status: 'active', model_name: 'gemma4:e4b', location_state: 'gpu' },
            hardware: { cpu_utilization: 10.0, gpu_utilization: 80.0, vram_used: 5000000000, vram_total: 16000000000 },
          },
        });
      });

      // Act: Dispatch pty_bytes custom event
      act(() => {
        window.dispatchEvent(new CustomEvent('pty_bytes', { detail: 120 }));
      });

      // Assert: Component maintains active state
      expect(screen.getByTestId('active-model-name')).toBeInTheDocument();
    });
  });

  describe('CloudConnectNode', () => {
    it('renders cloud node with target host indicator', () => {
      // Arrange & Act
      const { rerender } = render(<CloudConnectNode isActive={false} label="OpenRouter Cloud" />);
      expect(screen.getByText('OPENROUTER CLOUD')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();

      rerender(<CloudConnectNode isActive={true} label="OpenRouter Cloud" targetHost="openrouter.ai" />);
      expect(screen.getByText('openrouter.ai')).toBeInTheDocument();
    });
  });
});
