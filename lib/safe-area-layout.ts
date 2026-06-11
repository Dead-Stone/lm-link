/** Gap below the status-bar / notch inset for fixed screen headers. */
export const SCREEN_HEADER_TOP_GAP = 8;

/** Top padding for hub panels, chat header, About, Settings, etc. */
export function screenHeaderTopPadding(topInset: number): number {
  return topInset + SCREEN_HEADER_TOP_GAP;
}

/** Top padding for full-screen modal pages (handle + title sit below safe area). */
export function modalPageTopPadding(topInset: number): number {
  return topInset;
}
