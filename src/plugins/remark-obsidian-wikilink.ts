import type { Root, PhrasingContent } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Remark plugin to transform [[Note_Title]] or [[Note_Title|Display Text]]
 * into markdown links pointing to /notes/Note_Title.
 */
export function remarkObsidianWikilink() {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || typeof index !== "number" || !node.value) return;

      const regex = /\[\[(.*?)\]\]/g;
      if (!regex.test(node.value)) return;

      regex.lastIndex = 0;
      const parts: PhrasingContent[] = [];
      let lastIndex = 0;
      let match = regex.exec(node.value);

      while (match !== null) {
        const pre = node.value.slice(lastIndex, match.index);
        if (pre) {
          parts.push({ type: "text", value: pre });
        }

        const raw = match[1];
        let target = raw;
        let alias = raw;

        if (raw.includes("|")) {
          const split = raw.split("|");
          target = split[0].trim();
          alias = split[1].trim();
        }

        // Clean anchor if any (e.g., Note#heading)
        const cleanTarget = target.split("#")[0].trim();
        const slug = cleanTarget.replace(/\s+/g, "_");

        parts.push({
          type: "link",
          url: `/notes/${slug}`,
          children: [{ type: "text", value: alias || cleanTarget }],
        });

        lastIndex = match.index + match[0].length;
        match = regex.exec(node.value);
      }

      const post = node.value.slice(lastIndex);
      if (post) {
        parts.push({ type: "text", value: post });
      }

      parent.children.splice(index, 1, ...parts);
    });
  };
}
