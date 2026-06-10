/** Match assets/android-badge.png — keypaths shared by face Lottie JSON files (overlay + tutorial). */
export const ANDROID_HEAD_LOTTIE_GREEN = "#00813e";

export const ANDROID_HEAD_LOTTIE_GREEN_PATHS = [
  "head",
  "lid-r",
  "lid-l",
  "antena-right",
  "antena-left",
] as const;

export function androidHeadLottieColorFilters(
  color: string = ANDROID_HEAD_LOTTIE_GREEN
) {
  return ANDROID_HEAD_LOTTIE_GREEN_PATHS.map((keypath) => ({ keypath, color }));
}
