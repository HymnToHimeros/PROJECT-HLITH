import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeakPost, postOf } from './LeakPost';

describe('a leak post in a finding', () => {
  it('shows the English first, marked, and the original on request', () => {
    const post = postOf({ post: { url: 'https://t.me/c/102', text: '绝区零 3.4 新角色', translation: 'ZZZ 3.4 new character', images: ['https://cdn5.telesco.pe/file/a', 'javascript:alert(1)'] } });
    if (!post) throw new Error('no post');
    expect(post.images).toEqual(['https://cdn5.telesco.pe/file/a']);
    render(<LeakPost post={post} />);
    expect(screen.getByText('ZZZ 3.4 new character')).toBeTruthy();
    expect(screen.getByText('Translated, may be inexact')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(screen.getByText('绝区零 3.4 新角色')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show translation' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: '1' }).getAttribute('href')).toBe('https://cdn5.telesco.pe/file/a');
  });

  it('an English post has no toggle; a payload without a post shows nothing', () => {
    const post = postOf({ post: { text: '#HSR 4.7 beta kit', images: [] } });
    if (!post) throw new Error('no post');
    render(<LeakPost post={post} />);
    expect(screen.getByText('#HSR 4.7 beta kit')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(postOf({ name: 'X' })).toBeNull();
    expect(postOf({ post: { text: ' ' } })).toBeNull();
  });
});
