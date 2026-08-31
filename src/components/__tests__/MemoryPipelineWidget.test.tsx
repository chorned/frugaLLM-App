import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryPipelineWidget } from '../MemoryPipelineWidget';
import { MemoryProvider } from '../../context/MemoryContext';
import { HardwareProfile, MemorySegments } from '../../services/memoryCalculator';

describe('MemoryPipelineWidget Component', () => {
  const discreteProfile: HardwareProfile = {
    is_unified: false,
    dedicated_vram: 16 * 1024 * 1024 * 1024,
    system_ram: 32 * 1024 * 1024 * 1024,
    execution_ceiling: 16 * 1024 * 1024 * 1024,
    os_architecture: 'linux-x86_64',
  };

  const unifiedProfile: HardwareProfile = {
    is_unified: true,
    dedicated_vram: 0,
    system_ram: 16 * 1024 * 1024 * 1024,
    execution_ceiling: 14 * 1024 * 1024 * 1024,
    os_architecture: 'macos-aarch64',
  };

  const normalSegments: MemorySegments = {
    phase: 'preflight',
    weights_bytes: 4.9 * 1024 * 1024 * 1024,
    context_128k_bytes: 3.10 * 1024 * 1024 * 1024,
    overhead_bytes: 524_288_000,
    total_projected_bytes: 8.5 * 1024 * 1024 * 1024,
    execution_ceiling_bytes: 16 * 1024 * 1024 * 1024,
    spillover_bytes: 0,
    spillover_type: 'none',
    triggers_warning: false,
    warning_message: '',
    is_unknown: false,
  };

  const spilloverSegments: MemorySegments = {
    phase: 'live',
    weights_bytes: 33.0 * 1024 * 1024 * 1024,
    context_128k_bytes: 10.36 * 1024 * 1024 * 1024,
    overhead_bytes: 524_288_000,
    total_projected_bytes: 43.86 * 1024 * 1024 * 1024,
    execution_ceiling_bytes: 16 * 1024 * 1024 * 1024,
    spillover_bytes: 27.86 * 1024 * 1024 * 1024,
    spillover_type: 'system_ram',
    triggers_warning: true,
    warning_message: 'Model & 128k context exceed Dedicated VRAM. Spillover will route across PCIe into System RAM.',
    is_unknown: false,
  };

  it('renders full widget with pre-flight estimation and discrete GPU architecture badge', () => {
    // Arrange & Act
    render(
      <MemoryProvider>
        <MemoryPipelineWidget segments={normalSegments} hardwareProfile={discreteProfile} />
      </MemoryProvider>
    );

    // Assert
    expect(screen.getByTestId('memory-pipeline-widget')).toBeInTheDocument();
    expect(screen.getByTestId('memory-phase-badge')).toHaveTextContent('PRE-FLIGHT ESTIMATION');
    expect(screen.getByTestId('architecture-badge')).toHaveTextContent('Discrete GPU (Dedicated VRAM)');
    expect(screen.getByTestId('segment-weights')).toBeInTheDocument();
    expect(screen.getByTestId('segment-context')).toBeInTheDocument();
    expect(screen.getByTestId('segment-overhead')).toBeInTheDocument();
    expect(screen.queryByTestId('segment-spillover')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spillover-warning-banner')).not.toBeInTheDocument();
  });

  it('renders LIVE RUNTIME badge, spillover segment, and warning banner when model exceeds ceiling', () => {
    // Arrange & Act
    render(
      <MemoryProvider>
        <MemoryPipelineWidget segments={spilloverSegments} hardwareProfile={discreteProfile} />
      </MemoryProvider>
    );

    // Assert
    expect(screen.getByTestId('memory-phase-badge')).toHaveTextContent('LIVE RUNTIME');
    expect(screen.getByTestId('segment-spillover')).toBeInTheDocument();
    const warningBanner = screen.getByTestId('spillover-warning-banner');
    expect(warningBanner).toBeInTheDocument();
    expect(warningBanner).toHaveTextContent(/PCIe/);
  });

  it('renders Apple Silicon Unified Memory architecture badge and SSD swap warning on unified spillover', () => {
    // Arrange
    const ssdSwapSegments: MemorySegments = {
      ...spilloverSegments,
      spillover_type: 'ssd_swap',
      warning_message: 'Memory exceeds available Unified Memory. Severe disk paging & performance degradation will occur.',
    };

    // Act
    render(
      <MemoryProvider>
        <MemoryPipelineWidget segments={ssdSwapSegments} hardwareProfile={unifiedProfile} />
      </MemoryProvider>
    );

    // Assert
    expect(screen.getByTestId('architecture-badge')).toHaveTextContent('Apple Silicon (Unified Memory)');
    const warningBanner = screen.getByTestId('spillover-warning-banner');
    expect(warningBanner).toHaveTextContent('Severe SSD Swap Warning:');
    expect(warningBanner).toHaveTextContent(/Severe disk paging/);
  });

  it('computes fresh segments when modelTag prop is explicitly provided', () => {
    // Arrange & Act
    render(
      <MemoryProvider>
        <MemoryPipelineWidget modelTag="gemma4:12b" hardwareProfile={discreteProfile} />
      </MemoryProvider>
    );

    // Assert
    expect(screen.getByTestId('total-required-stat')).toHaveTextContent('17.1 GB');
    expect(screen.getByTestId('hardware-ceiling-stat')).toHaveTextContent('16.0 GB');
  });

  it('renders unknown model state with striped bar when model tag is unrecognized', () => {
    // Arrange
    const unknownSegments: MemorySegments = {
      phase: 'preflight',
      weights_bytes: 0,
      context_128k_bytes: 0,
      overhead_bytes: 0,
      total_projected_bytes: 0,
      execution_ceiling_bytes: 16 * 1024 * 1024 * 1024,
      spillover_bytes: 0,
      spillover_type: 'none',
      triggers_warning: false,
      warning_message: '',
      is_unknown: true,
    };

    // Act
    render(
      <MemoryProvider>
        <MemoryPipelineWidget segments={unknownSegments} hardwareProfile={discreteProfile} />
      </MemoryProvider>
    );

    // Assert
    expect(screen.getByTestId('segment-unknown')).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN FOOTPRINT')).toBeInTheDocument();
    expect(screen.getByTestId('total-required-stat')).toHaveTextContent('Unknown');
  });

  it('renders compact mode with condensed progress bar', () => {
    // Arrange & Act
    render(
      <MemoryProvider>
        <MemoryPipelineWidget compact={true} segments={normalSegments} hardwareProfile={discreteProfile} />
      </MemoryProvider>
    );

    // Assert
    expect(screen.getByTestId('compact-memory-stacked-bar')).toBeInTheDocument();
    expect(screen.getByText('Pre-Flight 128k Allocation')).toBeInTheDocument();
    expect(screen.getByText('ESTIMATED')).toBeInTheDocument();
  });
});
