import { ImageSourcePropType } from "react-native";
import { LibraryDownloadSource } from "./remote-model-library";

export const CATALOG_SOURCE_LOGOS: Record<LibraryDownloadSource, ImageSourcePropType> = {
  lmstudio: require("../assets/lm-studio-logo.png"),
  huggingface: require("../assets/huggingface-logo.png"),
};
