import { useState } from "react";

import { SelUiDisclosure } from "../../../theme/SelUiDisclosure";
import type { TestConsoleViewModel } from "../model/createTestConsoleViewModel";

/** 测试台纯视图只显示权威记录；“通过”状态完全由 ViewModel 中的真实任务事实决定。 */
export function TestConsoleView({ viewModel }: { viewModel: TestConsoleViewModel }) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const { copy, summary, checks, details, history } = viewModel;

  return <div className="test-console-view" role="region" aria-label={copy.title}>
    <header className="test-console-intro">
      <div><strong>{summary.title}</strong><span className={`test-console-status ${summary.statusCode}`}>{summary.status}</span></div>
      <p>{copy.readonly}</p>
      {summary.updatedAt && <time dateTime={summary.updatedAt}>{new Date(summary.updatedAt).toLocaleString()}</time>}
    </header>

    <section className="test-console-section" aria-labelledby="test-console-change-title">
      <h3 id="test-console-change-title">{copy.change}</h3>
      <p>{summary.change || copy.empty}</p>
      {summary.remaining && <p className="test-console-remaining">{summary.remaining}</p>}
    </section>

    <section className="test-console-section" aria-labelledby="test-console-checks-title">
      <h3 id="test-console-checks-title">{copy.checks}</h3>
      <div className="test-console-checks">
        {checks.map((check) => <article key={check.id} className={`test-console-check ${check.status}`}>
          <div><strong>{check.label}</strong><span>{check.statusLabel}</span></div>
          <p>{check.detail}</p>
        </article>)}
      </div>
    </section>

    <SelUiDisclosure
      idPrefix="test-console-technical"
      trigger={<strong>{copy.technical}</strong>}
      open={technicalOpen}
      className="test-console-disclosure"
      onOpenChange={setTechnicalOpen}
    >
      <div className="test-console-details">
        {details.acceptanceCriteria.length > 0 && <section><h4>{copy.acceptance}</h4><ul>{details.acceptanceCriteria.map((item, index) => <li key={`acceptance-${index}`}>{item}</li>)}</ul></section>}
        {details.changedFiles.length > 0 && <section><h4>{copy.files}</h4><ul>{details.changedFiles.map((item) => <li key={item}><code>{item}</code></li>)}</ul></section>}
        {details.technicalEvidence.length > 0 && <section><h4>{copy.technical}</h4><ul>{details.technicalEvidence.map((item, index) => <li key={`evidence-${index}`}>{item}</li>)}</ul></section>}
        {details.acceptanceCriteria.length + details.changedFiles.length + details.technicalEvidence.length === 0 && <p>{copy.empty}</p>}
      </div>
    </SelUiDisclosure>

    <section className="test-console-section" aria-labelledby="test-console-history-title">
      <h3 id="test-console-history-title">{copy.history}</h3>
      {history.length === 0 ? <p>{copy.empty}</p> : <ol className="test-console-history">
        {history.map((item) => <li key={item.id}><i aria-hidden="true" /><div><span>{item.title}</span><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time></div></li>)}
      </ol>}
    </section>
  </div>;
}
