import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import "@babylonjs/loaders/glTF/2.0";
import { Entity } from "../core/Entity";
import { Config } from "../utils/Config";
import { clamp, lerp } from "../utils/math";

/**
 * Which low-poly GLB model a car uses. Each racer has its own generated mesh
 * living under /models/<variant>/model.glb (see public/models).
 */
export type CarModel = "player" | "crimson" | "viper" | "bolt";

const MODEL_PATHS: Record<CarModel, string> = {
  player: "models/player/model.glb",
  crimson: "models/crimson/model.glb",
  viper: "models/viper/model.glb",
  bolt: "models/bolt/model.glb",
};

/**
 * The Meshy models are authored at an arbitrary scale/orientation. We normalize
 * each loaded model to roughly the old procedural footprint (~1.4w x 2.4d,
 * sitting on the ground) so gameplay tuning still feels right.
 */
const TARGET_LENGTH = 2.6; // meters along the longest horizontal axis

/**
 * Extra yaw (radians, around Y) applied to align each model's nose with the
 * game's forward direction (+Z). The generated meshes face along their long
 * horizontal axis which lands on +X, so a -90° turn points them down +Z.
 * Per-model overrides handle any mesh authored differently.
 */
const DEFAULT_YAW_OFFSET = -Math.PI / 2;
const YAW_OFFSET: Partial<Record<CarModel, number>> = {};

/** Steering / throttle inputs in range [-1, 1] / [-1, 1]. */
export interface CarControls {
  throttle: number; // -1 reverse .. 1 forward
  steer: number; // -1 left .. 1 right
  boost: boolean;
}

/**
 * An arcade car. It is intentionally NOT a rigid-body sim: we model speed along
 * a heading with simple grip and drag for a snappy, drifty arcade feel. Both
 * the player and the AI drive instances of this class; only the controller that
 * feeds {@link controls} differs.
 */
export class Car extends Entity {
  readonly root: TransformNode;
  private readonly body: TransformNode;

  readonly controls: CarControls = { throttle: 0, steer: 0, boost: false };

  /** Heading angle (radians, around Y). */
  heading = 0;
  /** Scalar speed along heading (m/s). Negative = reversing. */
  speed = 0;

  // Boost state
  boostTimer = 0;
  private boostCharges = 0;

  // Race tracking (populated by RaceSystem)
  lap = 0;
  nextCheckpoint = 0;
  pathHint = 0;
  finished = false;
  finishTime = 0;
  readonly isPlayer: boolean;
  readonly name: string;

  /** Loaded GLB containers, cached per model variant for cheap reuse. */
  private static containers = new Map<CarModel, AssetContainer>();

  /**
   * Load every car GLB up front. Call (and await) this once before creating
   * cars so the meshes are ready when the race starts. Safe to call repeatedly.
   */
  static async preload(scene: Scene): Promise<void> {
    const variants = Object.keys(MODEL_PATHS) as CarModel[];
    await Promise.all(
      variants.map(async (variant) => {
        if (Car.containers.has(variant)) return;
        const container = await LoadAssetContainerAsync(
          MODEL_PATHS[variant],
          scene
        );
        Car.containers.set(variant, container);
      })
    );
  }

  constructor(
    scene: Scene,
    name: string,
    color: Color3,
    model: CarModel,
    isPlayer = false
  ) {
    super(scene);
    this.name = name;
    this.isPlayer = isPlayer;
    this.root = new TransformNode("car_" + name, scene);
    this.body = new TransformNode("body_" + name, scene);
    this.body.parent = this.root;
    this.buildMesh(model, color);
  }

  /** Meshes that make up this car's visual (for shadow registration etc). */
  meshes: AbstractMesh[] = [];

  private buildMesh(model: CarModel, color: Color3): void {
    const container = Car.containers.get(model);
    if (!container) {
      // Fallback: if preload was skipped, draw a simple tinted box so the car
      // is still visible/driveable rather than invisible.
      this.buildPlaceholder(color);
      return;
    }

    const instanced = container.instantiateModelsToScene(
      (n) => `${model}_${this.name}_${n}`,
      false
    );

    // Orientation node: lets us yaw the model to face +Z without touching the
    // body's roll/pitch "juice" (which uses rotation.x/z on `this.body`). We
    // leave it unrotated while measuring/recentring, then apply the yaw last so
    // the bounds math stays in the model's own axis-aligned frame.
    const modelRoot = new TransformNode(`model_${this.name}`, this.scene);
    modelRoot.parent = this.body;

    const roots = instanced.rootNodes.filter(
      (n): n is TransformNode => n instanceof TransformNode
    );
    for (const node of roots) node.parent = modelRoot;

    // Collect meshes, apply the racer's color, and gather world-space bounds.
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const node of roots) {
      const meshes = node
        .getChildMeshes()
        .filter((m): m is AbstractMesh => m instanceof AbstractMesh);
      if (node instanceof AbstractMesh) meshes.push(node);
      for (const mesh of meshes) {
        this.meshes.push(mesh);
        this.tint(mesh, color);
        mesh.computeWorldMatrix(true);
        const bb = mesh.getBoundingInfo().boundingBox;
        min.minimizeInPlace(bb.minimumWorld);
        max.maximizeInPlace(bb.maximumWorld);
      }
    }

    this.normalize(roots, min, max);

    // Now face the model forward (+Z). Applied after recentring so the yaw
    // does not skew the bounds-based offsets above.
    modelRoot.rotation.y = YAW_OFFSET[model] ?? DEFAULT_YAW_OFFSET;
  }

  /** Scale + recentre the loaded model to the target footprint, on the ground. */
  private normalize(
    roots: TransformNode[],
    min: Vector3,
    max: Vector3
  ): void {
    const size = max.subtract(min);
    const longest = Math.max(size.x, size.z) || 1;
    const scale = TARGET_LENGTH / longest;

    for (const node of roots) {
      node.scaling.scaleInPlace(scale);
      // Recentre horizontally and drop onto the ground (y=0 at the base).
      const center = min.add(max).scale(0.5);
      node.position.x -= center.x * scale;
      node.position.z -= center.z * scale;
      node.position.y -= min.y * scale;
    }
  }

  /** Apply the racer's identity color to a mesh's base/albedo color. */
  private tint(mesh: AbstractMesh, color: Color3): void {
    const mat = mesh.material;
    if (mat instanceof PBRMaterial) {
      mat.albedoColor = color;
    } else if (mat instanceof StandardMaterial) {
      mat.diffuseColor = color;
    }
  }

  private buildPlaceholder(color: Color3): void {
    const chassis = MeshBuilder.CreateBox(
      "chassis",
      { width: 1.4, height: 0.5, depth: 2.4 },
      this.scene
    );
    chassis.position.y = 0.45;
    const bodyMat = new StandardMaterial("bodyMat", this.scene);
    bodyMat.diffuseColor = color;
    bodyMat.specularColor = new Color3(0.4, 0.4, 0.45);
    chassis.material = bodyMat;
    chassis.parent = this.body;
    this.meshes.push(chassis);
  }

  /** Add a boost pickup charge. */
  addBoostCharge(): void {
    this.boostCharges = Math.min(this.boostCharges + 1, 3);
  }

  get charges(): number {
    return this.boostCharges;
  }

  get isBoosting(): boolean {
    return this.boostTimer > 0;
  }

  /** Place the car at a position facing a direction. */
  placeAt(position: Vector3, forward: Vector3): void {
    this.root.position.copyFrom(position);
    this.heading = Math.atan2(forward.x, forward.z);
    this.root.rotation.y = this.heading;
    this.speed = 0;
  }

  get forward(): Vector3 {
    return new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  update(dt: number): void {
    if (this.finished) {
      // Coast to a stop after finishing.
      this.controls.throttle = 0;
      this.controls.boost = false;
    }

    const c = Config.car;

    // --- Boost handling ---
    if (this.controls.boost && this.boostCharges > 0 && this.boostTimer <= 0) {
      this.boostCharges--;
      this.boostTimer = Config.boost.duration;
    }
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);

    // --- Acceleration / braking ---
    const boosting = this.boostTimer > 0;
    const maxSpeed = boosting ? c.boostMaxSpeed : c.maxSpeed;
    const accel = c.acceleration * (boosting ? Config.boost.accelMultiplier : 1);

    if (this.controls.throttle > 0) {
      this.speed += accel * this.controls.throttle * dt;
    } else if (this.controls.throttle < 0) {
      if (this.speed > 0) {
        this.speed -= c.brakeForce * dt; // braking
      } else {
        this.speed -= c.acceleration * 0.6 * dt; // reverse
      }
    } else {
      // Coasting drag
      this.speed -= Math.sign(this.speed) * c.drag * dt;
      if (Math.abs(this.speed) < c.drag * dt) this.speed = 0;
    }

    this.speed = clamp(this.speed, -c.reverseSpeed, maxSpeed);

    // --- Steering (scaled by how fast we're going) ---
    const speedFactor = clamp(Math.abs(this.speed) / c.maxSpeed, 0, 1);
    const turn = this.controls.steer * c.turnRate * speedFactor * dt;
    this.heading += turn * Math.sign(this.speed || 1);

    // --- Move ---
    const move = this.forward.scale(this.speed * dt);
    this.root.position.addInPlace(move);
    this.root.rotation.y = this.heading;

    // --- Visual juice: body roll into corners + squash on boost ---
    const targetRoll = -this.controls.steer * c.bodyRoll * speedFactor;
    this.body.rotation.z = lerp(this.body.rotation.z, targetRoll, 0.15);
    const targetPitch = clamp(-this.controls.throttle * 0.04, -0.05, 0.05);
    this.body.rotation.x = lerp(this.body.rotation.x, targetPitch, 0.1);
  }
}
