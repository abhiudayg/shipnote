const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SHOW_AFTER_MS = 1000;

export async function withProgress<T>(label: string, task: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const tty = process.stderr.isTTY === true;
  const seconds = () => Math.round((Date.now() - started) / 1000);
  let frame = 0;
  let shown = false;
  let ticker: ReturnType<typeof setInterval> | undefined;
  const draw = () => process.stderr.write(`\r\x1b[K${FRAMES[frame++ % FRAMES.length]} ${label} ${seconds()}s`);
  const reveal = setTimeout(() => {
    shown = true;
    if (!tty) {
      process.stderr.write(`${label}...\n`);
      return;
    }
    draw();
    ticker = setInterval(draw, 100);
  }, SHOW_AFTER_MS);
  const finish = (message: string) => {
    clearTimeout(reveal);
    if (ticker) clearInterval(ticker);
    if (shown) process.stderr.write(tty ? `\r\x1b[K${message}\n` : `${message}\n`);
  };
  try {
    const value = await task();
    finish(`✓ ${label} (${seconds()}s)`);
    return value;
  } catch (error) {
    finish(`✗ ${label} failed (${seconds()}s)`);
    throw error;
  }
}
