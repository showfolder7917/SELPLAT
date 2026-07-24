package com.sp.selplat.common.tool.docTopic;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把核定版拼音 DOCX 按原始篇目顺序导出为图片生成清单。
 */
public final class DocTopicManifestExportTool {

    /**
     * 工具只保留无状态入口，避免不同批次共享源文件或输出路径。
     */
    private DocTopicManifestExportTool() {
        // 业务调用统一从 main 进入，确保源文件和输出参数都经过同一套校验。
    }

    /**
     * 导出核定诗文、作者和逐字拼音，不生成或改写任何教学文字。
     *
     * @param args --source 与 --target 成对参数
     * @throws Exception DOCX 解析或 JSON 写出失败
     */
    public static void main(String[] args) throws Exception {
        // 业务上仅允许两个命名参数，避免位置参数把源文件与输出文件写反。
        Map<String, String> values = parseArguments(args);
        // 业务上源路径转为绝对规范路径，清单可直接记录真实来源。
        Path source = Path.of(required(values, "source")).toAbsolutePath().normalize();
        // 业务上目标路径转为绝对规范路径，供后续 Pillow 链稳定读取。
        Path target = Path.of(required(values, "target")).toAbsolutePath().normalize();
        // 业务上复用正式 POI 解析器，标题、作者、正文和拼音均保持核定值。
        List<DocTopicPoem> poems = PinyinPoetryDocxParser.parse(source);
        // 业务上清单顶层同时记录来源、总数与作品数组，便于批量前后数量核对。
        Map<String, Object> manifest = new LinkedHashMap<>();
        // 业务上来源使用字符串保存，生成报告能够追溯到用户指定 DOCX。
        manifest.put("sourceDocx", source.toString());
        // 业务上作品总数由实际解析结果计算，不接受人工填写的预期数量。
        manifest.put("poemCount", poems.size());
        // 业务上作品列表保持解析器返回顺序，编号由数组位置从一递增。
        manifest.put("poems", poems.stream().map(DocTopicManifestExportTool::toManifestPoem).toList());
        // 业务上只创建目标文件的父目录，不触碰已存在的其它输出和样板图片。
        Files.createDirectories(target.getParent());
        // 业务上 Jackson 以 UTF-8 和可读缩进写出，中文标题及带调拼音不转义为乱码。
        ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
        // 业务上一次性写入完整清单，写出失败时不会把半份数据继续交给排版器。
        mapper.writeValue(target.toFile(), manifest);
    }

    /**
     * 把一篇核定作品转换为带稳定三位编号的清单记录。
     */
    private static Map<String, Object> toManifestPoem(DocTopicPoem poem) {
        // 业务上按当前流序号生成一至三位内部编号，正式文件名阶段再补足三位。
        Map<String, Object> item = new LinkedHashMap<>();
        // 业务上标题、朝代和作者直接来自 POI 解析结果，不调用模型补全。
        item.put("title", poem.title());
        item.put("dynasty", poem.dynasty());
        item.put("author", poem.author());
        // 业务上每行保留逐字 token，确保拼音与汉字不会在 JSON 中失去对应关系。
        item.put("lines", poem.lines());
        // 业务上返回保持插入顺序的字段集合，便于人工抽查清单。
        return item;
    }

    /**
     * 读取严格的 --key value 参数。
     */
    private static Map<String, String> parseArguments(String[] args) {
        // 业务上奇数参数表示缺值，必须在读取任何文件前失败。
        if (args.length % 2 != 0) {
            throw new IllegalArgumentException("参数必须按 --key value 成对提供");
        }
        // 业务上使用有序映射保留日志和错误中的原参数顺序。
        Map<String, String> values = new LinkedHashMap<>();
        // 业务上逐对读取参数，重复键与未知键都不能静默接受。
        for (int index = 0; index < args.length; index += 2) {
            // 业务上键必须以双横线开头，避免把路径误识别成参数名。
            String key = args[index];
            // 业务上每个键只允许出现一次，防止后值覆盖已确认路径。
            if (!key.startsWith("--") || values.putIfAbsent(key.substring(2), args[index + 1]) != null) {
                throw new IllegalArgumentException("非法或重复参数: " + key);
            }
        }
        // 业务上导出工具只接受 source 和 target，拼错参数立即报告。
        values.keySet().stream().filter(key -> !List.of("source", "target").contains(key)).findFirst().ifPresent(key -> {
            throw new IllegalArgumentException("不支持的参数: --" + key);
        });
        // 业务上返回已校验键集合，必填值由 required 继续检查空白。
        return values;
    }

    /**
     * 读取一个非空必填参数。
     */
    private static String required(Map<String, String> values, String key) {
        // 业务上缺失或空白路径都不能进入文件系统操作。
        String value = values.get(key);
        // 业务上明确指出缺少的参数名，方便批量任务直接修正调用配置。
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("缺少 --" + key);
        }
        // 业务上保留用户提供的路径文本，再由调用处统一规范化。
        return value;
    }
}
