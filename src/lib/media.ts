/** True when a media URL points to a video file (theme hero slides can be images or videos). */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}
