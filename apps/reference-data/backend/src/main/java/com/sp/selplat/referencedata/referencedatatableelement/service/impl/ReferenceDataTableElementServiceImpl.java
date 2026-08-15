package com.sp.selplat.referencedata.referencedatatableelement.service.impl;

import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.referencedata.referencedatatableelement.dao.ReferenceDataTableElementDao;
import com.sp.selplat.referencedata.referencedatatableelement.service.ReferenceDataTableElementService;
import com.sp.selplat.common.util.CommonParam;
import org.springframework.stereotype.Service;

/** 使用现有公共新增链为每个表格元素发号、生成 code 并维护审计字段。 */
@Service
public class ReferenceDataTableElementServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataTableElementDao>
        implements ReferenceDataTableElementService {

    /**
     * 将列、工具栏动作和行动作统一标记为 tableElement，并由 elementType 继续区分子类别。
     * 真实传参示例：{@code {"tableId":101018,"elementType":"COLUMN"}}。
     * 真实返回示例：返回 {@code tableElement}，最终 code 形如 {@code tableElement101025}。
     * 异常或副作用示例：本方法不校验 tableId；外键和业务 Service 负责阻止孤立元素。
     *
     * @param saveIn 表格元素新增参数
     * @return 表格元素对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
        return "tableElement";
    }
}
