import sanitizeHtml from 'sanitize-html'

/**
 * Sanitize article HTML content for safe server-side rendering.
 *
 * SEO-relevant transforms:
 * - `<h1>` is downgraded to `<h2>` so the page-level `<h1>` (article title)
 *   stays the unique top-level heading and outline algorithms agree.
 * - All `<a>` tags get `target="_blank"` and `rel="noopener noreferrer nofollow"`
 *   so outbound community links don't leak ranking signal.
 * - Only safe inline + block tags allowed; `<script>`, `<iframe>`, and any
 *   non-allowed attributes are stripped.
 */
export function sanitizeArticleHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'h6',
      'pre', 'code', 'a', 'hr', 'img', 'figure', 'figcaption', 'video',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      video: ['src', 'controls', 'preload', 'class', 'width', 'height'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      h1: 'h2',
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      }),
    },
  })
}
