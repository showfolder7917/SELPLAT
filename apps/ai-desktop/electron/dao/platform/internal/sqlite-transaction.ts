import type { DatabaseSync } from "node:sqlite";

/**
 * 在 SQLite 立即写事务中执行一组持久化操作。
 *
 * 真实传参示例：`runSqliteTransaction(database, () => database.exec(sql))`。
 * 真实返回示例：回调返回 `{ versionCode: "0001" }` 时原样返回。
 * 异常或副作用示例：回调抛错时执行 `ROLLBACK` 并重新抛出原异常；成功时提交写入。
 */
export function runSqliteTransaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // 原异常是真实失败原因；回滚错误不应覆盖它。
    }
    throw error;
  }
}
