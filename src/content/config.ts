import { defineCollection, z } from 'astro:content';

const notesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.date(),
    tags: z.array(z.string()),
    'website-folder': z.string().optional(), // e.g., "computational-biology", "tutorials/python"
    draft: z.boolean().optional(),
  }),
});

export const collections = {
  notes: notesCollection,
};
