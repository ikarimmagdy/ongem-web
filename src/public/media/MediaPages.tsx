import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { US_MEDIA } from '../../region';
import { BrowserFrame, PhoneFrame } from '../art';
import { formatPostDate, posts, postBySlug, type Post } from './blog';
import { productLink } from '../content';
import { media } from './content';
import { has, t } from '../../i18n';
import { APP_SHOTS, WEB_SHOTS, type GalleryShot } from './gallery';
import { Markdown } from '../../i18n/markdown';
import {
  FEATURED,
  formatDuration,
  videoById,
  videoPoster,
  VIDEOS,
  videoSrc,
  videoSummary,
  videoTitle,
  videoTrack,
  type Video,
} from './videos';
import './media.css';

/**
 * One walkthrough: a branded poster with a play button first (OG-032 R23), then the native controls with captions on.
 * Nothing is downloaded until played.
 */
export function VideoPlayer({ video }: { video: Video }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const start = () => {
    setStarted(true);
    void ref.current?.play().catch(() => undefined);
  };
  return (
    <figure
      className={video.height > video.width ? 'pub-video pub-video--phone' : 'pub-video'}
      id={video.id}
      data-testid={`video-${video.id}`}
    >
      <div className="pub-video__stage">
        <video
          ref={ref}
          controls={started}
          preload="none"
          playsInline
          poster={videoPoster(video.id)}
          width={video.width}
          height={video.height}
          aria-label={videoTitle(video)}
          onPlay={() => setStarted(true)}
        >
          <source src={videoSrc(video.id)} type="video/webm" />
          <track
            kind="captions"
            src={videoTrack(video.id)}
            srcLang="en"
            label={media('captions_label')}
            default
          />
        </video>
        {!started && (
          <button
            type="button"
            className="pub-video__play"
            onClick={start}
            data-testid={`play-${video.id}`}
            aria-label={t('web.media.play_label', {
              title: videoTitle(video),
              duration: formatDuration(video.seconds),
            })}
          >
            <span className="pub-video__play-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M8 5.5v13l11-6.5z" /> {/* content-check: ignore */}
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption>
        <span className="pub-video__title">{videoTitle(video)}</span>
        <span className="pub-video__meta">{formatDuration(video.seconds)}</span>
        <span className="pub-video__summary">{videoSummary(video)}</span>
      </figcaption>
    </figure>
  );
}

/** Three featured walkthroughs, for the home and product pages. */
export function VideoStrip() {
  if (!US_MEDIA) return null;
  const featured = FEATURED.map(videoById).filter((v): v is Video => Boolean(v));
  return (
    <section
      className="pub-section pub-section--tint"
      aria-labelledby="video-strip"
      data-testid="video-strip"
    >
      <div className="pub-wrap">
        <h2 id="video-strip" className="pub-h2" data-reveal>
          {media('strip_title')}
        </h2>
        <p className="pub-lede" data-reveal>
          {media('strip_lede')}
        </p>
        <div className="pub-video-grid" data-reveal>
          {featured.map((v) => (
            <VideoPlayer key={v.id} video={v} />
          ))}
        </div>
        <p className="pub-more">
          <Link to="/videos">{media('all_videos')}</Link>
        </p>
      </div>
    </section>
  );
}

function Shot({ shot }: { shot: GalleryShot }) {
  const img = (
    <img
      src={shot.src}
      alt={t(`web.gallery.${shot.id}.alt`)}
      width={shot.width}
      height={shot.height}
      loading="eager"
      fetchPriority="low"
      decoding="async"
    />
  );
  return (
    <figure className={`pub-gallery__item pub-gallery__item--${shot.device}`}>
      {shot.device === 'phone' ? (
        <PhoneFrame>{img}</PhoneFrame>
      ) : shot.device === 'web' ? (
        <BrowserFrame address="app.ongem.com">{img}</BrowserFrame>
      ) : (
        <div className="pub-gallery__tablet">{img}</div>
      )}
      <figcaption>{t(`web.gallery.${shot.id}.caption`)}</figcaption>
    </figure>
  );
}

/** Web and app screens for the product page; loaded eagerly at low priority, so no frame is ever empty (OG-034 R1). */
export function Gallery() {
  if (!US_MEDIA) return null;
  return (
    <section className="pub-section" aria-labelledby="gallery" data-testid="gallery">
      <div className="pub-wrap">
        <h2 id="gallery" className="pub-h2" data-reveal>
          {media('gallery_title')}
        </h2>
        <p className="pub-lede" data-reveal>
          {media('gallery_lede')}
        </p>
        <h3 className="pub-h3">{media('gallery_web')}</h3>
        <div className="pub-gallery pub-gallery--web">
          {WEB_SHOTS.map((s) => (
            <Shot key={s.src} shot={s} />
          ))}
        </div>
        <h3 className="pub-h3">{media('gallery_app')}</h3>
        <div className="pub-gallery pub-gallery--app">
          {APP_SHOTS.map((s) => (
            <Shot key={s.src} shot={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Head({ title, lede }: { title: string; lede: string }) {
  return (
    <section className="pub-pagehead">
      <div className="pub-wrap">
        <h1 className="pub-display">{title}</h1>
        <p className="pub-lede">{lede}</p>
      </div>
    </section>
  );
}

function PostMeta({ post }: { post: Post }) {
  return (
    <p className="pub-post__meta">
      <time dateTime={post.date}>{formatPostDate(post.date)}</time>
      <span aria-hidden="true"> · </span>
      {t('web.media.by_author', { author: post.author })}
    </p>
  );
}

function BlogIndex() {
  return (
    <div data-testid="public-blog">
      <Head title={media('blog_title')} lede={media('blog_lede')} />
      <section className="pub-section">
        <div className="pub-wrap">
          <ul className="pub-posts">
            {posts().map((p) => (
              <li key={p.slug} className="pub-card pub-post-card" data-testid={`post-card-${p.slug}`}>
                <h2 className="pub-h3">
                  <Link to={`/blog/${p.slug}`}>{p.title}</Link>
                </h2>
                <PostMeta post={p} />
                <p>{p.summary}</p>
                <ul className="pub-tags" aria-label={t('web.media.tags')}>
                  {p.tags.map((tag) => (
                    <li key={tag}>
                      {has(`web.media.tag.${tag.replace(/-/g, '_')}`)
                        ? t(`web.media.tag.${tag.replace(/-/g, '_')}`)
                        : tag}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function BlogPost({ post }: { post: Post }) {
  const video = post.video ? videoById(post.video) : undefined;
  return (
    <article data-testid="public-post">
      <section className="pub-pagehead">
        <div className="pub-wrap pub-post__head">
          <p className="pub-eyebrow">
            <Link to="/blog">{media('back_to_blog')}</Link>
          </p>
          <h1 className="pub-display">{post.title}</h1>
          <PostMeta post={post} />
          <p className="pub-lede">{post.summary}</p>
        </div>
      </section>
      <section className="pub-section">
        <div className="pub-wrap pub-post">
          <div className="pub-prose">
            <Markdown source={post.body} />
          </div>
          {video && (
            <aside aria-label={media('watch_video')} className="pub-post__aside">
              <h2 className="pub-h3">{media('watch_video')}</h2>
              <VideoPlayer video={video} />
              {post.product && (
                <p className="pub-more">
                  <Link to={productLink(post.product)}>{media('see_product')}</Link>
                </p>
              )}
            </aside>
          )}
        </div>
      </section>
    </article>
  );
}

function Videos() {
  return (
    <div data-testid="public-videos">
      <Head title={media('videos_title')} lede={media('videos_lede')} />
      <section className="pub-section pub-section--after-head">
        <div className="pub-wrap">
          <div className="pub-video-grid pub-video-grid--all">
            {VIDEOS.map((v) => (
              <VideoPlayer key={v.id} video={v} />
            ))}
          </div>
          <p className="pub-draft-free">{media('videos_sample_note')}</p>
        </div>
      </section>
    </div>
  );
}

/** Title and description for a media page, for the page meta hook. */
export function mediaMeta(path: string): { title: string; description: string } {
  if (path === '/videos') return { title: media('videos_meta_title'), description: media('videos_lede') };
  const post = postBySlug(path.replace(/^\/blog\/?/, ''));
  if (post)
    return { title: t('web.media.post_meta_title', { title: post.title }), description: post.summary };
  return { title: media('blog_meta_title'), description: media('blog_lede') };
}

export function MediaPage({ path }: { path: string }) {
  if (path === '/videos') return <Videos />;
  const post = postBySlug(path.replace(/^\/blog\/?/, ''));
  if (post) return <BlogPost post={post} />;
  return <BlogIndex />;
}
