你刚才已经完成调查，但没有通过结构化结果校验：{{error}}

不要重新调查，不要解释过程，不要回复确认语。请根据同一轮已经查到的事实，只返回一个 JSON 对象：
{"status":"verified或unknown","answeredQuestion":"原样复制客户原问题","summary":"直接回答客户原问题的调查结论","evidence":[{"source":"任务标识、文件行号或记录位置","detail":"实际查到的事实"}],"unknowns":["尚不能核实的部分"]}

客户原问题：{{customerQuestion}}
