package com.sp.selplat.common.support;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

// 通用哈希支撑类统一沉淀跨模块可复用的摘要算法，避免各模块各自复制一套密码或签名哈希代码。
public final class CommonHashSupport {

    // 私有构造器用于阻止把纯工具类错误实例化。
    private CommonHashSupport() {
        // 这里没有实例级状态，所有能力都应通过静态方法共享。
    }

    // SHA-256 哈希统一供权限、规则、签名等需要稳定摘要的场景复用。
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
