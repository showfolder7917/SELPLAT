import { DatabaseSync } from "node:sqlite";
import { app } from "electron";

process.stderr.write("stage:imported\n");
app.whenReady().then(() => {
  process.stderr.write("stage:ready\n");
  const database = new DatabaseSync(":memory:");
  process.stderr.write("stage:opened\n");
  database.exec("CREATE TABLE RuntimeProbe (id INTEGER PRIMARY KEY) STRICT");
  process.stderr.write("stage:created\n");
  const row = database.prepare("SELECT COUNT(*) AS count FROM RuntimeProbe").get();
  process.stderr.write(`stage:queried:${String(row.count)}\n`);
  database.close();
  process.stderr.write("stage:closed\n");
  app.exit(0);
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  app.exit(1);
});
