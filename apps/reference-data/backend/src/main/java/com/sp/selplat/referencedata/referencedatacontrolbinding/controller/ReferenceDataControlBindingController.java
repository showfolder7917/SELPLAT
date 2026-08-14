package com.sp.selplat.referencedata.referencedatacontrolbinding.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatacontrolbinding.service.ReferenceDataControlBindingService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 ReferenceDataControlBinding 的分页、详情、新增、更新和假删除接口。 */
@RestController
@ModuleDescription(
        code = "reference-data-control-binding",
        name = "页面控件绑定",
        description = "登记页面控件与引用数据类型的唯一绑定")
@RequestMapping(
        value = "/api/reference-data/admin/control-bindings/",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataControlBindingController
        extends BaseController<ReferenceDataControlBindingService> {
}

