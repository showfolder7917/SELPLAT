package com.sp.selplat.mda.projectgenerator.model;

import java.util.List;

/**
 * 返回脚手架生成后的稳定位置和后续访问说明。
 *
 * @param projectName 已规范化的工程编码，例如 {@code "japan"}
 * @param tableName 已规范化的业务表编码，例如 {@code "region"}
 * @param actualTableName 数据库真实表名，例如 {@code "JapanRegion"}
 * @param projectCreated 本次是否创建了完整工程
 * @param pageUrl Host 重启后可访问的页面地址，例如 {@code "/japan/japan.html"}
 * @param restartRequired 是否需要重启统一 Host 使新模块进入运行类路径
 * @param createdFiles 本次新建文件相对工程根的有序清单
 */
public record MdaProjectGenerationResult(
        String projectName,
        String tableName,
        String actualTableName,
        boolean projectCreated,
        String pageUrl,
        boolean restartRequired,
        List<String> createdFiles) {

    /**
     * 冻结文件清单，防止 Controller 序列化期间被外部改写。
     *
     * @param projectName 工程编码，例如 {@code "japan"}
     * @param tableName 表编码，例如 {@code "region"}
     * @param actualTableName 真实表名，例如 {@code "JapanRegion"}
     * @param projectCreated 是否为首次创建工程，例如 {@code true}
     * @param pageUrl 页面地址，例如 {@code "/japan/japan.html"}
     * @param restartRequired 是否需要重启，例如 {@code true}
     * @param createdFiles 新文件列表，例如 {@code ["apps/japan/backend/build.gradle"]}
     *     <p>返回值为创建后的不可变记录；传入空文件列表时保存为空列表。
     */
    public MdaProjectGenerationResult {
        createdFiles = createdFiles == null ? List.of() : List.copyOf(createdFiles);
    }
}
