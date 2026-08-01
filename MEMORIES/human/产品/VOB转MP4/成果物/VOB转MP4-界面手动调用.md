# VOB 转 MP4 界面手动调用

## 作用

- 说明人如何手动打开视频转换界面
- 说明推荐的启动方式和直接启动方式
- 说明当前界面已经支持批量拖拽转换

## 推荐方式

- 推荐通过 `ability` 启动界面，这样会自动走当前知识库的能力入口

```bash
python3 ./MEMORIES/ai/code/executor.py vob_to_mp4_delivery '{"input_file":"./OPTION/VIDEO_TS.VOB","output_file":"./OPTION/VIDEO_TS_gui.mp4","log_file":"./OPTION/tmp/log/VIDEO_TS_gui.log","use_gui":true,"always_on_top":true}'
```

## 直接启动界面

- 如果只想手动打开界面，也可以直接启动当前的 `PySide6` 应用

```bash
/usr/local/bin/python3 ./MEMORIES/ai/code/app/vob_to_mp4_gui_pyside6.py '{"input_file":"./OPTION/VIDEO_TS.VOB","output_file":"./OPTION/VIDEO_TS_gui.mp4","log_file":"./OPTION/tmp/log/VIDEO_TS_gui.log","always_on_top":true}'
```

## 双击脚本方式

- 如果想直接双击打开界面，使用这个脚本：

`./MEMORIES/human/脚本/VOB转MP4-双击打开.command`

## 界面使用步骤

1. 打开界面后，可以直接拖入 `.vob` 文件或文件夹。
2. 界面会先识别可转换文件，并计算预计总时长。
3. 右侧可以修改输出目录和日志目录；未创建的日志目录会自动创建。
4. 默认会勾选 `始终置顶`，可以按需要保留或取消。
5. 点击 `开始批量转换`。
6. 在界面里查看当前文件状态、总体进度和实时日志。
7. 转换完成后，把日志路径发给 AI 继续检查结果。

## 默认路径

- 默认来源目录：`./OPTION/`
- 默认输出目录：`./OPTION/`
- 默认日志目录：`./OPTION/tmp/log/`

## 注意

- 当前图形界面版本是 `PySide6`
- 当前图形界面版本已经支持批量拖拽和保持目录层级输出
- 如果要通过 AI 执行任务，AI 仍然只调用 `ability`
- 人手动启动界面时，可以直接运行上面的命令
