import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { listen } from '@tauri-apps/api/event';
import { HardwareTelemetryWidget } from '../HardwareTelemetryWidget';

describe('HardwareTelemetryWidget Component', () => {
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

  it('renders offline placeholder initially before receiving telemetry', () => {
    // Arrange & Act
    render(<HardwareTelemetryWidget />);

    // Assert
    expect(screen.getByText('Ollama Daemon Offline')).toBeInTheDocument();
    expect(screen.getByText('Waiting for connection...')).toBeInTheDocument();
    expect(listen).toHaveBeenCalledWith('telemetry_update', expect.any(Function));
  });

  it('renders offline placeholder if received telemetry status is offline', async () => {
    // Arrange
    render(<HardwareTelemetryWidget />);

    // Act
    await act(async () => {
      eventCallback({
        payload: {
          ollama: { status: 'offline', model_name: '', location_state: 'none', hybrid_percent: 0, total_size: 0, vram_size: 0 },
          hardware: { cpu_utilization: 0, gpu_utilization: 0, vram_used: 0, vram_total: 0 },
        },
      });
    });

    // Assert
    expect(screen.getByText('Ollama Daemon Offline')).toBeInTheDocument();
  });

  it('renders active GPU model telemetry with 100% GPU badge and utilization', async () => {
    // Arrange
    render(<HardwareTelemetryWidget />);

    // Act: Send live GPU telemetry
    await act(async () => {
      eventCallback({
        payload: {
          ollama: {
            status: 'running',
            model_name: 'gemma4:e4b',
            location_state: 'gpu',
            hybrid_percent: 100,
            total_size: 4900000000,
            vram_size: 4900000000,
          },
          hardware: {
            cpu_utilization: 12.5,
            gpu_utilization: 85.4,
            vram_used: 6 * 1024 * 1024 * 1024,
            vram_total: 16 * 1024 * 1024 * 1024,
          },
        },
      });
    });

    // Assert
    expect(screen.getByText('ACTIVE MODEL')).toBeInTheDocument();
    expect(screen.getByText('gemma4:e4b')).toBeInTheDocument();
    expect(screen.getByText(/100% GPU/)).toBeInTheDocument();
    expect(screen.getByText('GPU UTIL')).toBeInTheDocument();
    expect(screen.getByText('85.4%')).toBeInTheDocument();
    expect(screen.getByText('6.0')).toBeInTheDocument();
    expect(screen.getByText('/ 16.0 GB')).toBeInTheDocument();
  });

  it('renders CPU ONLY badge and CPU utilization when model runs on CPU', async () => {
    // Arrange
    render(<HardwareTelemetryWidget />);

    // Act
    await act(async () => {
      eventCallback({
        payload: {
          ollama: {
            status: 'running',
            model_name: 'gemma4:31b',
            location_state: 'cpu',
            hybrid_percent: 0,
            total_size: 33000000000,
            vram_size: 0,
          },
          hardware: {
            cpu_utilization: 94.2,
            gpu_utilization: 2.1,
            vram_used: 1 * 1024 * 1024 * 1024,
            vram_total: 16 * 1024 * 1024 * 1024,
          },
        },
      });
    });

    // Assert
    expect(screen.getByText(/CPU ONLY/)).toBeInTheDocument();
    expect(screen.getByText('CPU UTIL')).toBeInTheDocument();
    expect(screen.getByText('94.2%')).toBeInTheDocument();
  });

  it('renders HYBRID badge with percentage when model is partially offloaded', async () => {
    // Arrange
    render(<HardwareTelemetryWidget />);

    // Act
    await act(async () => {
      eventCallback({
        payload: {
          ollama: {
            status: 'running',
            model_name: 'gemma4:26b',
            location_state: 'hybrid',
            hybrid_percent: 65,
            total_size: 28000000000,
            vram_size: 18000000000,
          },
          hardware: {
            cpu_utilization: 45.0,
            gpu_utilization: 70.0,
            vram_used: 18 * 1024 * 1024 * 1024,
            vram_total: 24 * 1024 * 1024 * 1024,
          },
        },
      });
    });

    // Assert
    expect(screen.getByText(/HYBRID \(65%\)/)).toBeInTheDocument();
  });

  it('cleans up IPC event listener on unmount', async () => {
    // Arrange
    const { unmount } = render(<HardwareTelemetryWidget />);
    // Wait for the async listen() call in useEffect to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Act
    unmount();

    // Assert
    expect(unlistenSpy).toHaveBeenCalled();
  });
});
