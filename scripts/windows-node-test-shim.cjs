if (process.platform === "win32" && typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    value: () => 0,
    configurable: true,
  });
}

// CommonJS is intentional: Node loads this compatibility shim via `--require`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require("node:os");
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: "logiclab-test",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null,
  });
}
