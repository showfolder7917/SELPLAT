package com.sp.selplat.referencedata.referencedatatreenode.service;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.service.BaseService;
import java.util.Map;

/** 声明 ReferenceDataTreeNode 表的树查询业务。 */
public interface ReferenceDataTreeNodeService extends BaseService {

    /**
     * 按类型唯一 code 查询节点，并依据类型键输出树、选项或菜单结构。
     * 真实传参示例：{@code typeCode=type101001, locale=zh-CN}。
     * 真实返回示例：DROPDOWN 类型返回 {@code {"success":true,"data":[{"value":"TREE"}]}}。
     * 异常或副作用示例：code 不存在或没有启用节点时抛出
     *     {@code REFERENCE_DATA_NODES_NOT_FOUND}；方法不修改数据库。
     *
     * @param typeCode ReferenceDataType 的唯一 code
     * @param parameters locale 等查询参数
     * @return 与类型表现形式匹配的节点结果
     */
    CommonResult getNodes(String typeCode, Map<String, String> parameters);
}
