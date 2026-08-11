package com.sp.selplat.referencedata.capability.workbenchnavigation.service;

import com.sp.selplat.common.util.CommonResult;

/** 声明引用数据工作台不落库导航能力。 */
public interface ReferenceDataWorkbenchNavigationService {

    /**
     * 返回工作台稳定的一级模块顺序和下钻方式。
     *
     * @return 导航结果，例如 {@code {"modules":[{"key":"types","label":"数据类型"}]}}
     */
    CommonResult navigation();
}
