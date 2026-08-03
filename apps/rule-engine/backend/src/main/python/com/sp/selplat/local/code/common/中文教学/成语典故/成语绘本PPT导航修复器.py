from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import zipfile
from pathlib import Path

from lxml import etree


def parse_arguments() -> argparse.Namespace:
    """读取需要补丁和验收的一个或多个 PPT 目录。"""

    # 业务上调用方必须明确给出当前项目的PPT目录，避免工具误处理其他课程或历史成品。
    parser = argparse.ArgumentParser(description="修复并验证成语绘本 PPT 导航")
    # 业务上允许同时传入项目稿和成品稿目录，并按输入顺序输出统一验证报告。
    parser.add_argument("--deck-dir", action="append", required=True, type=Path)
    # 业务上报告必须写入当前工程 OPTION/temp，调用方可根据任务分类指定具体文件。
    parser.add_argument("--report", required=True, type=Path)
    # 业务上返回已验证的命令行参数，后续不再使用任何机器绝对路径。
    return parser.parse_args()
# PowerPoint演示文稿命名空间用于定位幻灯片中的形状名称。
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
# DrawingML命名空间用于创建点击超链接节点。
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
# 关系命名空间前缀用于在点击节点中写入r:id。
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
# 关系文件本身使用包关系命名空间。
PR_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
# 内部幻灯片跳转使用slide关系类型。
SLIDE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
# 跨PPT文件跳转使用hyperlink关系类型。
HYPERLINK_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"


def slide_count_from_zip(names: set[str]) -> int:
    """根据ZIP成员名统计真实幻灯片数量。"""
    # 只匹配slideN.xml本体，不把布局、备注或关系文件计入。
    numbers = [int(match.group(1)) for name in names if (match := re.fullmatch(r"ppt/slides/slide(\d+)\.xml", name))]
    # 页码应从1连续排列，最大页码就是总页数。
    return max(numbers, default=0)


def next_relationship_id(root: etree._Element) -> str:
    """创建不与现有关系冲突的新rId。"""
    # 收集所有形如rId数字的现有编号。
    numbers = []
    # 遍历关系根节点的所有直接子节点。
    for relationship in root:
        # 读取关系编号文本。
        relationship_id = relationship.get("Id", "")
        # 只处理标准数字编号。
        match = re.fullmatch(r"rId(\d+)", relationship_id)
        # 命中时保存数字部分。
        if match:
            numbers.append(int(match.group(1)))
    # 在当前最大编号后顺延，空文件从rId1开始。
    return f"rId{max(numbers, default=0) + 1}"


def relationship_root(existing: bytes | None) -> etree._Element:
    """读取或新建幻灯片关系根节点。"""
    # 已有关系文件直接解析，保留图片、备注和布局关系。
    if existing is not None:
        return etree.fromstring(existing)
    # 没有关系文件时创建标准Relationships根节点。
    return etree.Element(f"{{{PR_NS}}}Relationships", nsmap={None: PR_NS})


def add_click_link(cnvpr: etree._Element, relationship_id: str, internal: bool) -> None:
    """把点击行为挂到形状的非可视属性节点。"""
    # 若重复运行补丁，先移除旧点击节点，避免一个形状出现多个动作。
    for old in cnvpr.findall(f"{{{A_NS}}}hlinkClick"):
        cnvpr.remove(old)
    # 创建新的DrawingML点击超链接节点。
    click = etree.Element(f"{{{A_NS}}}hlinkClick")
    # 通过r:id关联到当前幻灯片关系文件中的目标。
    click.set(f"{{{R_NS}}}id", relationship_id)
    # 内部跳页需要显式使用PowerPoint幻灯片跳转动作。
    if internal:
        click.set("action", "ppaction://hlinksldjump")
    # cNvPr中extLst必须保持在超链接之后，因此插入到扩展列表之前。
    extension = cnvpr.find(f"{{{A_NS}}}extLst")
    # 若存在扩展列表，则在其索引前插入。
    if extension is not None:
        cnvpr.insert(cnvpr.index(extension), click)
    else:
        # 没有扩展列表时直接追加即可。
        cnvpr.append(click)


def target_for_shape(name: str, total_slides: int) -> tuple[str, str, bool] | None:
    """把导航形状名称解析成关系类型、目标和是否内部跳转。"""
    # 当前册内部跳转形状使用LINK_SLIDE_页码命名。
    slide_match = re.fullmatch(r"LINK_SLIDE_(\d+)", name)
    # 命中内部跳转时校验目标页码。
    if slide_match:
        # 转换成一基目标页码。
        target_number = int(slide_match.group(1))
        # 目标超出当前册页数属于生成器错误，必须阻止交付。
        if not 1 <= target_number <= total_slides:
            raise ValueError(f"内部导航目标越界：{name} / 共{total_slides}页")
        # 返回内部slide关系和同目录目标XML。
        return SLIDE_REL_TYPE, f"slide{target_number}.xml", True
    # 返回总目录按钮跨文件指向00总目录PPT。
    if name == "LINK_FILE_MASTER":
        return HYPERLINK_REL_TYPE, "00_成语学习总目录.pptx", False
    # 总目录中的年级按钮按约定文件名跳转。
    grade_match = re.fullmatch(r"LINK_FILE_GRADE_(\d)", name)
    # 命中年级按钮时构造同文件夹相对文件名。
    if grade_match:
        # 年级号用于两位序号和中文文件名。
        grade = int(grade_match.group(1))
        # 返回跨文件超链接目标。
        return HYPERLINK_REL_TYPE, f"{grade:02d}_{grade}年级成语故事.pptx", False
    # 非导航形状不做任何修改。
    return None


def patch_deck(deck_path: Path) -> dict[str, object]:
    """在单个PPTX中写入所有内部与跨文件导航。"""
    # 读取原PPTX全部ZIP成员，后续在内存中只替换幻灯片与关系文件。
    with zipfile.ZipFile(deck_path, "r") as source_zip:
        # 保存成员名集合便于统计幻灯片。
        names = set(source_zip.namelist())
        # 保存全部成员字节，避免丢失媒体、主题、备注和自定义属性。
        payloads = {name: source_zip.read(name) for name in source_zip.namelist()}
    # 统计当前演示文稿总页数，内部目标必须位于该范围。
    total_slides = slide_count_from_zip(names)
    # 记录写入的内部与外部链接数量。
    internal_links = 0
    # 外部链接数量单独统计，便于验证总目录和返回按钮。
    external_links = 0
    # 逐页处理所有形状。
    for slide_number in range(1, total_slides + 1):
        # 当前幻灯片XML成员路径。
        slide_name = f"ppt/slides/slide{slide_number}.xml"
        # 当前幻灯片关系文件成员路径。
        rels_name = f"ppt/slides/_rels/slide{slide_number}.xml.rels"
        # 解析幻灯片XML，保留原命名空间和结构。
        slide_root = etree.fromstring(payloads[slide_name])
        # 解析已有关系或创建新的关系根节点。
        rels_root = relationship_root(payloads.get(rels_name))
        # 查找所有带名称的非可视形状属性。
        for cnvpr in slide_root.xpath("//p:cNvPr", namespaces={"p": P_NS}):
            # 读取生成器写入的形状名称。
            shape_name = cnvpr.get("name", "")
            # 尝试把名称解析为导航目标。
            target = target_for_shape(shape_name, total_slides)
            # 普通形状不做处理。
            if target is None:
                continue
            # 解包关系类型、目标地址和内部标志。
            relationship_type, relationship_target, internal = target
            # 为该点击动作创建唯一关系编号。
            relationship_id = next_relationship_id(rels_root)
            # 创建关系节点。
            relationship = etree.SubElement(rels_root, f"{{{PR_NS}}}Relationship")
            # 写入唯一关系编号。
            relationship.set("Id", relationship_id)
            # 写入slide或hyperlink关系类型。
            relationship.set("Type", relationship_type)
            # 写入目标页XML或同文件夹PPT文件名。
            relationship.set("Target", relationship_target)
            # 跨文件超链接必须标记External，内部幻灯片关系不需要。
            if not internal:
                relationship.set("TargetMode", "External")
            # 把关系编号挂到形状点击节点。
            add_click_link(cnvpr, relationship_id, internal)
            # 更新对应统计。
            if internal:
                internal_links += 1
            else:
                external_links += 1
        # 把修改后的幻灯片XML写回内存字典。
        payloads[slide_name] = etree.tostring(slide_root, xml_declaration=True, encoding="UTF-8", standalone="yes")
        # 把新增关系后的关系XML写回内存字典。
        payloads[rels_name] = etree.tostring(rels_root, xml_declaration=True, encoding="UTF-8", standalone="yes")
    # 在目标文件同目录创建临时PPTX，确保写入完成前不破坏原文件。
    with tempfile.NamedTemporaryFile(prefix=f".{deck_path.stem}_nav_", suffix=".pptx", dir=deck_path.parent, delete=False) as temporary:
        # 保存临时路径供完成后原子替换。
        temporary_path = Path(temporary.name)
    # 把所有原成员和修改成员写入临时ZIP。
    with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED) as target_zip:
        # 保持原成员顺序不是PPTX硬要求，但按名称稳定写入便于重复验证。
        for name in sorted(payloads):
            # 写入当前成员字节。
            target_zip.writestr(name, payloads[name])
    # 原子替换原PPTX，任何中途失败都不会留下半个文件。
    os.replace(temporary_path, deck_path)
    # 返回该文件的页数和链接统计。
    return {"file": deck_path.name, "slides": total_slides, "internal_links": internal_links, "external_links": external_links}


def verify_deck(deck_path: Path) -> dict[str, object]:
    """验证每个导航形状都存在点击节点和有效关系。"""
    # 打开补丁后的PPTX进行只读结构检查。
    with zipfile.ZipFile(deck_path, "r") as archive:
        # 保存成员名集合用于总页数统计。
        names = set(archive.namelist())
        # 统计幻灯片页数。
        total_slides = slide_count_from_zip(names)
        # 导航形状计数。
        navigation_shapes = 0
        # 成功链接计数。
        linked_shapes = 0
        # 逐页检查导航形状。
        for slide_number in range(1, total_slides + 1):
            # 当前幻灯片XML路径。
            slide_name = f"ppt/slides/slide{slide_number}.xml"
            # 当前关系文件路径。
            rels_name = f"ppt/slides/_rels/slide{slide_number}.xml.rels"
            # 解析幻灯片XML。
            slide_root = etree.fromstring(archive.read(slide_name))
            # 关系文件必须存在，否则导航无法工作。
            if rels_name not in names:
                raise ValueError(f"缺少关系文件：{deck_path.name} / slide{slide_number}")
            # 解析关系文件并建立rId集合。
            rels_root = etree.fromstring(archive.read(rels_name))
            # 可用关系编号集合用于验证点击节点引用。
            relationship_ids = {relationship.get("Id") for relationship in rels_root}
            # 查找所有形状名称。
            for cnvpr in slide_root.xpath("//p:cNvPr", namespaces={"p": P_NS}):
                # 读取形状名称。
                name = cnvpr.get("name", "")
                # 只验证LINK_开头的导航形状。
                if not name.startswith("LINK_"):
                    continue
                # 导航形状计数加一。
                navigation_shapes += 1
                # 查找形状点击节点。
                click = cnvpr.find(f"{{{A_NS}}}hlinkClick")
                # 缺少点击节点属于功能错误。
                if click is None:
                    raise ValueError(f"导航无点击动作：{deck_path.name} / slide{slide_number} / {name}")
                # 读取点击节点引用的关系编号。
                relationship_id = click.get(f"{{{R_NS}}}id")
                # 引用必须存在于当前关系文件。
                if relationship_id not in relationship_ids:
                    raise ValueError(f"导航关系缺失：{deck_path.name} / slide{slide_number} / {name} / {relationship_id}")
                # 验证通过的链接计数加一。
                linked_shapes += 1
    # 所有导航形状必须一一对应链接。
    if navigation_shapes != linked_shapes:
        # 数量不一致时阻止交付。
        raise ValueError(f"导航数量不一致：{deck_path.name} / {navigation_shapes} / {linked_shapes}")
    # 返回验证统计。
    return {"file": deck_path.name, "slides": total_slides, "navigation_shapes": navigation_shapes, "linked_shapes": linked_shapes}


def main(arguments: argparse.Namespace) -> None:
    """补丁并验证项目稿与成品稿的全部七个PPT。"""
    # 汇总补丁结果。
    patch_results = []
    # 汇总验证结果。
    verify_results = []
    # 逐目录处理七个PPT文件。
    for deck_dir in arguments.deck_dir:
        # 文件名排序保证00总目录先于六个年级。
        for deck_path in sorted(deck_dir.glob("*.pptx")):
            # 写入当前文件导航。
            patch_results.append(patch_deck(deck_path))
            # 立即重新打开并验证每个导航形状。
            verify_results.append(verify_deck(deck_path))
    # 项目目录保存导航验证报告，便于后续审计。
    report_path = arguments.report
    # 业务上报告父目录按需创建，保证验证结果固定归入当前任务临时目录。
    report_path.parent.mkdir(parents=True, exist_ok=True)
    # 写出UTF-8 JSON统计。
    report_path.write_text(json.dumps({"patched": patch_results, "verified": verify_results}, ensure_ascii=False, indent=2), encoding="utf-8")
    # 输出简洁统计供执行文档记录。
    print(json.dumps({"decks": len(patch_results), "internal_links": sum(item["internal_links"] for item in patch_results), "external_links": sum(item["external_links"] for item in patch_results), "report": str(report_path)}, ensure_ascii=False))


# 直接运行脚本时执行导航补丁和验证。
if __name__ == "__main__":
    # 启动全量PPT导航处理。
    main(parse_arguments())
