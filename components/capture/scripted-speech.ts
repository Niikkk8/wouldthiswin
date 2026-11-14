// Dev capture only: stands in for the browser's speech recognition so the demo videos show
// live dictation with the script's words. Installed on window before the session renders.

import type { Recognition } from "@/components/grilling/use-dictation";
import type { RecognitionResults } from "@/lib/dictation";

const WORD_MS = 190;
const HEARING_MS = 350;

export function installScriptedSpeech(script: string) {
  if (typeof window === "undefined") return;
  const words = script.split(/\s+/).filter(Boolean);

  class ScriptedRecognition implements Recognition {
    lang = "en-US";
    continuous = false;
    interimResults = false;
    onresult: Recognition["onresult"] = null;
    onerror: Recognition["onerror"] = null;
    onend: Recognition["onend"] = null;
    onaudiostart: Recognition["onaudiostart"] = null;
    private timers: number[] = [];
    private said = 0;

    private emit(isFinal: boolean) {
      const transcript = words.slice(0, this.said).join(" ");
      const results = [Object.assign([{ transcript }], { isFinal })] as RecognitionResults;
      this.onresult?.({ results });
    }

    start() {
      this.timers.push(window.setTimeout(() => this.onaudiostart?.(), 120));
      words.forEach((_, i) =>
        this.timers.push(
          window.setTimeout(
            () => {
              this.said = i + 1;
              this.emit(this.said === words.length);
            },
            HEARING_MS + i * WORD_MS,
          ),
        ),
      );
    }

    stop() {
      this.timers.forEach(clearTimeout);
      if (this.said) this.emit(true);
      window.setTimeout(() => this.onend?.(), 60);
    }

    abort() {
      this.timers.forEach(clearTimeout);
      this.onend?.();
    }
  }

  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = ScriptedRecognition;
}
