package com.sp.selplat.common.support;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * 为权限、规则和签名等跨模块场景提供统一的文本摘要能力。
 * 本类只负责稳定生成 SHA-256 摘要，不负责保存明文、加盐或执行密码认证。
 */
public final class CommonHashSupport {

    /**
     * 阻止实例化无状态的哈希工具类。
     *
     * <p>执行结果示例：业务代码只能调用 {@code CommonHashSupport.sha256("admin")}，
     * 不能创建 {@code CommonHashSupport} 对象。</p>
     */
    private CommonHashSupport() {
        // 这里没有实例级状态，所有能力都应通过静态方法共享。
    }

    /**
     * 对调用方提供的有效文本生成小写 SHA-256 十六进制摘要。
     *
     * @param rawText 来自密码、规则内容或签名原文的文本，例如 {@code "admin"}
     * @return 去除首尾空格后生成的 64 位摘要，例如
     *     {@code "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"}
     * @throws IllegalArgumentException 当输入为 {@code null}、空串或仅包含空格时抛出，
     *     例如 {@code IllegalArgumentException("rawText 不能为空")}
     * @throws IllegalStateException 当运行环境缺少标准 SHA-256 算法时抛出，
     *     例如 {@code IllegalStateException("当前环境不支持 SHA-256")}
     */
    public static String sha256(String rawText) {
        // 调用方传空时直接阻断，避免无意义地对空文本做哈希。
        if (CommonValueSupport.isBlank(rawText)) {
            throw new IllegalArgumentException("rawText 不能为空");
        }
        try {
            // 统一使用 JDK 标准 SHA-256 算法生成固定长度摘要。
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            // 把原文本按 UTF-8 编码成字节数组，保证不同机器上的摘要口径一致。
            byte[] digest = messageDigest.digest(rawText.trim().getBytes(StandardCharsets.UTF_8));
            // 逐字节拼接十六进制结果，形成可持久化或可比较的摘要字符串。
            StringBuilder builder = new StringBuilder();
            // 每个字节都补足两位十六进制，避免出现长度不稳定的摘要结果。
            for (byte currentByte : digest) {
                builder.append(String.format("%02x", currentByte));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            // SHA-256 理论上属于标准算法，缺失时说明运行环境异常，应直接抛出非法状态。
            throw new IllegalStateException("当前环境不支持 SHA-256", exception);
        }
    }
}
