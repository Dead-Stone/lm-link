import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Markdown from "react-native-markdown-display";
import {
  createAssistantMarkdownRules,
  normalizeAssistantMarkdown,
} from "../lib/assistant-markdown";
import { getMarkdownStyles, ThemeColors } from "../lib/theme";

const STREAM_MARKDOWN_THROTTLE_MS = 64;

function useStreamMarkdownContent(content: string, isStreaming: boolean): string {
  const [displayed, setDisplayed] = useState(content);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDisplayed(content);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplayed(content);
      timerRef.current = null;
    }, STREAM_MARKDOWN_THROTTLE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, isStreaming]);

  return isStreaming ? displayed : content;
}

type Props = {
  content: string;
  isStreaming?: boolean;
  colors: ThemeColors;
  cursor?: React.ReactNode;
};

function AssistantMessageMarkdown({ content, isStreaming, colors, cursor }: Props) {
  const markdownStyles = useMemo(() => getMarkdownStyles(colors), [colors]);
  const rules = useMemo(() => createAssistantMarkdownRules(), []);
  const streamContent = useStreamMarkdownContent(content, !!isStreaming);
  const normalized = useMemo(
    () => normalizeAssistantMarkdown(streamContent),
    [streamContent]
  );

  if (!normalized && !isStreaming) return null;

  return (
    <View style={styles.wrap}>
      {normalized ? (
        <Markdown style={markdownStyles} rules={rules} mergeStyle>
          {normalized}
        </Markdown>
      ) : null}
      {isStreaming && cursor ? (
        <View style={normalized ? styles.cursorAfterContent : undefined}>{cursor}</View>
      ) : null}
    </View>
  );
}

export default memo(AssistantMessageMarkdown);

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    flexShrink: 1,
  },
  cursorAfterContent: {
    marginTop: 2,
  },
});
