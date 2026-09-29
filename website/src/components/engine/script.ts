/**
 * @fileoverview The terminal script: the engine's quick-start commands and a
 * standard aria2 JSON-RPC call, typed at a steady pace as a function of time.
 */
type Cls = '' | 'p' | 'c' | 'k' | 's'
type Part = { cls: Cls; text: string }

const SCRIPT: [Cls, string][][] = [
  [['c', '# Download a file']],
  [
    ['p', '$ '],
    ['k', 'aria2-next'],
    ['', ' https://example.com/file.iso'],
  ],
  [],
  [['c', '# Run the JSON-RPC server']],
  [
    ['p', '$ '],
    ['k', 'aria2-next'],
    ['', ' --enable-rpc --rpc-listen-all=false --rpc-listen-port=6800'],
  ],
  [],
  [['c', '# Add a download over JSON-RPC']],
  [
    ['p', '$ '],
    ['k', 'curl'],
    ['', ' -s http://localhost:6800/jsonrpc \\'],
  ],
  [
    ['', '    -d '],
    ['s', `'{"jsonrpc":"2.0","id":"1","method":"aria2.addUri","params":[["https://example.com/file.iso"]]}'`],
  ],
]
const CPS = 42
const LINE_PAUSE = 0.35

const isComment = (line: [Cls, string][]) => line[0]?.[0] === 'c'
const lengthOf = (line: [Cls, string][]) => line.reduce((n, [, text]) => n + text.length, 0)

/** Time at which each line starts typing, with a pause between lines. */
const STARTS = (() => {
  let at = 0.6
  return SCRIPT.map((line) => {
    const start = at
    const len = lengthOf(line)
    at += (isComment(line) ? len / (CPS * 2) : len / CPS) + (len ? LINE_PAUSE : 0.1)
    return start
  })
})()

/** The whole script is on screen (plus a moment) by this time. */
export const TYPED_BY = STARTS[STARTS.length - 1] + 3.5

export interface TermLine {
  parts: Part[]
  caret: boolean
}

export function typedScript(time: number): TermLine[] {
  const out: TermLine[] = []
  let caretPlaced = false
  SCRIPT.forEach((line, i) => {
    if (time < STARTS[i]) return
    let budget = Math.floor((time - STARTS[i]) * (isComment(line) ? CPS * 2 : CPS))
    const parts: Part[] = []
    for (const [cls, text] of line) {
      if (budget <= 0) break
      const part = text.slice(0, budget)
      budget -= part.length
      parts.push({ cls, text: part })
    }
    const caret = !caretPlaced && time < (STARTS[i + 1] ?? Infinity)
    if (caret) caretPlaced = true
    out.push({ parts, caret })
  })
  if (!caretPlaced) out.push({ parts: [{ cls: 'p', text: '$ ' }], caret: true })
  return out
}
