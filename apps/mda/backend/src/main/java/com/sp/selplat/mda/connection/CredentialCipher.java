package com.sp.selplat.mda.connection;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 使用 AES/GCM 加密连接口令，数据库仅保存带随机 IV 和认证标签的密文。
 */
@Component
public class CredentialCipher {

    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private final SecretKeySpec secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * 从环境变量或应用属性派生固定长度 AES 密钥。
     *
     * @param secret 来自 {@code mda.secret-key} 的部署密钥，例如 {@code production-mda-key-2026}；
     *     本地默认值仅用于开发运行
     * 执行结果示例：密钥文本经 SHA-256 派生为 32 字节 AES-256 密钥，原文本不保存到数据库。
     */
    public CredentialCipher(@Value("${mda.secret-key:selplat-mda-local-development-key}") String secret) {
        // SHA-256 把任意长度部署密钥转换为 AES-256 所需的 32 字节密钥。
        this.secretKey = new SecretKeySpec(sha256(secret), "AES");
    }

    /**
     * 加密页面提交的明文口令。
     *
     * @param plaintext 来自连接编辑页面的明文口令，例如 {@code secret}
     * @return 含随机 IV 和认证标签的 Base64 密文，例如 {@code D5U7QyZ0...}；空口令返回空字符串
     * @throws IllegalStateException 当运行环境无法完成 AES/GCM 加密时抛出，例如
     *     {@code IllegalStateException("数据库口令加密失败。")}
     */
    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) {
            return "";
        }
        try {
            // 每次加密生成独立 IV，避免相同口令产生相同数据库密文。
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] payload = Arrays.copyOf(iv, iv.length + encrypted.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(payload);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("数据库口令加密失败。", exception);
        }
    }

    /**
     * 解密配置库中的连接口令。
     *
     * @param ciphertext 来自连接配置表的 Base64 密文，例如 {@code D5U7QyZ0...}
     * @return 仅供运行期 JDBC 连接使用的明文，例如 {@code secret}；空密文返回空字符串
     * @throws IllegalStateException 当密文格式、认证标签或部署密钥不匹配时抛出，例如
     *     {@code IllegalStateException("数据库口令解密失败，请检查 MDA_SECRET_KEY。")}
     */
    public String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isEmpty()) {
            return "";
        }
        try {
            byte[] payload = Base64.getDecoder().decode(ciphertext);
            if (payload.length <= IV_LENGTH) {
                throw new IllegalArgumentException("数据库口令密文格式无效。");
            }
            byte[] iv = Arrays.copyOfRange(payload, 0, IV_LENGTH);
            byte[] encrypted = Arrays.copyOfRange(payload, IV_LENGTH, payload.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("数据库口令解密失败，请检查 MDA_SECRET_KEY。", exception);
        }
    }

    private byte[] sha256(String secret) {
        try {
            // UTF-8 编码保证 Windows 与其他部署环境使用相同密钥文本时得到同一结果。
            return MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("无法初始化数据库口令密钥。", exception);
        }
    }
}
