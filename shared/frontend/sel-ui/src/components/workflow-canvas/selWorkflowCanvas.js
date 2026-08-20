/* selWorkflowCanvas：通用角色流程画布；应用只提供角色、节点、连线和持久化回调。 */
(function selWorkflowCanvasRegistry() {
    "use strict";

    const selFreeze = window.sel.core.freeze;
    const instances = new WeakMap();

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function mount(host, payload) {
        if (!host || instances.has(host)) return instances.get(host) || null;
        const state = { roles: payload.roles || [], nodes: payload.nodes || [], edges: payload.edges || [], sourceId: "" };
        const root = element("section", "selworkflowcanvas");
        root.setAttribute("aria-label", payload.ariaLabel || "流程设计画布");
        const palette = element("aside", "selworkflowcanvas-palette");
        const title = element("h3", "selworkflowcanvas-title", payload.paletteLabel || "角色");
        const surface = element("div", "selworkflowcanvas-surface");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("selworkflowcanvas-lines");
        const nodeLayer = element("div", "selworkflowcanvas-nodes");
        palette.append(title);
        root.append(palette, surface);
        surface.append(svg, nodeLayer);
        host.replaceChildren(root);

        function dispatch(name, detail) {
            host.dispatchEvent(new CustomEvent(`selWorkflowCanvas:${name}`, { bubbles: true, detail }));
        }

        function renderRoles() {
            palette.querySelectorAll("[data-role-id]").forEach((node) => node.remove());
            state.roles.forEach((role) => {
                const item = element("button", "selworkflowcanvas-role", role.roleName);
                item.type = "button";
                item.draggable = true;
                item.dataset.roleId = String(role.id);
                item.addEventListener("dragstart", (event) => {
                    event.dataTransfer.setData("application/x-sel-role", String(role.id));
                });
                palette.append(item);
            });
        }

        function renderEdges() {
            svg.replaceChildren();
            const bounds = surface.getBoundingClientRect();
            state.edges.forEach((edge) => {
                const source = nodeLayer.querySelector(`[data-node-id="${CSS.escape(String(edge.sourceNodeId))}"]`);
                const target = nodeLayer.querySelector(`[data-node-id="${CSS.escape(String(edge.targetNodeId))}"]`);
                if (!source || !target) return;
                const sourceBox = source.getBoundingClientRect();
                const targetBox = target.getBoundingClientRect();
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", String(sourceBox.right - bounds.left));
                line.setAttribute("y1", String(sourceBox.top + sourceBox.height / 2 - bounds.top));
                line.setAttribute("x2", String(targetBox.left - bounds.left));
                line.setAttribute("y2", String(targetBox.top + targetBox.height / 2 - bounds.top));
                svg.append(line);
            });
        }

        function renderNodes() {
            nodeLayer.replaceChildren();
            state.nodes.forEach((workflowNode) => {
                const card = element("button", "selworkflowcanvas-node", workflowNode.nodeName);
                card.type = "button";
                card.dataset.nodeId = String(workflowNode.id);
                card.style.left = `${Number(workflowNode.positionX || 0)}px`;
                card.style.top = `${Number(workflowNode.positionY || 0)}px`;
                card.title = "先点起点，再点终点建立连线；拖动可调整位置";
                card.addEventListener("click", () => {
                    if (!state.sourceId) {
                        state.sourceId = String(workflowNode.id);
                        card.classList.add("is-source");
                        return;
                    }
                    if (state.sourceId !== String(workflowNode.id)) {
                        dispatch("edgeAdd", { sourceNodeId: state.sourceId, targetNodeId: String(workflowNode.id) });
                    }
                    state.sourceId = "";
                    renderNodes();
                });
                card.draggable = true;
                card.addEventListener("dragend", (event) => {
                    const bounds = surface.getBoundingClientRect();
                    dispatch("nodeMove", {
                        id: String(workflowNode.id),
                        positionX: Math.max(0, event.clientX - bounds.left - 60),
                        positionY: Math.max(0, event.clientY - bounds.top - 24)
                    });
                });
                nodeLayer.append(card);
            });
            requestAnimationFrame(renderEdges);
        }

        surface.addEventListener("dragover", (event) => event.preventDefault());
        surface.addEventListener("drop", (event) => {
            event.preventDefault();
            const roleId = event.dataTransfer.getData("application/x-sel-role");
            if (!roleId) return;
            const bounds = surface.getBoundingClientRect();
            dispatch("nodeAdd", {
                roleId,
                positionX: Math.max(0, event.clientX - bounds.left - 60),
                positionY: Math.max(0, event.clientY - bounds.top - 24)
            });
        });
        const controller = {
            update(next) {
                state.roles = next.roles || state.roles;
                state.nodes = next.nodes || [];
                state.edges = next.edges || [];
                renderRoles();
                renderNodes();
            },
            getState() { return { nodes: [...state.nodes], edges: [...state.edges] }; },
            destroy() { instances.delete(host); host.replaceChildren(); }
        };
        instances.set(host, controller);
        controller.update(payload);
        return controller;
    }

    window.sel.register("components.workflowCanvas", selFreeze({ mount }));
}());
