import { ANDROID_HEAD_GREEN } from "./brand-mark";

/** Match logo / hero — keypaths shared by face Lottie JSON files (overlay + tutorial). */
export const ANDROID_HEAD_LOTTIE_GREEN = ANDROID_HEAD_GREEN;

export const ANDROID_HEAD_LOTTIE_GREEN_PATHS = [
  "head",
  "lid-r",
  "lid-l",
  "antena-right",
  "antena-left",
] as const;

export function androidHeadLottieColorFilters(color: string = ANDROID_HEAD_GREEN) {
  return ANDROID_HEAD_LOTTIE_GREEN_PATHS.map((keypath) => ({ keypath, color }));
}
