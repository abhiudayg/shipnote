export type CommandSpec = { summary: string; usage: string; options: Array<[string, string]> };

export const GLOBAL_OPTIONS: Array<[string, string]> = [
  ["-v, --verbose", "Print step-by-step details to stderr"],
  ["-h, --help", "Print usage"],
  ["    --version", "Print the version"],
];

function table(rows: Array<[string, string]>): string {
  const width = Math.max(...rows.map(([name]) => name.length));
  return rows.map(([name, text]) => `  ${name.padEnd(width)}  ${text}`).join("\n");
}

export function rootHelp(version: string, commands: Record<string, CommandSpec>): string {
  return [
    "Usage:  shipnote [OPTIONS] COMMAND",
    "",
    "Turn the commits you ship into posts you approve. Nothing is posted by shipnote.",
    "",
    "Options:",
    table(GLOBAL_OPTIONS),
    "",
    "Commands:",
    table(Object.entries(commands).map(([name, spec]) => [name, spec.summary])),
    "",
    "Run 'shipnote COMMAND --help' for more information on a command.",
    `Version ${version}`,
  ].join("\n");
}

export function commandHelp(spec: CommandSpec): string {
  const options: Array<[string, string]> = spec.options.length > 0 ? spec.options : [["", "No command options"]];
  return [
    `Usage:  shipnote ${spec.usage}`,
    "",
    spec.summary,
    "",
    "Options:",
    table(options),
    "",
    "Global options such as --verbose can be used with any command.",
  ].join("\n");
}
