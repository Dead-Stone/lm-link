import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Props = {
  size?: number;
  color?: string;
};

export default function NewChatIcon({ size = 22, color = "#fff" }: Props) {
  return <Ionicons name="add" size={size} color={color} />;
}
