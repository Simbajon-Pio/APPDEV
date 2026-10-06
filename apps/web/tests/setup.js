import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { vi } from 'vitest';

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: ({ value }) => createElement('div', { role: 'img', 'aria-label': `QR code for ${value}` }),
}));
