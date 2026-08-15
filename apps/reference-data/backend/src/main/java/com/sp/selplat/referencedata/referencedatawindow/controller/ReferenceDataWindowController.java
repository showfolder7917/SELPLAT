package com.sp.selplat.referencedata.referencedatawindow.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 Window 配置管理接口，供页面编辑器保存宽高和位置。 */
@RestController
@ModuleDescription(code = "reference-data-window", name = "Window", description = "维护 Window 尺寸、位置和行为")
@RequestMapping(value = "/api/reference-data/admin/windows/", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataWindowController extends BaseController<ReferenceDataWindowService> {
}
