# Third-Party Notices — LM Link for Android

LM Link for Android includes open-source software and other materials from third parties. The app’s **source code** is licensed under the [MIT License](../LICENSE).

Below is a non-exhaustive list of major components. Each project is subject to its own license. Full license texts are available from the respective projects and in your dependency tree (`node_modules`, native build outputs).

## Application framework

| Component | License | Notes |
|-----------|---------|--------|
| [Expo](https://expo.dev) / [React Native](https://reactnative.dev) | MIT | App framework and UI runtime |
| [React](https://react.dev) | MIT | UI library |

## On-device inference

| Component | License | Notes |
|-----------|---------|--------|
| [llama.rn](https://github.com/mybigday/llama.rn) | MIT | React Native bindings |
| [llama.cpp](https://github.com/ggerganov/llama.cpp) | MIT | On-device GGUF inference (via llama.rn) |

## Networking and storage

| Component | License | Notes |
|-----------|---------|--------|
| [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) | MIT | Local settings and conversation storage |
| [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) | MIT | Secure credential storage |
| [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) | MIT | Model file downloads and storage |
| [react-native-zeroconf](https://github.com/Aperion/react-native-zeroconf) | MIT | Local network discovery |

## UI and media

| Component | License | Notes |
|-----------|---------|--------|
| [@expo/vector-icons](https://docs.expo.dev/guides/icons/) (Ionicons) | MIT | Icons |
| [@shopify/flash-list](https://github.com/Shopify/flash-list) | MIT | Chat list performance |
| [react-native-markdown-display](https://github.com/iamacup/react-native-markdown-display) | MIT | Message rendering |
| [lottie-react-native](https://github.com/lottie-react-native/lottie-react-native) | Apache-2.0 | Animations |
| [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) | MIT | Photo attachments |

## Fonts

| Component | License | Notes |
|-----------|---------|--------|
| [Inter](https://fonts.google.com/specimen/Inter) | SIL Open Font License 1.1 | UI typography |
| [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) | SIL Open Font License 1.1 | UI typography |
| [Roboto](https://fonts.google.com/specimen/Roboto) | Apache-2.0 | UI typography |
| [Caveat](https://fonts.google.com/specimen/Caveat) | SIL Open Font License 1.1 | Signature accent |

## Assets and trademarks

| Item | License / terms | Notes |
|------|-----------------|--------|
| Android robot mascot (tutorial art) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Google Android brand asset — see `lib/android-guide-robot.ts` |
| LM Studio name and logo | Third-party trademark | Used descriptively; LM Link is not affiliated with LM Studio |
| Provider / model logos in UI | Various | Shown for identification; trademarks belong to their owners |

## Downloaded model weights

Models you download (from the in-app catalog, Hugging Face, or LM Studio) are **not** part of LM Link’s source license. Each model may be governed by its own license (e.g. Llama, Gemma, Qwen, Apache-2.0, custom terms). You are responsible for complying with the license of each model you download and use.

## LM Studio

[LM Studio](https://lmstudio.ai) is separate software you install on your computer. LM Link communicates with your LM Studio instance; LM Studio’s terms and licenses apply to that software and to models you manage there.

## Questions

For questions about these notices: [mohanmoganti2023@gmail.com](mailto:mohanmoganti2023@gmail.com)
