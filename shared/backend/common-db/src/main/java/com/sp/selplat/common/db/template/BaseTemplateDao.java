package com.sp.selplat.common.db.template;

import com.sp.selplat.common.db.template.model.CommonTemplateSave;
import com.sp.selplat.common.db.template.model.CommonTemplateUpdate;
import java.util.Map;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

// 注解式公共 DAO 模板直接提供动态表名和字段名级别的通用 SQL，供需要快速落通用表操作的模块复用。
public interface BaseTemplateDao {

    // 按主键查询模板直接从目标表返回一行键值结果，适合验证模板链路和轻量后台工具场景。
    @Select("SELECT ${selectColumns} FROM ${tableName} WHERE ${idColumn} = #{id}")
    Map<String, Object> selectById(
        @Param("tableName") String tableName,
        @Param("selectColumns") String selectColumns,
        @Param("idColumn") String idColumn,
        @Param("id") Object id
    );

    // 新增模板按列值映射直接写入目标表，适合字段集合由上层明确控制的通用落库场景。
    @Insert({
        "<script>",
        "INSERT INTO ${saveIn.tableName}",
        "<trim prefix='(' suffix=')' suffixOverrides=','>",
        "<foreach collection='saveIn.columnValueMap' index='columnName' item='columnValue'>",
        "${columnName},",
        "</foreach>",
        "</trim>",
        "VALUES",
        "<trim prefix='(' suffix=')' suffixOverrides=','>",
        "<foreach collection='saveIn.columnValueMap' index='columnName' item='columnValue'>",
        "#{columnValue},",
        "</foreach>",
        "</trim>",
        "</script>"
    })
    int insert(@Param("saveIn") CommonTemplateSave saveIn);

    // 更新模板按主键和列值映射覆盖目标表字段，适合通用后台维护简单主数据。
    @Update({
        "<script>",
        "UPDATE ${updateIn.tableName}",
        "<set>",
        "<foreach collection='updateIn.columnValueMap' index='columnName' item='columnValue'>",
        "${columnName} = #{columnValue},",
        "</foreach>",
        "</set>",
        "WHERE ${updateIn.idColumn} = #{updateIn.idValue}",
        "</script>"
    })
    int updateById(@Param("updateIn") CommonTemplateUpdate updateIn);

    // 删除模板按主键直接删除目标表记录，适合后台通用主数据删除操作。
    @Delete("DELETE FROM ${tableName} WHERE ${idColumn} = #{id}")
    int deleteById(
        @Param("tableName") String tableName,
        @Param("idColumn") String idColumn,
        @Param("id") Object id
    );
}



