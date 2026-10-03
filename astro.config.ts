import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import { remarkObsidianWikilink } from "./src/plugins/remark-obsidian-wikilink";

// https://astro.build/config
export default defineConfig({
  site: "https://ngxccc.github.io",
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkObsidianWikilink],
    }),
  },
});
