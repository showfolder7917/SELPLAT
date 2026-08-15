package com.sp.selplat.referencedata.referencedatacontrollayout.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatacontrollayout.service.ReferenceDataControlLayoutService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布页面控件布局的管理接口；公开定位参数只使用 code。 */
@RestController
@ModuleDescription(code = "reference-data-control-layout", name = "页面控件", description = "维护页面控件和响应式布局")
@RequestMapping(value = "/api/reference-data/admin/control-layouts/", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataControlLayoutController extends BaseController<ReferenceDataControlLayoutService> {
}
