package com.sp.selplat.mda.connection;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * 口令测试验证随机密文、可逆性和空口令约定。
 */
class CredentialCipherTest {

    @Test
    void shouldEncryptWithRandomIvAndDecrypt() {
        CredentialCipher cipher = new CredentialCipher("test-key");
        String first = cipher.encrypt("secret");
        String second = cipher.encrypt("secret");
        assertThat(first).isNotEqualTo("secret").isNotEqualTo(second);
        assertThat(cipher.decrypt(first)).isEqualTo("secret");
        assertThat(cipher.decrypt(second)).isEqualTo("secret");
    }

    @Test
    void shouldKeepBlankPasswordBlank() {
        CredentialCipher cipher = new CredentialCipher("test-key");
        assertThat(cipher.encrypt("")).isEmpty();
        assertThat(cipher.decrypt("")).isEmpty();
    }
}
