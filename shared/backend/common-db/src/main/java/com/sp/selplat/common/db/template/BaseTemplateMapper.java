package com.sp.selplat.common.db.template;

import com.sp.selplat.common.db.template.model.CommonTemplateSave;
import com.sp.selplat.common.db.template.model.CommonTemplateUpdate;
import java.util.Map;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 保存由 {@link BaseTemplateDao} 内部调用的单条 MyBatis 动态 SQL。
 * 表名和列名必须来自 DAO 元数据控制链，本接口不接受业务层或前端直接调用。
 */
public interface BaseTemplateMapper {

    /**
     * 按完整单主键或复合主键读取一条数据库记录。
     *
     * @param tableName DAO 解析出的物理表名，例如 {@code "UniauthUser"}
     * @param selectColumns 元数据生成的真实列清单，例如 {@code "id, loginName, status"}
     * @param idColumnValueMap DAO 组合的主键列值，例如 {@code {"tenantId":10,"orderId":20}}
     * @return 命中记录，例如 {@code {"id":1,"loginName":"admin","status":1}}；未命中时由 MyBatis 返回 null
     */
    @Select({
        "<script>",
        "SELECT ${selectColumns} FROM ${tableName}",
        "<where>",
        "<foreach collection='idColumnValueMap' index='columnName' item='columnValue'>",
        "AND ${columnName} = #{columnValue}",
        "</foreach>",
        "</where>",
        "</script>"
    })
    Map<String, Object> selectByIds(
        @Param("tableName") String tableName,
        @Param("selectColumns") String selectColumns,
        @Param("idColumnValueMap") Map<String, Object> idColumnValueMap
    );

    /**
     * 按受控表名和真实列值插入一条记录。
     *
     * @param saveIn DAO 组装的模板参数，例如
     *     {@code {"tableName":"UniauthUser","columnValueMap":{"id":1,"loginName":"admin"}}}
     * @return 数据库影响行数，例如成功插入一条返回 {@code 1}
     */
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

    /**
     * 按完整主键更新受控字段。
     *
     * @param updateIn DAO 组装的模板参数，例如
     *     {@code {"tableName":"UniauthUser","idColumns":["id"],"idValues":[1],}
     *     {@code "columnValueMap":{"displayName":"管理员"}}}
     * @return 数据库影响行数，例如成功更新一条返回 {@code 1}
     */
    @Update({
        "<script>",
        "UPDATE ${updateIn.tableName}",
        "<set>",
        "<foreach collection='updateIn.columnValueMap' index='columnName' item='columnValue'>",
        "${columnName} = #{columnValue},",
        "</foreach>",
        "</set>",
        "<where>",
        "<foreach collection='updateIn.idColumnValueMap' index='columnName' item='columnValue'>",
        "AND ${columnName} = #{columnValue}",
        "</foreach>",
        "</where>",
        "</script>"
    })
    int updateByIds(@Param("updateIn") CommonTemplateUpdate updateIn);

    /**
     * 按完整主键物理删除一条记录，仅供模板层保留能力，当前公共 DAO 不公开该入口。
     *
     * @param tableName DAO 解析出的物理表名，例如 {@code "UniauthUser"}
     * @param idColumnValueMap DAO 组合的主键列值，例如 {@code {"id":1}}
     * @return 数据库影响行数，例如删除一条返回 {@code 1}
     */
    @Delete({
        "<script>",
        "DELETE FROM ${tableName}",
        "<where>",
        "<foreach collection='idColumnValueMap' index='columnName' item='columnValue'>",
        "AND ${columnName} = #{columnValue}",
        "</foreach>",
        "</where>",
        "</script>"
    })
    int deleteByIds(
        @Param("tableName") String tableName,
        @Param("idColumnValueMap") Map<String, Object> idColumnValueMap
    );
}
