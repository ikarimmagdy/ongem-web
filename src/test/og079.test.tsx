import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { AuthProvider, NO_AUTH } from '../auth/session';
import { bundledBrand, setBrand } from '../lib/brand';
import { isPublicPath, legalSlugs, movedPath, navLinks } from '../public/content';
import { posts, postBySlug, withoutVideoLinks } from '../public/media/blog';
import { videos } from '../public/media/videos';
import { shareImage, socialTags } from '../public/seo';
import { demoLegal, SITE } from '../public/site';
import { recordedMedia } from '../region';

/** OG-079: a white-label demo under another brand shows nothing that carries the default brand. */
const BRAND = /ongem/i;

function renderPublic(route: string) {
  return render(
    <AuthProvider value={NO_AUTH}>
      <MemoryRouter initialEntries={[route]}>
        <App initialMode="none" />
      </MemoryRouter>
    </AuthProvider>,
  );
}

const harbor = () => act(() => setBrand(bundledBrand('harbor')));

afterEach(() => {
  act(() => setBrand(bundledBrand()));
  sessionStorage.clear();
  vi.unstubAllEnvs();
});

describe('OG-079 white-label demo', () => {
  it('OG079_recorded_media_only_under_the_default_brand', () => {
    expect(recordedMedia()).toBe(true);
    expect(videos().length).toBeGreaterThan(0);
    expect(isPublicPath('/videos')).toBe(true);
    harbor();
    expect(recordedMedia()).toBe(false);
    expect(videos()).toEqual([]);
    expect(isPublicPath('/videos')).toBe(false);
    expect(movedPath('/videos')).toBe('/blog');
    expect(JSON.stringify(navLinks())).not.toContain('/videos');
  });

  it('OG079_blog_without_the_default_brands_story_or_video_links', () => {
    expect(postBySlug('from-genzone-to-ongem')).toBeDefined();
    harbor();
    expect(postBySlug('from-genzone-to-ongem')).toBeUndefined();
    for (const p of posts()) {
      expect(p.slug).not.toMatch(BRAND);
      expect(p.body).not.toContain('](/videos');
      expect(p.video).toBeUndefined();
    }
    expect(withoutVideoLinks('One.\n\nWatch [it](/videos#x).\n\nTwo.')).toBe('One.\n\nTwo.');
  });

  it('OG079_share_tags_and_site_url_follow_the_brand', () => {
    expect(shareImage('en')).toMatch(/\/og\/ongem-us-en\.png$/);
    harbor();
    expect(SITE.url).toBe('https://app.harbor.example');
    expect(shareImage('en')).toBeNull();
    const { og, twitter } = socialTags('/', { title: 'T', description: 'D' }, 'en');
    expect(og.find(([k]) => k === 'og:image')?.[1]).toBeNull();
    expect(twitter.find(([k]) => k === 'twitter:card')?.[1]).toBe('summary');
    expect(JSON.stringify([og, twitter])).not.toMatch(BRAND);
  });

  it('OG079_demo_legal_texts_name_the_brand_only_in_demo_mode', async () => {
    harbor();
    expect(demoLegal()).toBe(false);
    vi.stubEnv('VITE_DEMO_SITE', 'true');
    expect(demoLegal()).toBe(true);
    expect(legalSlugs()).toEqual(['terms', 'privacy', 'cookies', 'disclosures']);
    const { container } = renderPublic('/legal/terms');
    expect(await screen.findByTestId('legal-demo')).toBeInTheDocument();
    expect(screen.getByTestId('legal-demo-note')).toHaveTextContent('Harbor demo');
    expect(container.textContent).toContain('Harbor Financial Inc. offers Harbor.');
    expect(container.textContent).not.toMatch(BRAND);
  });

  it('OG079_the_default_brand_keeps_its_legal_pages_in_a_demo_site', () => {
    vi.stubEnv('VITE_DEMO_SITE', 'true');
    sessionStorage.setItem('ongem.demo', '1');
    expect(demoLegal()).toBe(false);
  });

  it('OG079_no_default_brand_name_on_the_harbor_public_home', async () => {
    harbor();
    const { container } = renderPublic('/');
    expect(await screen.findByTestId('public-home')).toBeInTheDocument();
    const shown = [
      container.textContent ?? '',
      ...Array.from(container.querySelectorAll('img, source, video, a'), (e) =>
        ['src', 'srcset', 'poster', 'href', 'alt'].map((a) => e.getAttribute(a) ?? '').join(' '),
      ),
    ].join('\n');
    expect(shown).not.toMatch(BRAND);
  });
});
