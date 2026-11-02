import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

// Keep the normal installation's models out of the development app's writable
// cache. Copies, never links: deleting a model in Dev cannot delete the original.
const root = resolve(import.meta.dir, "..");
// T3/terminal processes opened before tool installation can have a stale PATH.
if (process.platform === "win32") {
  const refreshed = Bun.spawnSync([
    "powershell.exe",
    "-NoProfile",
    "-Command",
    "$devSdk = [Environment]::GetEnvironmentVariable('VULKAN_SDK','User'); if (-not $devSdk) { $devSdk = [Environment]::GetEnvironmentVariable('VULKAN_SDK','Machine') }; @{ path = ([Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')); sdk = $devSdk } | ConvertTo-Json -Compress",
  ]);
  if (refreshed.exitCode === 0) {
    const values = JSON.parse(refreshed.stdout.toString());
    process.env.PATH = `${process.env.PATH || ""};${values.path}`;
    process.env.VULKAN_SDK ||= values.sdk;
  }
}
const devHome = join(root, ".handy-dev.local", "huggingface");
const sourceHome =
  process.env.HF_HOME || join(homedir(), ".cache", "huggingface");
await mkdir(join(devHome, "hub"), { recursive: true });
const repos = await readdir(join(sourceHome, "hub"), {
  withFileTypes: true,
}).catch(() => []);
for (const repo of repos) {
  if (!repo.isDirectory() || !repo.name.startsWith("models--handy-computer--"))
    continue;
  await cp(
    join(sourceHome, "hub", repo.name),
    join(devHome, "hub", repo.name),
    {
      recursive: true,
      dereference: true,
      force: false,
      filter: (path) =>
        !path.endsWith(".lock") && !path.endsWith(".incomplete"),
    },
  );
  console.log(`Development model cache ready: ${repo.name}`);
}

if (!process.argv.includes("--prepare-only")) {
  const runBuilt = process.argv.includes("--run-built");
  const executable = join(
    root,
    ".handy-dev.local",
    "target",
    "debug",
    process.platform === "win32" ? "handy.exe" : "handy",
  );
  if (runBuilt && !existsSync(executable)) {
    console.error(
      "Handy Dev has not been built yet. Run bun run dev:local first.",
    );
    process.exit(1);
  }
  const missing = (runBuilt ? [] : ["cargo", "rustc", "cmake"]).filter(
    (tool) => !Bun.which(tool),
  );
  if (!runBuilt && process.platform === "win32" && !process.env.VULKAN_SDK) {
    missing.push("Vulkan SDK (VULKAN_SDK)");
  }
  if (missing.length) {
    console.error(
      `Missing native build prerequisites: ${missing.join(", ")}. See BUILD.md.`,
    );
    process.exit(1);
  }
  if (process.platform === "win32") {
    const running = Bun.spawnSync([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      "if (Get-Process handy -ErrorAction SilentlyContinue | Where-Object { -not $_.HasExited }) { exit 1 }",
    ]);
    if (running.exitCode !== 0) {
      console.error(
        "Quit Handy from its tray menu before launching Handy Dev, to avoid competing shortcuts and microphone access.",
      );
      process.exit(1);
    }
  }
  const child = Bun.spawn(
    runBuilt
      ? [executable]
      : [
          "bun",
          "run",
          "tauri",
          "dev",
          "--config",
          "src-tauri/tauri.dev-local.conf.json",
        ],
    {
      cwd: runBuilt ? join(root, "src-tauri") : root,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: join(root, ".handy-dev.local", "target"),
        HF_HOME: devHome,
        HF_HUB_CACHE: join(devHome, "hub"),
        HANDY_DISABLE_UPDATER: "1",
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  process.exit(await child.exited);
}
