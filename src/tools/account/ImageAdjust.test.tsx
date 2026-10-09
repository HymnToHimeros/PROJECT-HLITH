import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageAdjust } from './ImageAdjust';

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2000, height: 1000, close: vi.fn() })));
  URL.createObjectURL = vi.fn(() => 'blob:picked');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const setup = (kind: 'avatar' | 'banner' = 'avatar') => {
  const onSave = vi.fn();
  render(<ImageAdjust kind={kind} source={new Blob(['x'], { type: 'image/png' })} background="#000" bannerBackground="#000" other={null} name="Mira" onCancel={vi.fn()} onSave={onSave} />);
  return { onSave };
};

/** The big picture inside the frame (the first one; the preview has its own copy). */
const framePicture = () => screen.getByRole('application').querySelector('img') as HTMLImageElement;

describe('Adjust picture', () => {
  it('opens as a dialog with the frame, zoom controls, Fit, Fill, Reset and a how-to', async () => {
    setup();
    expect(await screen.findByRole('application', { name: /Adjust picture: drag or use the arrow keys/ })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Adjust picture' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveAttribute('aria-valuetext', '100%');
    for (const name of ['Zoom in', 'Zoom out', 'Fill', 'Fit', 'Reset', 'Use this picture']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fill' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('How to adjust the picture')).toBeInTheDocument();
  });

  it('arrow keys move the picture, + zooms, 0 resets', async () => {
    setup();
    const frame = await screen.findByRole('application');
    const left0 = parseFloat(framePicture().style.left);
    fireEvent.keyDown(frame, { key: 'ArrowRight' });
    expect(parseFloat(framePicture().style.left)).toBeGreaterThan(left0);
    fireEvent.keyDown(frame, { key: '+' });
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveAttribute('aria-valuetext', '115%');
    fireEvent.keyDown(frame, { key: '0' });
    expect(parseFloat(framePicture().style.left)).toBeCloseTo(left0);
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveAttribute('aria-valuetext', '100%');
  });

  it('Zoom out is off at Fill; Fit allows zooming out and says the edges show the background', async () => {
    setup('banner');
    await screen.findByRole('application');
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(screen.getByRole('button', { name: 'Fit' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Edges with no picture/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    expect(screen.queryByText(/Edges with no picture/)).toBeNull();
  });
});
