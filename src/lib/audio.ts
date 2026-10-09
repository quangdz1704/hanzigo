let playing: HTMLAudioElement | undefined;
export function stopAudio() {
  playing?.pause();
  playing = undefined;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
export function chineseVoices() {
  return "speechSynthesis" in window
    ? window.speechSynthesis
        .getVoices()
        .filter((v) => /^zh(?:-|_)/i.test(v.lang))
    : [];
}
export async function speak(text: string, audioUrl?: string) {
  stopAudio();
  if (audioUrl) {
    playing = new Audio(audioUrl);
    await playing.play();
    return;
  }
  if (!("speechSynthesis" in window))
    throw new Error(
      "Thiết bị chưa hỗ trợ đọc tiếng Trung. Em vẫn có thể đọc Pinyin nhé.",
    );
  let voices = chineseVoices();
  if (!voices.length) {
    await new Promise<void>((resolve) => {
      const finish = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", finish);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, 700);
      window.speechSynthesis.addEventListener("voiceschanged", finish);
    });
    voices = chineseVoices();
  }
  if (!voices.length)
    throw new Error(
      "Chưa có giọng tiếng Trung trên thiết bị. Hãy thêm giọng zh-CN trong cài đặt hệ thống; âm thanh có thể cần mạng.",
    );
  const speech = new SpeechSynthesisUtterance(text);
  speech.voice =
    voices.find((v) => v.lang.toLowerCase() === "zh-cn") ?? voices[0];
  speech.lang = speech.voice.lang;
  speech.rate = 0.85;
  return new Promise<void>((resolve, reject) => {
    speech.onend = () => resolve();
    speech.onerror = (e) => {
      if (e.error === "canceled" || e.error === "interrupted") resolve();
      else
        reject(
          new Error(
            "Không thể phát âm thanh. Hãy kiểm tra giọng đọc và kết nối.",
          ),
        );
    };
    window.speechSynthesis.speak(speech);
  });
}
