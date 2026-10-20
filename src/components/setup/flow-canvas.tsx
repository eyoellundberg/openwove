import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useStore,
  type Edge,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react'
import { useEffect, useMemo } from 'react'
import { useColorMode } from '@/hooks/use-color-mode'
import {
  CANVAS_MIN_ZOOM,
  FIT_DURATION_MS,
  FIT_PADDING,
  JOIN_STAGE_TOLERANCE,
  NODE_HEIGHT,
  ROW_GAP,
  STAGE_WIDTH,
} from '@/lib/constants'
import { toStages, type Drop } from '@/lib/engine'
import { useFlow } from '@/lib/store'
import type { Step } from '@/lib/types'
import { StepNode, type StepNodeType } from './step-node'

const nodeTypes: NodeTypes = { step: StepNode }
const ROW_HEIGHT = NODE_HEIGHT + ROW_GAP

/** Stages go left to right; steps in the same stage stack, centred on one line. */
function layout(steps: Step[]): StepNodeType[] {
  let number = 0
  return toStages(steps).flatMap((stage, g) =>
    stage.map((s, row) => ({
      id: s.id,
      type: 'step' as const,
      position: { x: g * STAGE_WIDTH, y: (row - (stage.length - 1) / 2) * ROW_HEIGHT },
      data: { stepId: s.id, number: ++number },
    })),
  )
}

/** Keep React Flow's measured sizes while snapping every card to its laid-out place. */
const placeOnLayout = (laidOut: StepNodeType[], current: StepNodeType[]) =>
  laidOut.map((n) => {
    const prev = current.find((c) => c.id === n.id)
    return prev ? { ...prev, position: n.position, data: n.data } : n
  })

/** Where a dropped card should go: into a stage it overlaps, or a new stage between two. */
function dropTarget(steps: Step[], id: string, x: number, y: number): Drop {
  const stages = toStages(steps)
  const at = x / STAGE_WIDTH
  const nearest = Math.round(at)
  const lands = Math.abs(at - nearest) <= JOIN_STAGE_TOLERANCE && nearest >= 0 && nearest < stages.length
  if (lands) {
    const others = stages[nearest].filter((s) => s.id !== id)
    if (others.length) {
      const top = -((stages[nearest].length - 1) / 2) * ROW_HEIGHT
      const row = Math.max(0, Math.round((y - top) / ROW_HEIGHT))
      return { kind: 'join', stage: nearest, row }
    }
  }
  return { kind: 'insert', at: Math.min(stages.length, Math.max(0, Math.ceil(at))) }
}

export function FlowCanvas() {
  const steps = useFlow((s) => s.steps)
  const moveStep = useFlow((s) => s.moveStep)
  const runStates = useFlow((s) =>
    s.dirty ? '' : s.tasks.filter((t) => t.runId === s.runId).map((t) => `${t.stepId}=${t.state}`).join('|'),
  )
  const colorMode = useColorMode()
  const { fitView } = useReactFlow()

  const laidOut = useMemo(() => layout(steps), [steps])
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNodeType>(laidOut)

  useEffect(() => {
    setNodes((current) => placeOnLayout(laidOut, current))
  }, [laidOut, setNodes])

  const stageCount = laidOut.length && Math.max(...laidOut.map((n) => n.position.x)) / STAGE_WIDTH + 1
  // Refit when a stage is added or removed, or the canvas changes width (the sidebar opening), after React Flow has measured the cards.
  const measured = useNodesInitialized()
  const width = useStore((s) => s.width)
  useEffect(() => {
    if (!measured) return
    const frame = requestAnimationFrame(() => fitView({ duration: FIT_DURATION_MS, padding: FIT_PADDING, minZoom: CANVAS_MIN_ZOOM }))
    return () => cancelAnimationFrame(frame)
  }, [measured, stageCount, width, fitView])

  const edges = useMemo<Edge[]>(() => {
    const state = new Map(runStates.split('|').map((kv) => kv.split('=') as [string, string]))
    const stages = toStages(steps)
    return stages.slice(1).flatMap((stage, i) =>
      stages[i].flatMap((from) =>
        stage.map((to) => {
          const target = state.get(to.id)
          const live = target === 'running' || target === 'waiting'
          return {
            id: `${from.id}->${to.id}`,
            source: from.id,
            target: to.id,
            animated: live,
            className: live ? 'is-live' : target === 'done' ? 'is-done' : undefined,
          }
        }),
      ),
    )
  }, [steps, runStates])

  const onNodeDragStop: OnNodeDrag<StepNodeType> = (_, node) => {
    const current = useFlow.getState().steps
    moveStep(node.id, dropTarget(current, node.id, node.position.x, node.position.y))
    setNodes((now) => placeOnLayout(layout(useFlow.getState().steps), now))
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={onNodeDragStop}
      colorMode={colorMode}
      fitView
      fitViewOptions={{ padding: FIT_PADDING, minZoom: CANVAS_MIN_ZOOM }}
      minZoom={CANVAS_MIN_ZOOM}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  )
}
