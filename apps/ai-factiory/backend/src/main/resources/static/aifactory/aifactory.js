(function (global) {
  "use strict";
  const createElement = global.sel.core.element;
  const page = {
    source: null,
    taskId: document.getElementById("taskId"),
    watch: document.getElementById("watchTask"),
    state: document.getElementById("connectionState"),
    summary: document.getElementById("summary"),
    stages: document.getElementById("stages"),
    events: document.getElementById("events")
  };

  function text(value) { return value == null ? "—" : String(value); }

  function render(result) {
    const snapshot = result && result.data ? result.data : {};
    const task = snapshot.task || {};
    page.summary.textContent = task.task_code
      ? `${text(task.title)} · ${text(task.status)} · ${text(task.project)}`
      : "尚未找到任务。";
    page.stages.replaceChildren(...(snapshot.stages || []).map(stage => {
      const card = createElement("article");
      const title = createElement("h3", { text: text(stage.stage_type) });
      const status = createElement("p", { text: `状态：${text(stage.status)}` });
      card.append(title, status);
      return card;
    }));
    page.events.replaceChildren(...(snapshot.events || []).map(event => {
      const item = createElement("li", {
        text: `${text(event.event_type)} · ${text(event.percent)}% · ${text(event.message)}`
      });
      return item;
    }));
  }

  function watchTask() {
    const taskId = page.taskId.value.trim();
    if (!taskId) { page.state.textContent = "请输入任务 ID"; return; }
    if (page.source) page.source.close();
    page.state.textContent = "连接中";
    page.source = new EventSource(`/api/v1/ai-factory/progress/events?taskId=${encodeURIComponent(taskId)}`);
    page.source.addEventListener("snapshot", event => {
      render(JSON.parse(event.data));
      page.state.textContent = "实时查看中";
    });
    page.source.onerror = () => { page.state.textContent = "正在重连"; };
  }

  page.watch.addEventListener("click", watchTask);
  page.taskId.addEventListener("keydown", event => { if (event.key === "Enter") watchTask(); });
  global.sel.register("aifactory.page", { watchTask });
}(window));
