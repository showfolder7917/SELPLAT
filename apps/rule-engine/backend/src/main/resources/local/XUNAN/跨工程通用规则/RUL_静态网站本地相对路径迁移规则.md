# 静态网站本地相对路径迁移规则

<!-- 问题：静态旧站镜像保留原域名绝对地址或服务器根路径时，直接双击本地 HTML 会跳回线上站点或无法加载同目录资源。 -->
<!-- 场景：把已下载到同一站点根目录的 HTML、CSS、JavaScript 和媒体关联改造成可通过 file 协议浏览的本地网站。 -->
<!-- 业务含义：站内页面和已有资源不依赖原域名或本地 Web 服务器，也不会因页面所在目录层级不同而链接到错误位置。 -->

<!-- 原站域名 URL 必须以当前引用文件目录为基准计算到本地真实目标的相对路径，禁止只删除域名后留下服务器根路径。 -->
static_site_same_origin_url_migration = relative_path(from=source_file_directory,to=existing_target_under_site_root)

<!-- href、src、action、data-src 和 CSS url 中指向本地已存在目标的服务器根路径必须同步改成相对路径；适用于直接双击 HTML 的 file 协议场景。 -->
static_site_existing_root_reference_must_be_relative = href
<!-- static_site_existing_root_reference_must_be_relative.2 的当前独立事实为 src。 -->
static_site_existing_root_reference_must_be_relative.2 = src
<!-- static_site_existing_root_reference_must_be_relative.3 的当前独立事实为 action。 -->
static_site_existing_root_reference_must_be_relative.3 = action
<!-- static_site_existing_root_reference_must_be_relative.4 的当前独立事实为 data-src。 -->
static_site_existing_root_reference_must_be_relative.4 = data-src
<!-- static_site_existing_root_reference_must_be_relative.5 的当前独立事实为 css_url。 -->
static_site_existing_root_reference_must_be_relative.5 = css_url

<!-- 旧站生成的重复目录、null 栏目或异常聚合路径必须先按当前栏目和真实文件核对后归一；不能根据文件名盲目选择多个同名候选。 -->
static_site_malformed_internal_path_repair = verify_current_section_then_existing_target

<!-- 缺失的导航页面允许回退到已存在的最近栏目入口或网站首页，缺失的图片、脚本和样式不得伪造目标，必须保留为缺失项并在结果中报告。 -->
static_site_missing_navigation_fallback = nearest_existing_section_or_site_index
<!-- static_site_missing_asset_action 的当前独立事实为 report_without_fake_file。 -->
static_site_missing_asset_action = report_without_fake_file

<!-- 修改 GBK 等旧编码页面时必须使用字节保持方式只替换 ASCII 路径片段，禁止把整页按 UTF-8 解码后重写导致原正文损坏。 -->
static_site_legacy_encoding_rewrite = byte_preserving_ascii_reference_replacement

<!-- 完成验证必须确认原站域名无残留、本地已存在目标不再使用服务器根路径、入口页全部本地引用可达，并分别统计缺失镜像资源。 -->
static_site_local_migration_evidence = original_domain_zero
<!-- static_site_local_migration_evidence.2 的当前独立事实为 existing_root_reference_zero。 -->
static_site_local_migration_evidence.2 = existing_root_reference_zero
<!-- static_site_local_migration_evidence.3 的当前独立事实为 entry_local_target_all_exist。 -->
static_site_local_migration_evidence.3 = entry_local_target_all_exist
<!-- static_site_local_migration_evidence.4 的当前独立事实为 missing_asset_count。 -->
static_site_local_migration_evidence.4 = missing_asset_count
