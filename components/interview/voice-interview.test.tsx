// @ts-nocheck
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceInterview } from "./voice-interview";

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

class MockSpeechRecognition {
  public continuous = true;
  public interimResults = true;
  public lang = "en-US";
  public onresult: ((event: any) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

describe("VoiceInterview", () => {
  it("handles mic start/stop interactions", () => {
    const recognition = new MockSpeechRecognition();
    (window as any).SpeechRecognition = vi.fn(() => recognition);
    (window as any).speechSynthesis = { speak: vi.fn(), cancel: vi.fn() };
    (window as any).SpeechSynthesisUtterance = function (text: string) {
      this.text = text;
    } as any;

    const onPartial = vi.fn();
    const onFinal = vi.fn();
    render(
      <VoiceInterview
        isEnabled
        onPartialTranscript={onPartial}
        onFinalTranscript={onFinal}
        questionText="Question?"
      />
    );

    const micBtn = screen.getByTitle("Hold to talk");
    fireEvent.mouseDown(micBtn);
    expect(recognition.start).toHaveBeenCalled();

    fireEvent.mouseUp(micBtn);
    expect(recognition.stop).toHaveBeenCalled();
  });

  it("emits final transcript chunks without duplicate insertion", () => {
    const recognition = new MockSpeechRecognition();
    (window as any).SpeechRecognition = vi.fn(() => recognition);
    (window as any).speechSynthesis = { speak: vi.fn(), cancel: vi.fn() };
    (window as any).SpeechSynthesisUtterance = function (_text: string) {} as any;

    const onPartial = vi.fn();
    const onFinal = vi.fn();
    render(
      <VoiceInterview
        isEnabled
        onPartialTranscript={onPartial}
        onFinalTranscript={onFinal}
        questionText="Question?"
      />
    );

    recognition.onresult?.({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: "Token bucket", confidence: 0.91 } },
        { isFinal: true, 0: { transcript: "Token bucket", confidence: 0.91 } },
      ],
    });

    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("Token bucket", 0.91);
  });
});
