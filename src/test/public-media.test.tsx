/// <reference types="node" />
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DemoOnGemApi } from '../api/demo';
import { parsePost, POSTS } from '../public/media/blog';
import { APP_SHOTS, WEB_SHOTS } from '../public/media/gallery';
import { Markdown } from '../i18n/markdown';
import { isMediaPath } from '../public/media/paths';
import { VIDEOS } from '../public/media/videos';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderApp } from './render';

const root = join(__dirname, '..', '..');

/** OG-032 R14 to R16: the product gallery, the founder blog and the walkthrough videos. */
describe('public media (OG-032)', () => {
  it('gallery_web_and_app_screens_AC_R14_1', () => {
    renderApp('/product', { mode: 'none' });
    const gallery = screen.getByTestId('gallery');
    const imgs = within(gallery).getAllByRole('img');
    expect(imgs).toHaveLength(WEB_SHOTS.length + APP_SHOTS.length);
    expect(WEB_SHOTS.length).toBeGreaterThanOrEqual(6);
    expect(APP_SHOTS.some((s) => s.device === 'tablet')).toBe(true);
    for (const img of imgs) {
      expect(img.getAttribute('alt')).toMatch(/sample data/);
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
    }
  });

  it('blog_index_lists_every_post_newest_first_AC_R15_1', () => {
    renderApp('/blog', { mode: 'none' });
    expect(screen.getByTestId('public-blog')).toBeInTheDocument();
    expect(POSTS.length).toBeGreaterThanOrEqual(5);
    for (const p of POSTS) {
      const card = screen.getByTestId(`post-card-${p.slug}`);
      expect(within(card).getByRole('link', { name: p.title })).toHaveAttribute('href', `/blog/${p.slug}`);
      expect(p.author).toBe('Karim Magdy');
    }
    const dates = POSTS.map((p) => p.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(document.title).toMatch(/Blog/);
  });

  it('blog_post_renders_with_its_video_and_product_link_AC_R15_2', () => {
    renderApp('/blog/approvals-and-the-one-person-company', { mode: 'none' });
    const post = screen.getByTestId('public-post');
    expect(within(post).getByRole('heading', { level: 1 })).toHaveTextContent('one-person company');
    expect(post).toHaveTextContent('Waiting for OnGem to approve it');
    expect(within(post).getByTestId('video-ongem-approves-one-person-company')).toBeInTheDocument();
    expect(within(post).getByRole('link', { name: 'See it in the product' })).toHaveAttribute(
      'href',
      '/product#approvals',
    );
    expect(document.title).toMatch(/one-person company \| OnGem/);
  });

  it('every_post_links_a_recorded_video_and_a_product_page_AC_R15_3', () => {
    const ids = new Set(VIDEOS.map((v) => v.id));
    for (const p of POSTS) {
      expect(p.video && ids.has(p.video)).toBe(true);
      expect(p.product).toMatch(/^\/(product|partners)/);
      expect(p.body).not.toMatch(/[–—]/);
      for (const m of p.body.matchAll(/\(\/videos#([a-z0-9-]+)\)/g)) expect(ids.has(m[1]!)).toBe(true);
    }
  });

  it('unknown_post_is_not_a_public_page_AC_R15_4', () => {
    expect(isMediaPath('/blog')).toBe(true);
    expect(isMediaPath('/videos')).toBe(true);
    expect(isMediaPath(`/blog/${POSTS[0]!.slug}`)).toBe(true);
    expect(isMediaPath('/blog/not-a-post')).toBe(false);
    renderApp('/blog/not-a-post', { mode: 'none' });
    expect(screen.queryByTestId('public-post')).not.toBeInTheDocument();
    expect(screen.getByTestId('explore-demo')).toBeInTheDocument();
  });

  it('markdown_renders_elements_never_html_AC_R15_5', () => {
    const { container } = render(
      <MemoryRouter>
        <Markdown
          source={
            '## Head\n\nA **bold** [link](/product) <img src=x onerror=alert(1)>\n\n- one\n- two\n\n> quote'
          }
        />
      </MemoryRouter>,
    );
    expect(container.querySelector('h2')).toHaveTextContent('Head');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(
      render(
        <MemoryRouter>
          <Markdown source={'_Coming soon: more._'} />
        </MemoryRouter>,
      ).container.querySelector('em'),
    ).toHaveTextContent('Coming soon: more.');
    expect(container.querySelector('a')).toHaveAttribute('href', '/product');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('blockquote')).toHaveTextContent('quote');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(() => parsePost('bad', 'no front matter')).toThrow();
  });

  it('videos_page_with_captions_and_posters_AC_R16_1', () => {
    renderApp('/videos', { mode: 'none' });
    expect(screen.getByTestId('public-videos')).toBeInTheDocument();
    expect(VIDEOS.length).toBeGreaterThanOrEqual(7);
    expect(VIDEOS.some((v) => v.height > v.width)).toBe(true);
    for (const v of VIDEOS) {
      const fig = screen.getByTestId(`video-${v.id}`);
      const video = fig.querySelector('video')!;
      // Native controls appear once played; before that the branded play button stands in (OG-032 R23).
      expect(within(fig).getByRole('button', { name: new RegExp(v.title) })).toBeInTheDocument();
      expect(video).toHaveAttribute('preload', 'none');
      expect(video.getAttribute('poster')).toMatch(new RegExp(`videos/${v.id}\\.jpg$`));
      expect(video.querySelector('source')!.getAttribute('src')).toMatch(
        new RegExp(`videos/${v.id}\\.webm$`),
      );
      const track = video.querySelector('track')!;
      expect(track).toHaveAttribute('kind', 'captions');
      expect(track.getAttribute('src')).toMatch(new RegExp(`videos/${v.id}\\.vtt$`));
    }
  });

  it('video_files_exist_and_stay_small_AC_R16_2', () => {
    for (const v of VIDEOS) {
      for (const ext of ['webm', 'vtt', 'jpg'])
        expect(existsSync(join(root, 'public/videos', `${v.id}.${ext}`))).toBe(true);
      const size = statSync(join(root, 'public/videos', `${v.id}.webm`)).size;
      expect(size).toBe(v.bytes);
      expect(size).toBeLessThan(8_000_000);
      expect(v.seconds).toBeGreaterThan(5);
    }
  });

  it('home_and_product_feature_three_walkthroughs_AC_R16_3', () => {
    for (const path of ['/', '/product']) {
      const { unmount } = renderApp(path, { mode: 'none' });
      const strip = screen.getByTestId('video-strip');
      expect(within(strip).getAllByRole('figure')).toHaveLength(3);
      expect(within(strip).getByRole('link', { name: 'All walkthroughs' })).toHaveAttribute(
        'href',
        '/videos',
      );
      unmount();
    }
  });

  it('nav_has_videos_and_blog_and_marks_a_post_as_blog_AC_R15_6', () => {
    renderApp('/blog/virtual-cards-and-card-safety', { mode: 'none' });
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'Videos' })).toHaveAttribute('href', '/videos');
    expect(within(nav).getByRole('link', { name: 'Blog' })).toHaveAttribute('aria-current', 'page');
  });

  it('one_person_demo_shows_ongem_approval_AC_R16_4', async () => {
    const api = new DemoOnGemApi({ approvalBy: 'ONGEM', stepUp: async () => true });
    const p = await api.createTopUp({
      fundingSourceId: 'fsrc_demo_main',
      toAccountId: 'acc_demo_ops',
      amountMinor: 80_000,
      currency: 'USD',
    });
    expect(p.approvalBy).toBe('ONGEM');
    expect(new DemoOnGemApi().approvalBy).toBe('COMPANY');
  });

  it('media_pages_pass_axe_AC_R14_2', async () => {
    for (const path of ['/blog', '/videos', `/blog/${POSTS[0]!.slug}`]) {
      const { container, unmount } = renderApp(path, { mode: 'none' });
      const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(
        r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
      ).toEqual([]);
      unmount();
    }
  });

  it('videos_show_a_branded_play_button_that_starts_playback_AC_R23_1', async () => {
    renderApp('/videos', { mode: 'none' });
    const v = VIDEOS[0]!;
    const fig = screen.getByTestId(`video-${v.id}`);
    const video = fig.querySelector('video')!;
    expect(video).not.toHaveAttribute('controls');
    const play = within(fig).getByRole('button', { name: new RegExp(v.title) });
    video.play = () => Promise.resolve();
    await userEvent.click(play);
    expect(within(fig).queryByRole('button', { name: new RegExp(v.title) })).not.toBeInTheDocument();
    expect(video).toHaveAttribute('controls');
  });
});
