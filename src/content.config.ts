import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One markdown file per post in src/content/posts/. The file name is the
// URL slug: src/content/posts/foo.md -> /posts/foo/
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    draft: z.boolean().default(false), // drafts build locally, never deploy
  }),
});

export const collections = { posts };
