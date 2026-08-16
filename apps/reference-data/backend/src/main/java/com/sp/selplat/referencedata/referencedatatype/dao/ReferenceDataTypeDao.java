package com.sp.selplat.referencedata.referencedatatype.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.util.CommonPageResult;
import java.util.Map;

/**
 * 声明 ReferenceDataType 固定表在公共 Base CRUD 之外确有差异的分页和选项组值唯一性查询能力。
 */
public interface ReferenceDataTypeDao extends BaseDao {

    /**
     * 按一个关键词同时匹配记录 code、控件 code、类型值与三语名称。
     *
     * @param keyword 记录 code 或上级类型 code 关键词，例如 {@code type101001}
     * @param status 启用或停用状态；为空时查询全部未删除记录
     * @param pageNo 页码，例如 {@code 1}
     * @param pageSize 每页条数，例如 {@code 20}
     * @return 类型分页结果，例如
     *     {@code {"records":[{"code":"type101001","optionSetCode":"optionSet107000","valueCode":"DROPDOWN"}]}}
     */
    CommonPageResult findPage(String keyword, Integer status, int pageNo, int pageSize);

    /**
     * 判断同一租户和选项组下的类型值是否已被其他记录占用。
     *
     * @param tenantId 当前租户，例如 {@code 1}
     * @param optionSetCode 共享选项组 code，例如 {@code optionSet107000}
     * @param valueCode 类型值，例如 {@code DROPDOWN}
     * @param excludedId 更新时排除的当前主键；新增时为空
     * @return 已占用返回 true
     */
    boolean existsOptionSetValue(long tenantId, String optionSetCode, String valueCode, Long excludedId);

    /**
     * 按唯一公开 code 查询一个启用类型。
     * 真实传参示例：{@code type101001}。
     * 真实返回示例：{@code {code:"type101001",optionSetCode:"optionSet107000",valueCode:"DROPDOWN"}}。
     * 异常或副作用示例：未命中时返回 null；方法不修改数据库。
     *
     * @param typeCode ReferenceDataType 的唯一 code
     * @return 启用类型记录，未命中时为空
     */
    Map<String, Object> findEnabledByCode(String typeCode);

}
