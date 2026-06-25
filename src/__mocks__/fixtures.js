export const POST = (n, extra = {}) => ({
  id: n,
  slug: `post-${n}`,
  title: { rendered: `Post ${n}` },
  date: "2025-01-01",
  link: "/",
  ...extra,
});

export const POST_WITH_CONTENT = (n, content = `Content ${n}`) =>
  POST(n, { content: { rendered: `<p>${content}</p>` } });

export const POST_WITH_EXCERPT = (n) =>
  POST(n, { excerpt: { rendered: `<p>Excerpt ${n}</p>` } });

export const PAGE = (n) => ({
  id: n,
  slug: `page-${n}`,
  title: { rendered: `Page ${n}` },
  link: "/",
});

export const CATEGORY = (n) => ({
  id: n,
  slug: `cat-${n}`,
  name: `Cat ${n}`,
  link: "/",
});

export const TAG = (n) => ({
  id: n,
  slug: `tag-${n}`,
  name: `Tag ${n}`,
  link: "/",
});

export const COMMENT = (id, author = "Alice", content = "Great post!") => ({
  id,
  author_name: author,
  date: "2025-01-01T00:00:00",
  content: { rendered: `<p>${content}</p>` },
});

export const makeFetchResult = (posts, total = posts.length) => ({
  ok: true,
  headers: { get: () => String(total) },
  json: async () => posts,
});

export const makePager = () => ({ current: null });

export const makeConfig = (o = {}) => ({
  current: { font: 22, posts: 10, theme: "a", order: "desc", glow: 0, ...o },
});

export const makeContext = (o = {}) => ({
  current: { type: null, id: null, name: null, ...o },
});
