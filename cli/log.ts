let verbose = false;

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

export function debug(message: string): void {
  if (verbose) process.stderr.write(`debug: ${message}\n`);
}
