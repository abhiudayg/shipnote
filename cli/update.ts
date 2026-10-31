const REGISTRY = "https://registry.npmjs.org";
const PACKAGE = "@abhiudayg/shipnote";

export function isNewer(latest: string, current: string): boolean {
  const parts = (version: string) => version.split(".").map(Number);
  const a = parts(latest);
  const b = parts(current);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index];
  }
  return false;
}

export async function latestVersion(): Promise<string> {
  const response = await fetch(`${REGISTRY}/${encodeURIComponent(PACKAGE)}/latest`);
  if (!response.ok) throw new Error(`the npm registry answered ${response.status}`);
  const body = (await response.json()) as { version: string };
  return body.version;
}

export async function update(currentVersion: string, checkOnly: boolean): Promise<string> {
  const latest = await latestVersion();
  if (!isNewer(latest, currentVersion)) return `shipnote ${currentVersion} is the latest version.`;
  if (checkOnly) return `shipnote ${latest} is available (you have ${currentVersion}). Run shipnote update to install it.`;
  const install = Bun.spawn(["npm", "install", "-g", `${PACKAGE}@${latest}`, "--registry", `${REGISTRY}/`], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await install.exited) !== 0) throw new Error("npm install -g failed; see the output above");
  return `updated shipnote ${currentVersion} -> ${latest}`;
}
