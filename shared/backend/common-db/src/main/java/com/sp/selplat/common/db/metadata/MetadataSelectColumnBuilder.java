package com.sp.selplat.common.db.metadata;

import com.sp.selplat.common.db.domain.ColumnMetadata;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 元数据字段串构建器负责把字段元数据集合转换成模板 DAO 可直接使用的 select 字段串。
 * 这里单独收口字段串输出规则，是为了避免 DAO 层自己关心字段遍历和格式拼接细节。
 */
public class MetadataSelectColumnBuilder {

    /**
     * 把字段元数据集合转换成逗号分隔的 select 字段串。
     *
     * @param columnMetadataList 字段元数据集合
     * @return select 字段串
     */
    public String build(List<ColumnMetadata> columnMetadataList) {
        // 字段元数据为空时回退空串，交由调用方按无字段场景统一失败收口。
        if (columnMetadataList == null || columnMetadataList.isEmpty()) {
            return "";
        }
        // 只提取真实字段名并按元数据顺序拼接，保证 select 返回列顺序与数据库表结构保持一致。
        return columnMetadataList.stream()
            .map(ColumnMetadata::getColumnName)
            .collect(Collectors.joining(", "));
    }
}
