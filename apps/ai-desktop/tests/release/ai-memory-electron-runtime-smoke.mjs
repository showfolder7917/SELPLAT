import { DatabaseSync } from "node:sqlite";

import { app } from "electron";

app.whenReady().then(() => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE RuntimeProbe (id INTEGER PRIMARY KEY) STRICT");
    const row = database.prepare("SELECT COUNT(*) AS count FROM RuntimeProbe").get();
    if (Number(row.count) !== 0) throw new Error("Electron node:sqlite runtime probe returned an unexpected result.");
    process.stdout.write(`Electron ${process.versions.electron} / Node ${process.versions.node} node:sqlite runtime verified.\n`);
  } finally {
    database.close();
  }
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  app.exit(1);
});

