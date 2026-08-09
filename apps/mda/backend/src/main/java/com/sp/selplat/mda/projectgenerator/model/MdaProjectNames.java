package com.sp.selplat.mda.projectgenerator.model;

/**
 * 保存工程生成所需的全部派生命名。
 * 模板只消费已校验结果，不再自行推断目录、类名或数据库表名。
 *
 * @param projectCode 工程编码，例如 {@code japan}
 * @param tableCode 表编码，例如 {@code region-type}
 * @param projectClass 工程类名前缀，例如 {@code Japan}
 * @param tableClass 表类名片段，例如 {@code RegionType}
 * @param actualTableName 实际数据库表名，例如 {@code JapanRegionType}
 * @param packageRoot Java 包根，例如 {@code com.sp.selplat.japan}
 */
public record MdaProjectNames(
        String projectCode,
        String tableCode,
        String projectClass,
        String tableClass,
        String actualTableName,
        String packageRoot) {
}
