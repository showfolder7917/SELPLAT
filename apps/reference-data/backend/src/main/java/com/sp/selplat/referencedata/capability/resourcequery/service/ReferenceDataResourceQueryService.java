package com.sp.selplat.referencedata.capability.resourcequery.service;

import com.sp.selplat.common.util.CommonResult;
import java.util.Map;

/** 分别按类型 code 与树根节点 code 编排两个互不依赖的只读查询。 */
public interface ReferenceDataResourceQueryService {

    /**
     * 按唯一 code 查询启用类型。
     * 真实传参示例：{@code type101001}。
     * 真实返回示例：{@code {"success":true,"data":{"optionSetCode":"optionSet107000","valueCode":"DROPDOWN"}}}。
     * 异常或副作用示例：code 不存在时抛出稳定业务异常；方法不写数据库。
     *
     * @param typeCode 类型唯一 code
     * @return 类型详情结果
     */
    CommonResult getType(String typeCode);

    /**
     * 按共享选项组 code 查询可显示的启用选项。
     * 真实传参示例：{@code optionSet103006} 与 {@code {"locale":"zh-CN"}}。
     * 真实返回示例：{@code {"success":true,"data":[{"value":"ENGINEER","label":"工程师"}]}}。
     * 异常或副作用示例：非法选项组 code 抛出稳定业务异常；不写数据库。
     *
     * @param optionSetCode 共享选项组稳定 code
     * @param parameters locale 等查询参数
     * @return 选项列表公共结果
     */
    CommonResult getOptions(String optionSetCode, Map<String, String> parameters);

    /**
     * 按根节点唯一 code 查询一棵启用树。
     * 真实传参示例：{@code treeNode101007} 与 {@code {"locale":"zh-CN"}}。
     * 真实返回示例：返回 {@code {"success":true,"data":{"value":"ROOT","children":[]}}}。
     * 异常或副作用示例：根节点不存在时抛出稳定业务异常；方法不写数据库。
     *
     * @param rootCode 根树节点唯一 code
     * @param parameters locale 等查询参数
     * @return 由类型键决定表现形式的节点结果
     */
    CommonResult getNodes(String rootCode, Map<String, String> parameters);
}
