package com.sp.selplat.referencedata.referencedatatable.service.impl;

import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.referencedata.referencedatatable.dao.ReferenceDataTableDao;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import com.sp.selplat.common.util.CommonParam;
import org.springframework.stereotype.Service;

/** 使用公共数据库服务维护项目页面中的表格登记记录。 */
@Service
public class ReferenceDataTableServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataTableDao>
        implements ReferenceDataTableService {

    /**
     * 将表格定义编码标记为 table，便于管理员从数据库直接辨认记录职责。
     * 真实传参示例：{@code {"projectCode":"reference-data","pageCode":"page101017"}}。
     * 真实返回示例：返回 {@code table}，最终 code 形如 {@code table101018}。
     * 异常或副作用示例：本方法不访问数据库；公共新增链仍负责发号和审计身份。
     *
     * @param saveIn 表格新增参数
     * @return 表格对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
        return "table";
    }
}
