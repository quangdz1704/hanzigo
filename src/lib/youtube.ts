export interface YouTubePlayer {
  loadVideoById(id: string): void;
  playVideo(): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
}
interface PlayerEvent {
  target: YouTubePlayer;
  data: number;
}
export interface YouTubeAPI {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: PlayerEvent) => void;
        onStateChange: (event: PlayerEvent) => void;
        onError: (event: PlayerEvent) => void;
        onAutoplayBlocked: () => void;
      };
    },
  ) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiPromise: Promise<YouTubeAPI> | undefined;
export function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    const previous = window.onYouTubeIframeAPIReady;
    const restore = () => {
      clearTimeout(timer);
      if (window.onYouTubeIframeAPIReady === ready)
        window.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => {
      restore();
      script.remove();
      reject(
        new Error(
          "Chưa kết nối được trình phát YouTube. Em thử lại hoặc mở bài trên YouTube nhé.",
        ),
      );
    };
    const ready = () => {
      restore();
      if (window.YT?.Player) resolve(window.YT);
      else fail();
      previous?.();
    };
    const timer = setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = ready;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error) => {
    apiPromise = undefined;
    throw error;
  });
  return apiPromise;
}
export function youtubeError(code: number) {
  if (code === 101 || code === 150)
    return "Kênh này không cho phát nhúng. Em mở trên YouTube hoặc chuyển bài tiếp nhé.";
  if (code === 100)
    return "Video đã bị gỡ, chuyển riêng tư hoặc không có sẵn. Em thử bài khác nhé.";
  if (code === 153)
    return "YouTube chưa xác nhận được trang phát video. Em có thể mở trực tiếp trên YouTube.";
  return "YouTube chưa phát được video này. Em thử lại hoặc chuyển sang bài khác nhé.";
}
