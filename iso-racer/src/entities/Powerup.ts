import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Entity } from "../core/Entity";

export type PowerupKind = "boost" | "oil" | "shield";

const KIND_COLORS: Record<PowerupKind, Color3> = {
  boost: new Color3(1, 0.75, 0.1),
  oil: new Color3(0.5, 0.2, 0.8),
  shield: new Color3(0.2, 0.9, 0.6),
};

/**
 * A floating, spinning pickup on the track. Collection logic lives in the
 * {@link PowerupSystem}; this class is just the visual + respawn state.
 */
export class Powerup extends Entity {
  readonly root: TransformNode;
  private readonly mesh: Mesh;
  readonly kind: PowerupKind;
  active = true;
  private respawn = 0;
  private spin = 0;

  static readonly RADIUS = 1.6;
  static readonly RESPAWN_TIME = 5;

  constructor(scene: Scene, position: Vector3, kind: PowerupKind) {
    super(scene);
    this.kind = kind;
    this.root = new TransformNode("powerup", scene);
    this.root.position.copyFrom(position);
    this.root.position.y = 1.1;

    this.mesh = MeshBuilder.CreatePolyhedron(
      "pu",
      { type: kind === "boost" ? 1 : kind === "shield" ? 3 : 2, size: 0.7 },
      scene
    );
    const mat = new StandardMaterial("puMat", scene);
    const col = KIND_COLORS[kind];
    mat.diffuseColor = col.scale(0.5);
    mat.emissiveColor = col;
    mat.alpha = 0.92;
    this.mesh.material = mat;
    this.mesh.parent = this.root;
  }

  /** Mark as collected; starts the respawn timer. */
  collect(): void {
    this.active = false;
    this.respawn = Powerup.RESPAWN_TIME;
    this.root.setEnabled(false);
  }

  update(dt: number): void {
    if (!this.active) {
      this.respawn -= dt;
      if (this.respawn <= 0) {
        this.active = true;
        this.root.setEnabled(true);
      }
      return;
    }
    this.spin += dt * 2;
    this.mesh.rotation.y = this.spin;
    this.mesh.position.y = Math.sin(this.spin * 1.5) * 0.18;
  }
}
