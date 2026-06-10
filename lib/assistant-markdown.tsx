import React from "react";
import { ScrollView, Text, View } from "react-native";
import { RenderRules } from "react-native-markdown-display";

function trimCodeContent(content: string): string {
  if (typeof content !== "string") return "";
  return content.endsWith("\n") ? content.slice(0, -1) : content;
}

function CodeBlockScroll({
  nodeKey,
  content,
  textStyle,
}: {
  nodeKey: string;
  content: string;
  textStyle: object;
}) {
  return (
    <ScrollView
      key={nodeKey}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      style={{ width: "100%", maxWidth: "100%", flexGrow: 0 }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Text style={textStyle}>{content}</Text>
    </ScrollView>
  );
}

/** Close dangling code fences so the rest of the message does not swallow the footer. */
export function normalizeAssistantMarkdown(content: string): string {
  if (!content) return content;
  const fenceCount = (content.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) {
    return `${content}\n\`\`\``;
  }
  return content;
}

export function createAssistantMarkdownRules(): RenderRules {
  return {
    body: (node, children, parent, styles) => (
      <View
        key={node.key}
        style={[styles._VIEW_SAFE_body, { width: "100%", maxWidth: "100%", overflow: "hidden" }]}
      >
        {children}
      </View>
    ),
    fence: (node, _children, _parent, styles, inheritedStyles = {}) => {
      const content = trimCodeContent(node.content);
      return (
        <CodeBlockScroll
          nodeKey={node.key}
          content={content}
          textStyle={[inheritedStyles, styles.fence]}
        />
      );
    },
    code_block: (node, _children, _parent, styles, inheritedStyles = {}) => {
      const content = trimCodeContent(node.content);
      return (
        <CodeBlockScroll
          nodeKey={node.key}
          content={content}
          textStyle={[inheritedStyles, styles.code_block]}
        />
      );
    },
    table: (node, children, _parent, styles) => (
      <ScrollView
        key={node.key}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        style={{ width: "100%", maxWidth: "100%", flexGrow: 0 }}
      >
        <View style={styles._VIEW_SAFE_table}>{children}</View>
      </ScrollView>
    ),
    paragraph: (node, children, _parent, styles) => (
      <View
        key={node.key}
        style={[styles._VIEW_SAFE_paragraph, { width: "100%", maxWidth: "100%" }]}
      >
        {children}
      </View>
    ),
  };
}
