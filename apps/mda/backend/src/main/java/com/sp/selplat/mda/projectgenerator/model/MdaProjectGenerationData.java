package com.sp.selplat.mda.projectgenerator.model;

import java.util.List;

/**
 * 描述脚手架生成后放入 {@code CommonResult.data} 的业务数据，不定义新的 HTTP 输出协议。
 *
 * @param projectName 已规范化的工程编码，例如 {@code "japan"}
 * @param tableName 已规范化的业务表编码，例如 {@code "region"}
 * @param actualTableName 数据库真实表名，例如 {@code "JapanRegion"}
 * @param projectCreated 本次是否创建了完整工程
 * @param pageUrl Host 重启后可访问的页面地址，例如 {@code "/japan/japan.html"}
 * @param restartRequired 是否需要重启统一 Host 使新模块进入运行类路径
 * @param createdFiles 本次新建文件相对工程根的有序清单
 */
public record MdaProjectGenerationData(
        String projectName,
        String tableName,
        String actualTableName,
        boolean projectCreated,
        String pageUrl,
        boolean restartRequired,
        List<String> createdFiles) {

    /**
     * 冻结文件清单，防止放入公共输出容器后被外部改写。
     * 真实传参示例：{@code projectName="japan", createdFiles=["apps/japan/backend/build.gradle"]}。
     * 真实返回示例：构造后 {@code createdFiles} 为不可变列表。
     * 异常或副作用示例：传入空列表时保存为空集合，不修改调用方列表。
     */
    public MdaProjectGenerationData {
        createdFiles = createdFiles == null ? List.of() : List.copyOf(createdFiles);
    }
}
