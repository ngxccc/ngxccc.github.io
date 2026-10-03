import type { Root, Literal, BlockContent } from "mdast";
import { visit } from "unist-util-visit";

// Regex kiểm tra xem chuỗi có chứa ký tự tiếng Việt có dấu hay không
const VIETNAMESE_ACCENTS_REGEX =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i;

/**
 * Remark plugin to replace standalone \rightarrow (or \to) with unicode arrow '→',
 * map unicode micro 'µ' in math to LaTeX standard `\mu`,
 * and remove Vietnamese text enclosed inside math blocks where KaTeX has no font metrics.
 */
export function remarkArrowNormalizer() {
  return (tree: Root) => {
    // 1. Chuẩn hóa inlineMath
    visit(tree, "inlineMath", (node: Literal, index, parent) => {
      if (!parent || typeof index !== "number" || typeof node.value !== "string") return;

      const trimmed = node.value.trim();
      if (trimmed === "\\rightarrow" || trimmed === "\\to" || trimmed === "\\longrightarrow") {
        parent.children.splice(index, 1, {
          type: "text",
          value: "→",
        });
        return;
      }
      if (trimmed === "\\leftarrow" || trimmed === "\\gets") {
        parent.children.splice(index, 1, {
          type: "text",
          value: "←",
        });
        return;
      }
      if (trimmed === "\\leftrightarrow") {
        parent.children.splice(index, 1, {
          type: "text",
          value: "↔",
        });
        return;
      }
      if (trimmed === "\\Rightarrow") {
        parent.children.splice(index, 1, {
          type: "text",
          value: "⇒",
        });
        return;
      }
      if (trimmed === "\\Leftarrow") {
        parent.children.splice(index, 1, {
          type: "text",
          value: "⇐",
        });
        return;
      }
      if (trimmed === "\\Leftrightarrow") {
        parent.children.splice(index, 1, {
          type: "text",
          value: "⇔",
        });
        return;
      }

      // Thay thế ký tự unicode micro 'µ' (U+00B5) thành lệnh LaTeX chuẩn \mu hoặc \text{µ}
      if (node.value.includes("µ")) {
        node.value = node.value.replace(/µ/g, "\\mu ");
      }

      // Nếu toàn bộ inlineMath thực chất là tiếng Việt bọc \text{...} hoặc văn bản tiếng Việt
      if (VIETNAMESE_ACCENTS_REGEX.test(node.value)) {
        const textOnly = node.value
          .replace(/\\text\{([^}]*)\}/g, "$1")
          .replace(/\\rightarrow/g, " → ")
          .replace(/\\to/g, " → ")
          .replace(/\\times/g, " × ")
          .replace(/\\approx/g, " ≈ ");
        parent.children.splice(index, 1, {
          type: "text",
          value: textOnly,
        });
      }
    });

    // 2. Chuẩn hóa display math (math)
    visit(tree, "math", (node: Literal, index, parent) => {
      if (!parent || typeof index !== "number" || typeof node.value !== "string") return;

      if (node.value.includes("µ")) {
        node.value = node.value.replace(/µ/g, "\\mu ");
      }

      if (VIETNAMESE_ACCENTS_REGEX.test(node.value)) {
        const textOnly = node.value
          .replace(/\\text\{([^}]*)\}/g, "$1")
          .replace(/\\rightarrow/g, " → ")
          .replace(/\\to/g, " → ")
          .replace(/\\times/g, " × ")
          .replace(/\\approx/g, " ≈ ");
        const blockquoteNode: BlockContent = {
          type: "blockquote",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", value: textOnly }],
            },
          ],
        };
        parent.children.splice(index, 1, blockquoteNode);
      }
    });
  };
}
