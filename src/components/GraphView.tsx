import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from 'd3-force';
import { useEffect, useReducer, useRef, useState } from 'react';
import { normalizeTitle } from '../lib/wikilinks';
import type { LinkGraph } from '../lib/graph';
import type { Note } from '../types';

interface GraphNode {
  id: string;
  degree: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphViewProps {
  notes: Note[];
  graph: LinkGraph;
  onOpenNote: (id: string) => void;
  onCreateNoteAt: (title: string) => Promise<Note>;
  onLinkNotes: (sourceId: string, targetId: string) => void;
}

const DRAG_THRESHOLD = 5;
const BASE_RADIUS = 14;

function endpointId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id;
}

function nodeRadius(node: GraphNode): number {
  return BASE_RADIUS + Math.min(node.degree, 8) * 2;
}

export function GraphView({ notes, graph, onOpenNote, onCreateNoteAt, onLinkNotes }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const pendingPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [, forceRender] = useReducer((c: number) => c + 1, 0);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [creatingAt, setCreatingAt] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(
    null,
  );
  const [draftTitle, setDraftTitle] = useState('');

  const dragState = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Center the view once we know the container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPan({ x: rect.width / 2, y: rect.height / 2 });
  }, []);

  const topologyIds = notes.map((n) => n.id).sort();
  const topologyEdges: string[] = [];
  for (const [source, targets] of graph.outgoing) {
    for (const target of targets) topologyEdges.push(`${source}>${target}`);
  }
  topologyEdges.sort();
  const topology = `${topologyIds.join(',')}|${topologyEdges.join(',')}`;

  useEffect(() => {
    const byId = new Map(nodesRef.current.map((n) => [n.id, n] as const));
    const nodes: GraphNode[] = notes.map((note) => {
      const existing = byId.get(note.id);
      const degree = (graph.incoming.get(note.id)?.length ?? 0) + (graph.outgoing.get(note.id)?.length ?? 0);
      if (existing) {
        existing.degree = degree;
        return existing;
      }
      const pending = pendingPositionsRef.current.get(normalizeTitle(note.title));
      if (pending) {
        pendingPositionsRef.current.delete(normalizeTitle(note.title));
        return { id: note.id, degree, x: pending.x, y: pending.y, fx: pending.x, fy: pending.y };
      }
      return { id: note.id, degree, x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 };
    });

    const links: GraphLink[] = [];
    for (const [source, targets] of graph.outgoing) {
      for (const target of targets) links.push({ source, target });
    }

    nodesRef.current = nodes;
    linksRef.current = links;

    let sim = simulationRef.current;
    if (!sim) {
      sim = forceSimulation<GraphNode>(nodes)
        .force('charge', forceManyBody().strength(-260))
        // Gentle, damped pull toward the origin so the graph doesn't drift
        // off unboundedly. Deliberately NOT forceCenter: that recenters the
        // whole graph's mean position instantly and undamped every tick,
        // which fights violently with manually-pinned (fx/fy) nodes sitting
        // away from the origin and can fling free nodes off-screen.
        .force('x', forceX(0).strength(0.02))
        .force('y', forceY(0).strength(0.02))
        .force('collide', forceCollide<GraphNode>((n) => nodeRadius(n) + 6))
        .on('tick', () => forceRender());
      simulationRef.current = sim;
    } else {
      sim.nodes(nodes);
    }
    sim.force(
      'link',
      forceLink<GraphNode, GraphLink>(links)
        .id((n) => n.id)
        .distance(90)
        .strength(0.4),
    );
    sim.alpha(0.6).restart();
  }, [topology]);

  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
    };
  }, []);

  function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = containerRef.current?.getBoundingClientRect();
    const screenX = clientX - (rect?.left ?? 0);
    const screenY = clientY - (rect?.top ?? 0);
    return { x: (screenX - pan.x) / zoom, y: (screenY - pan.y) / zoom };
  }

  function handleNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { id, startX: e.clientX, startY: e.clientY, moved: false };
    setDragNodeId(id);
    simulationRef.current?.alphaTarget(0.3).restart();
  }

  function handleBackgroundPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    panState.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragState.current) {
      const { id, startX, startY } = dragState.current;
      const node = nodesRef.current.find((n) => n.id === id);
      if (!node) return;
      if (!dragState.current.moved) {
        const traveled = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (traveled < DRAG_THRESHOLD) return;
        dragState.current.moved = true;
      }
      const world = screenToWorld(e.clientX, e.clientY);
      node.fx = world.x;
      node.fy = world.y;
      node.x = world.x;
      node.y = world.y;

      let hovered: string | null = null;
      for (const other of nodesRef.current) {
        if (other.id === id) continue;
        const dist = Math.hypot(other.x - world.x, other.y - world.y);
        if (dist < nodeRadius(other) + 4) {
          hovered = other.id;
          break;
        }
      }
      setHoveredTargetId(hovered);
      forceRender();
      return;
    }
    if (panState.current) {
      const { startX, startY, originX, originY } = panState.current;
      setPan({ x: originX + (e.clientX - startX), y: originY + (e.clientY - startY) });
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragState.current) {
      const { id, moved } = dragState.current;
      const node = nodesRef.current.find((n) => n.id === id);
      simulationRef.current?.alphaTarget(0);

      if (!moved) {
        onOpenNote(id);
      } else if (hoveredTargetId && hoveredTargetId !== id) {
        onLinkNotes(id, hoveredTargetId);
        const target = nodesRef.current.find((n) => n.id === hoveredTargetId);
        if (node && target) {
          // The node was dropped right on top of the target. Nudge it a
          // safe distance away before releasing it to the simulation, or
          // forceManyBody's near-zero-distance repulsion flings it offscreen.
          const angle = Math.random() * Math.PI * 2;
          const offset = nodeRadius(node) + nodeRadius(target) + 40;
          node.x = target.x + Math.cos(angle) * offset;
          node.y = target.y + Math.sin(angle) * offset;
          // Defensive: forces computed while a node was pinned can still
          // leave stray velocity behind (fx/fy only overrides the
          // resulting position, not the velocity calculation).
          node.vx = 0;
          node.vy = 0;
          node.fx = null;
          node.fy = null;
          simulationRef.current?.alpha(0.4).restart();
        }
      }
      // else: dropped on empty space -> keep it pinned where the user put it.

      dragState.current = null;
      setDragNodeId(null);
      setHoveredTargetId(null);
    }
    panState.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  function handleBackgroundDoubleClick(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    const screenX = e.clientX - (rect?.left ?? 0);
    const screenY = e.clientY - (rect?.top ?? 0);
    const world = screenToWorld(e.clientX, e.clientY);
    setCreatingAt({ x: world.x, y: world.y, screenX, screenY });
    setDraftTitle('');
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const screenX = e.clientX - (rect?.left ?? 0);
    const screenY = e.clientY - (rect?.top ?? 0);
    const factor = Math.exp(-e.deltaY * 0.001);
    const newZoom = Math.min(3, Math.max(0.2, zoom * factor));
    setPan((prev) => ({
      x: screenX - ((screenX - prev.x) / zoom) * newZoom,
      y: screenY - ((screenY - prev.y) / zoom) * newZoom,
    }));
    setZoom(newZoom);
  }

  async function commitDraftNote() {
    const title = draftTitle.trim();
    setCreatingAt(null);
    if (!title || !creatingAt) return;
    pendingPositionsRef.current.set(normalizeTitle(title), { x: creatingAt.x, y: creatingAt.y });
    await onCreateNoteAt(title);
  }

  const nodesById = new Map(nodesRef.current.map((n) => [n.id, n] as const));
  const notesById = new Map(notes.map((n) => [n.id, n] as const));

  return (
    <div
      ref={containerRef}
      className="graph-view"
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleBackgroundDoubleClick}
      onWheel={handleWheel}
    >
      <div className="graph-hint">Double-click empty space for a new note · Drag a note onto another to link them</div>
      <svg width="100%" height="100%">
        <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {linksRef.current.map((link, i) => {
            const source = nodesById.get(endpointId(link.source));
            const target = nodesById.get(endpointId(link.target));
            if (!source || !target) return null;
            return (
              <line
                key={i}
                className="graph-edge"
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
              />
            );
          })}
          {nodesRef.current.map((node) => {
            const note = notesById.get(node.id);
            if (!note) return null;
            const isDragging = node.id === dragNodeId;
            const isHovered = node.id === hoveredTargetId;
            return (
              <g
                key={node.id}
                className="graph-node"
                transform={`translate(${node.x}, ${node.y})`}
                onPointerDown={(e) => handleNodePointerDown(e, node.id)}
              >
                <circle
                  r={nodeRadius(node)}
                  className={isHovered ? 'graph-node-circle link-target' : isDragging ? 'graph-node-circle dragging' : 'graph-node-circle'}
                />
                <text className="graph-node-label" y={nodeRadius(node) + 14}>
                  {note.title || 'Untitled'}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {creatingAt && (
        <input
          autoFocus
          className="graph-create-input"
          style={{ left: creatingAt.screenX, top: creatingAt.screenY }}
          value={draftTitle}
          placeholder="New note title…"
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitDraftNote();
            if (e.key === 'Escape') setCreatingAt(null);
          }}
          onBlur={() => void commitDraftNote()}
        />
      )}
    </div>
  );
}
