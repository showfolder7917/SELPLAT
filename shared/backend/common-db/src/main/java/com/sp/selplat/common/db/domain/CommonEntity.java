package com.sp.selplat.common.db.domain;

/**
 * 公共实体基类统一承接通用主键字段名，供动态表操作和通用数据处理逻辑复用默认主键配置。
 */
public class CommonEntity {

    // key 记录默认主键名称，供未显式指定主键列时统一按 id 参与通用查询、更新或删除逻辑。
    private String key = "id";

    /**
     * 获取默认主键名称。
     *
     * @return 默认主键名称，例如 {@code id}
     */
    public String getKey() {
        return key;
    }

    /**
     * 设置默认主键名称。
     *
     * @param key 默认主键名称
     */
    public void setKey(String key) {
        this.key = key;
    }
}
