import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkObsidianWikilink } from "./src/plugins/remark-obsidian-wikilink";
import { remarkArrowNormalizer } from "./src/plugins/remark-arrow-normalizer";

// https://astro.build/config
export default defineConfig({
  site: "https://ngxccc.github.io",
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, remarkArrowNormalizer, remarkObsidianWikilink],
      rehypePlugins: [
        [
          rehypeKatex,
          {
            strict: "ignore",
            throwOnError: false,
          },
        ],
      ],
    }),
  },
});
