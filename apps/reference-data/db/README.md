# reference-data database

本目录是 reference-data 自己的权威本地数据库根，只保存可追踪的迁移脚本和正式运行数据。

## 目录约定

```text
db/
├── migration/  # 纳入版本管理的建表与种子脚本
└── data/       # 永久 H2 文件数据库，运行文件不提交 Git
```

正式数据库文件：

```text
apps/reference-data/db/data/reference-data.mv.db
```

应用启动时按 `migration/V*.sql` 顺序初始化结构。种子脚本只在目标坐标不存在时写入，重启不会覆盖后台已经修改的数据。

## 边界

- 本目录不得存放构建产物、缓存、日志、临时文件或测试数据库。
- 测试使用内存数据库或测试临时目录，禁止连接这里的正式文件。
- 运行数据库文件由 `.gitignore` 排除；迁移脚本、说明和空目录标记必须提交。
- 备份时应在应用停止写入后复制 `data/reference-data.mv.db`。
