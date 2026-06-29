import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true
});

Object.defineProperty(navigator, 'canShare', {
  value: vi.fn(() => false),
  configurable: true
});

Object.defineProperty(navigator, 'share', {
  value: vi.fn().mockResolvedValue(undefined),
  configurable: true
});
