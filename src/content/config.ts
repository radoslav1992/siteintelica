import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
    loader: glob({ pattern: '**/[^_]*.md', base: "./src/content/blog" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.date(),
        author: z.string().default('SiteIntelica Team'),
        image: z.string().optional(),
        tags: z.array(z.string()).optional()
    })
});

export const collections = {
    'blog': blogCollection
};
