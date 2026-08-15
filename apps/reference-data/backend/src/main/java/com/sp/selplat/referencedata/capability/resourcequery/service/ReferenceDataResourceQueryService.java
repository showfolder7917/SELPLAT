package com.sp.selplat.referencedata.capability.resourcequery.service;

import com.sp.selplat.common.util.CommonResult;
import java.util.Map;

/** 以 ReferenceDataType.code 为唯一公开坐标编排类型与节点只读查询。 */
public interface ReferenceDataResourceQueryService {

    /**
     * 按唯一 code 查询启用类型。
     * 真实传参示例：{@code type101001}。
     * 真实返回示例：{@code {"success":true,"data":{"type":"DROPDOWN"}}}。
     * 异常或副作用示例：code 不存在时抛出稳定业务异常；方法不写数据库。
     *
     * @param typeCode 类型唯一 code
     * @return 类型详情结果
     */
    CommonResult getType(String typeCode);

    /**
     * 按唯一类型 code 查询其启用节点。
     * 真实传参示例：{@code type101001} 与 {@code {"locale":"zh-CN"}}。
     * 真实返回示例：下拉类型返回 {@code {"success":true,"data":[{"value":"TREE"}]}}。
     * 异常或副作用示例：code 没有启用节点时抛出稳定业务异常；方法不写数据库。
     *
     * @param typeCode 类型唯一 code
     * @param parameters locale 等查询参数
     * @return 由类型键决定表现形式的节点结果
     */
    CommonResult getNodes(String typeCode, Map<String, String> parameters);
}
