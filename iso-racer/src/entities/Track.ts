import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Entity } from "../core/Entity";
import { TrackPath } from "./TrackPath";

export interface Checkpoint {
  index: number;
  position: Vector3;
}

/**
 * Renders a ribbon road around a {@link TrackPath}, plus a ground plane, start
 * line and a ring of checkpoints used by the race logic to validate laps.
 */
export class Track extends Entity {
  readonly root: TransformNode;
  readonly path: TrackPath;
  readonly width: number;
  readonly checkpoints: Checkpoint[] = [];
  /** Index of the start/finish sample. */
  readonly startIndex = 0;

  constructor(scene: Scene, path: TrackPath, width = 7) {
    super(scene);
    this.path = path;
    this.width = width;
    this.root = new TransformNode("track", scene);

    this.buildGround();
    this.buildRoad();
    this.buildStartLine();
    this.buildCheckpoints();
  }

  /** Get a starting grid slot facing along the track. */
  gridSlot(slot: number): { position: Vector3; forward: Vector3 } {
    const i = this.startIndex;
    const fwd = this.path.tangentAt(i);
    const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
    const row = Math.floor(slot / 2);
    const col = slot % 2 === 0 ? -1 : 1;
    const position = this.path
      .pointAt(i - row * 3)
      .add(right.scale(col * (this.width * 0.22)))
      .add(new Vector3(0, 0.4, 0));
    return { position, forward: fwd };
  }

  private buildGround(): void {
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 400, height: 400, subdivisions: 1 },
      this.scene
    );
    const mat = new StandardMaterial("groundMat", this.scene);
    const tex = new Texture("./textures/ground.png", this.scene);
    tex.uScale = 40;
    tex.vScale = 40;
    mat.diffuseTexture = tex;
    mat.diffuseColor = new Color3(0.16, 0.42, 0.22);
    mat.specularColor = Color3.Black();
    ground.material = mat;
    ground.position.y = -0.05;
    ground.parent = this.root;
    ground.receiveShadows = true;
  }

  private buildRoad(): void {
    const pts = this.path.points;
    const n = pts.length;
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const half = this.width / 2;

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const t = this.path.tangentAt(i);
      const right = Vector3.Cross(Vector3.Up(), t).normalize();
      const l = p.subtract(right.scale(half));
      const r = p.add(right.scale(half));
      positions.push(l.x, 0.02, l.z, r.x, 0.02, r.z);
      normals.push(0, 1, 0, 0, 1, 0);
      const v = (i / n) * 20;
      uvs.push(0, v, 1, v);
    }

    for (let i = 0; i < n; i++) {
      const a = (i * 2) % (n * 2);
      const b = (i * 2 + 1) % (n * 2);
      const c = ((i + 1) * 2) % (n * 2);
      const d = ((i + 1) * 2 + 1) % (n * 2);
      indices.push(a, c, b, b, c, d);
    }

    const road = new Mesh("road", this.scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.uvs = uvs;
    vd.applyToMesh(road);

    const mat = new StandardMaterial("roadMat", this.scene);
    const tex = new Texture("./textures/road.png", this.scene);
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.uScale = 2;
    mat.diffuseTexture = tex;
    mat.diffuseColor = new Color3(0.55, 0.55, 0.62);
    mat.specularColor = new Color3(0.05, 0.05, 0.08);
    road.material = mat;
    road.parent = this.root;
    road.receiveShadows = true;

    this.buildEdges();
  }

  /** Glowing curbs along both sides of the road. */
  private buildEdges(): void {
    const n = this.path.points.length;
    const left: Vector3[] = [];
    const right: Vector3[] = [];
    const half = this.width / 2 + 0.2;
    for (let i = 0; i <= n; i++) {
      const p = this.path.pointAt(i);
      const t = this.path.tangentAt(i);
      const r = Vector3.Cross(Vector3.Up(), t).normalize();
      left.push(p.subtract(r.scale(half)).add(new Vector3(0, 0.12, 0)));
      right.push(p.add(r.scale(half)).add(new Vector3(0, 0.12, 0)));
    }
    const mkTube = (pts: Vector3[], name: string, color: Color3) => {
      const tube = MeshBuilder.CreateTube(
        name,
        { path: pts, radius: 0.22, tessellation: 6, cap: Mesh.NO_CAP },
        this.scene
      );
      const m = new StandardMaterial(name + "Mat", this.scene);
      m.diffuseColor = color.scale(0.4);
      m.emissiveColor = color;
      tube.material = m;
      tube.parent = this.root;
    };
    mkTube(left, "edgeL", new Color3(0.9, 0.2, 0.35));
    mkTube(right, "edgeR", new Color3(0.2, 0.6, 0.95));
  }

  private buildStartLine(): void {
    const i = this.startIndex;
    const p = this.path.pointAt(i);
    const t = this.path.tangentAt(i);
    const line = MeshBuilder.CreateGround(
      "startLine",
      { width: this.width, height: 1.4 },
      this.scene
    );
    line.position = p.add(new Vector3(0, 0.04, 0));
    line.rotation.y = Math.atan2(t.x, t.z);
    const mat = new StandardMaterial("startMat", this.scene);
    const tex = new Texture("./textures/start.png", this.scene);
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.uScale = 6;
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.diffuseColor = new Color3(0.9, 0.9, 0.95);
    mat.emissiveColor = new Color3(0.3, 0.3, 0.35);
    line.material = mat;
    line.parent = this.root;
  }

  private buildCheckpoints(): void {
    const n = this.path.points.length;
    const count = 8;
    for (let c = 0; c < count; c++) {
      const index = Math.floor((c / count) * n);
      this.checkpoints.push({
        index,
        position: this.path.pointAt(index).clone(),
      });
    }
  }

  update(_dt: number): void {
    // Static for now; reserved for animated track elements.
  }
}
