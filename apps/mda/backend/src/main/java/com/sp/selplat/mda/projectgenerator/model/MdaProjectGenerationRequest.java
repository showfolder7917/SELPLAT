package com.sp.selplat.mda.projectgenerator.model;

/**
 * 承接 MDA 创建工程窗口提交的两个稳定输入。
 *
 * @param projectName 工程编码，例如 {@code "japan"}
 * @param tableName 业务表编码，例如 {@code "region"}
 */
public record MdaProjectGenerationRequest(String projectName, String tableName) {
}
