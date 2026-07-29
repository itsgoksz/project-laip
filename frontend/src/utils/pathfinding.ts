import * as THREE from 'three';

export interface RoadGraphNode {
  id: string;
  x: number;
  z: number;
  edges: { toId: string; distance: number }[];
}

export class RoadGraph {
  nodes: Map<string, RoadGraphNode>;

  constructor() {
    this.nodes = new Map();
  }

  addNode(x: number, z: number): string {
    // Quantize to avoid floating point mismatch
    const id = `${x.toFixed(2)},${z.toFixed(2)}`;
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, x, z, edges: [] });
    }
    return id;
  }

  addEdge(id1: string, id2: string) {
    if (id1 === id2) return;
    const n1 = this.nodes.get(id1);
    const n2 = this.nodes.get(id2);
    if (!n1 || !n2) return;

    // Check if edge already exists
    if (n1.edges.some(e => e.toId === id2)) return;

    const dist = Math.hypot(n1.x - n2.x, n1.z - n2.z);
    n1.edges.push({ toId: id2, distance: dist });
    n2.edges.push({ toId: id1, distance: dist }); // undirected
  }

  static buildFromRoads(roads: any[]): RoadGraph {
    const graph = new RoadGraph();
    roads.forEach(r => {
      if (!r.line || r.line.length < 2) return;
      let prevId: string | null = null;
      r.line.forEach((pt: any) => {
        const id = graph.addNode(pt[0], pt[1]);
        if (prevId) {
          graph.addEdge(prevId, id);
        }
        prevId = id;
      });
    });
    return graph;
  }

  findClosestNode(x: number, z: number): string | null {
    let closestId: string | null = null;
    let minDist = Infinity;
    for (const [id, node] of this.nodes.entries()) {
      const d = Math.hypot(node.x - x, node.z - z);
      if (d < minDist) {
        minDist = d;
        closestId = id;
      }
    }
    return closestId;
  }

  // Dijkstra
  findShortestPath(startX: number, startZ: number, endX: number, endZ: number): THREE.Vector3[] {
    const startId = this.findClosestNode(startX, startZ);
    const endId = this.findClosestNode(endX, endZ);

    if (!startId || !endId) return [];
    if (startId === endId) {
       const n = this.nodes.get(startId)!;
       return [new THREE.Vector3(startX, 1.5, startZ), new THREE.Vector3(n.x, 1.5, n.z), new THREE.Vector3(endX, 1.5, endZ)];
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const queue = new Set<string>();

    for (const id of this.nodes.keys()) {
      distances.set(id, Infinity);
      queue.add(id);
    }
    distances.set(startId, 0);

    while (queue.size > 0) {
      let u: string | null = null;
      let minD = Infinity;

      for (const id of queue) {
        const d = distances.get(id)!;
        if (d < minD) {
          minD = d;
          u = id;
        }
      }

      if (!u || distances.get(u) === Infinity) break;
      if (u === endId) break;

      queue.delete(u);
      const uNode = this.nodes.get(u)!;

      for (const edge of uNode.edges) {
        if (!queue.has(edge.toId)) continue;

        const alt = distances.get(u)! + edge.distance;
        if (alt < distances.get(edge.toId)!) {
          distances.set(edge.toId, alt);
          previous.set(edge.toId, u);
        }
      }
    }

    const path: THREE.Vector3[] = [];
    let curr: string | undefined = endId;
    if (previous.has(curr) || curr === startId) {
      while (curr) {
        const n = this.nodes.get(curr)!;
        path.unshift(new THREE.Vector3(n.x, 1.5, n.z));
        curr = previous.get(curr);
      }
    }

    if (path.length > 0) {
       path.unshift(new THREE.Vector3(startX, 1.5, startZ));
       path.push(new THREE.Vector3(endX, 1.5, endZ));
    } else {
       // fallback if disjoint
       path.push(new THREE.Vector3(startX, 1.5, startZ));
       path.push(new THREE.Vector3(endX, 1.5, endZ));
    }

    return path;
  }
}
