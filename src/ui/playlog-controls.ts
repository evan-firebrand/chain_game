import type { PlaylogRecorder } from '../game-session/playlog.js';

export function mountPlaylogControls(
  container: HTMLElement,
  recorder: PlaylogRecorder
): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud-playlog-download';
  button.textContent = 'Download playlog';
  button.addEventListener('click', () => {
    const data = recorder.serialize();
    const blob = new Blob([data], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlog-${stamp}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  container.appendChild(button);
}
