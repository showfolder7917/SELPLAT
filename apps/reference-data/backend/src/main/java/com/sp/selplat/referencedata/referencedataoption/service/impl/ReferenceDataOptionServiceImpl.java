package com.sp.selplat.referencedata.referencedataoption.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedataoption.dao.ReferenceDataOptionDao;
import com.sp.selplat.referencedata.referencedataoption.service.ReferenceDataOptionService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 从 ReferenceDataOption 表读取记录并转换为公共 Map 下拉选项。 */
@Service
public class ReferenceDataOptionServiceImpl
        extends BaseServiceImpl<ReferenceDataOptionDao>
        implements ReferenceDataOptionService {

    /**
     * 查询一个类型业务坐标对应的启用选项。
     *
     * @param projectCode URL 项目编码，例如 {@code "reference-data"}
     * @param resourceCode URL 资源编码，例如 {@code "resource-kind"}
     * @param parameters URL 参数，例如 {@code {"locale":"ja-JP"}}
     * @return 标准选项结果，例如 {@code {"success":true,"data":[{"value":"TREE"}]}}
     * 异常或副作用示例：没有启用选项时抛出 {@code REFERENCE_DATA_OPTIONS_NOT_FOUND}。
     */
    @Override
    public CommonResult getOptions(String projectCode, String resourceCode, Map<String, String> parameters) {
        List<Map<String, Object>> rows = getDao().findEnabledOptions(projectCode, resourceCode);
        if (rows.isEmpty()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_OPTIONS_NOT_FOUND",
                    "未找到引用数据选项：" + projectCode + "/" + resourceCode);
        }
        // 资源查询继续使用原有公开地址，兼容已经按项目与资源编码接入的业务页面。
        String path = "/api/reference-data/" + projectCode.trim() + "/" + resourceCode.trim() + "/options";
        // 公共转换函数保证资源查询和页面控件查询返回完全相同的选项结构。
        return buildOptions(rows, parameters, path);
    }

    /**
     * 查询一个页面下拉框通过数据库绑定得到的启用选项。
     *
     * @param pageProjectCode 控件所在项目编码，例如 {@code "cms"}
     * @param pagePath 控件所在页面路径，例如 {@code "/cms/article.html"}
     * @param controlId 页面内稳定控件 ID，例如 {@code "selDropdownArticleStatusId"}
     * @param parameters URL 参数，例如 {@code {"locale":"zh-CN"}}
     * @return 标准选项结果，例如 {@code {"success":true,"data":[{"value":"DRAFT"}]}}
     * 异常或副作用示例：坐标未绑定或没有启用选项时抛出
     *     {@code REFERENCE_DATA_CONTROL_OPTIONS_NOT_FOUND}，不修改数据库。
     */
    @Override
    public CommonResult getOptionsByControl(
            String pageProjectCode,
            String pagePath,
            String controlId,
            Map<String, String> parameters) {
        // 当前租户由 BaseService 统一提供，前端不能通过参数访问其他租户绑定。
        List<Map<String, Object>> rows = getDao().findEnabledOptionsByControl(
                getCurrentTenantId(), pageProjectCode, pagePath, controlId);
        // 空结果明确表示控件绑定或选项配置不完整，禁止静默展示错误数据集。
        if (rows.isEmpty()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_CONTROL_OPTIONS_NOT_FOUND",
                    "未找到页面下拉框选项：" + pageProjectCode + pagePath + "#" + controlId);
        }
        // 请求路径记录页面控件唯一坐标，便于日志直接反查绑定记录。
        String path = "/api/reference-data/pages/" + pageProjectCode.trim()
                + "/controls/" + controlId.trim() + "/options";
        // 复用同一转换逻辑，页面绑定查询不会产生第二套前端选项协议。
        return buildOptions(rows, parameters, path);
    }

    /**
     * 把数据库选项记录转换为 SEL 下拉框使用的标准结构。
     *
     * @param rows DAO 查询得到的启用记录，例如 {@code [{optionValue:"TREE",sortnum:10}]}
     * @param parameters URL 参数，例如 {@code {"locale":"zh-CN"}}
     * @param path 当前真实请求路径，例如 {@code "/api/reference-data/reference-data/resource-kind/options"}
     * @return 标准成功结果，例如 {@code {"success":true,"data":[{"value":"TREE","label":"树形资源"}]}}
     * 异常或副作用示例：非法 attributesJson 由公共查询工具按既有规则处理；本方法不写数据库。
     */
    private CommonResult buildOptions(
            List<Map<String, Object>> rows,
            Map<String, String> parameters,
            String path) {
        // 当前语言统一由公共查询工具解析，两个查询入口共享相同回退规则。
        String locale = ReferenceDataQueryUtil.locale(parameters);
        // 新列表只保存前端需要的稳定字段，数据库审计列不会泄露给普通下拉框。
        List<Map<String, Object>> options = new ArrayList<>();
        // 每条数据库记录转换为一个不可变选项，保持 DAO 已确定的排序顺序。
        for (Map<String, Object> row : rows) {
            // sortnum 来自正式非空字段，转换为前端使用的整数排序值。
            Number sortnum = (Number) row.get("sortnum");
            // 有序 Map 固定标准选项字段的序列化顺序，便于浏览器和测试核对。
            Map<String, Object> option = new LinkedHashMap<>();
            // optionValue 是业务提交值，不使用中文标签作为稳定值。
            option.put("value", String.valueOf(row.get("optionValue")));
            // label 按请求语言选择，缺失语言继续使用公共回退策略。
            option.put("label", ReferenceDataQueryUtil.label(row, locale));
            // 未分组选项返回 null，由忽略空值序列化策略省略无意义字段。
            option.put("groupCode", row.get("groupCode") == null ? null : String.valueOf(row.get("groupCode")));
            // 正式 schema 保证 sortnum 非空，直接把数据库小数转换为前端整数顺序。
            option.put("sortOrder", new BigDecimal(String.valueOf(sortnum)).intValue());
            // disabled 控制展示但不可选择，与记录启停状态保持独立。
            option.put("disabled", Boolean.TRUE.equals(row.get("disabled")));
            // 扩展 JSON 只通过公共安全解析器转换，不让页面自行解析数据库字符串。
            option.put("attributes", ReferenceDataQueryUtil.attributes(row.get("attributesJson")));
            // 单条选项冻结后进入结果列表，后续代码不能意外改写已构造字段。
            options.add(Collections.unmodifiableMap(option));
        }
        // 统一成功结构保留真实请求路径和相同完成消息，调用方不区分内部查询方式。
        return ReferenceDataQueryUtil.success(List.copyOf(options), path, "引用数据选项查询完成。");
    }
}
