import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Meshes/Builders/polyhedronBuilder";
import "@babylonjs/core/Meshes/Builders/tubeBuilder";
import type { IScene } from "../core/IScene";
import type { SceneManager } from "../core/SceneManager";
import { IsoCamera } from "../core/IsoCamera";
import { TrackPath } from "../entities/TrackPath";
import { Track } from "../entities/Track";
import { Car } from "../entities/Car";
import type { CarModel } from "../entities/Car";
import { InputSystem } from "../systems/InputSystem";
import { AISystem } from "../systems/AISystem";
import { RaceSystem } from "../systems/RaceSystem";
import { PowerupSystem } from "../systems/PowerupSystem";
import { HUD } from "../ui/HUD";

const OPPONENT_DEFS: { name: string; color: Color3; model: CarModel }[] = [
  { name: "Crimson", color: new Color3(0.9, 0.2, 0.25), model: "crimson" },
  { name: "Viper", color: new Color3(0.2, 0.85, 0.3), model: "viper" },
  { name: "Bolt", color: new Color3(0.95, 0.8, 0.2), model: "bolt" },
];

/**
 * The playable race. Composes the track, cars, all gameplay systems, camera and
 * HUD, and drives them in the correct order each frame. Adding a new mechanic
 * usually means instantiating one more System here.
 */
export class RaceScene implements IScene {
  readonly scene: Scene;
  private camera!: IsoCamera;
  private track!: Track;
  private cars: Car[] = [];
  private playerCar!: Car;

  private input!: InputSystem;
  private ai!: AISystem;
  private race!: RaceSystem;
  private powerups!: PowerupSystem;
  private hud!: HUD;
  private resultsTimer = -1;
  /** Gates update() until async start() (model preload + systems) completes. */
  private ready = false;

  constructor(private readonly manager: SceneManager) {
    this.scene = new Scene(manager.engine);
    this.scene.clearColor = new Color4(0.05, 0.06, 0.12, 1);
  }

  async start(): Promise<void> {
    const canvas = this.manager.engine.getRenderingCanvas()!;

    this.setupLights();

    // --- Track ---
    const path = new TrackPath(this.buildCircuitPoints());
    this.track = new Track(this.scene, path, 8);

    // --- Camera ---
    this.camera = new IsoCamera(this.scene, canvas);

    // --- Cars (player + opponents) ---
    // Load all car GLBs up front so meshes exist when the grid is built.
    await Car.preload(this.scene);

    this.playerCar = new Car(
      this.scene,
      "Player",
      new Color3(0.2, 0.5, 0.95),
      "player",
      true
    );
    this.cars.push(this.playerCar);
    OPPONENT_DEFS.forEach((d) =>
      this.cars.push(new Car(this.scene, d.name, d.color, d.model, false))
    );

    // Place on starting grid + shadows
    const shadows = this.setupShadows();
    this.cars.forEach((car, i) => {
      const slot = this.track.gridSlot(i);
      car.placeAt(slot.position, slot.forward);
      car.nextCheckpoint = 0;
      car.meshes.forEach((m) => shadows.addShadowCaster(m));
    });

    // --- Systems ---
    this.race = new RaceSystem(this.scene, this.track, this.cars);
    this.input = new InputSystem(this.scene, this.playerCar.controls);
    const opponents = this.cars.filter((c) => !c.isPlayer);
    this.ai = new AISystem(
      this.scene,
      this.track,
      opponents,
      () => this.race.racingActive
    );
    this.powerups = new PowerupSystem(this.scene, this.track, this.cars);
    this.hud = new HUD(this.scene, this.race);

    this.input.init();
    this.ai.init();
    this.powerups.init();

    this.ready = true;
  }

  private setupLights(): void {
    const hemi = new HemisphericLight(
      "hemi",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemi.intensity = 0.75;
    hemi.groundColor = new Color3(0.2, 0.25, 0.3);

    const dir = new DirectionalLight(
      "sun",
      new Vector3(-0.6, -1, 0.4),
      this.scene
    );
    dir.position = new Vector3(40, 60, -40);
    dir.intensity = 1.1;
    this.sun = dir;
  }

  private sun!: DirectionalLight;

  private setupShadows(): ShadowGenerator {
    const sg = new ShadowGenerator(1024, this.sun);
    sg.useBlurExponentialShadowMap = true;
    sg.blurScale = 2;
    return sg;
  }

  /** Control points for a fun, twisty closed circuit. */
  private buildCircuitPoints(): Vector3[] {
    return [
      new Vector3(0, 0, 28),
      new Vector3(26, 0, 24),
      new Vector3(34, 0, 4),
      new Vector3(20, 0, -10),
      new Vector3(30, 0, -28),
      new Vector3(8, 0, -38),
      new Vector3(-14, 0, -30),
      new Vector3(-10, 0, -8),
      new Vector3(-30, 0, -2),
      new Vector3(-34, 0, 18),
      new Vector3(-16, 0, 30),
    ];
  }

  update(dt: number): void {
    // Async start() (model preload) may still be running; skip until ready.
    if (!this.ready) return;

    // Fixed-ish order: input -> ai -> physics -> race rules -> powerups
    this.input.update(dt);
    this.ai.update(dt);

    for (const car of this.cars) car.update(dt);

    this.race.update(dt);
    this.powerups.update(dt);
    this.track.update(dt);

    this.camera.follow(this.playerCar.root.position);
    this.hud.update(this.playerCar);

    // Transition to results a moment after the race finishes.
    if (this.race.phase === "finished" && this.resultsTimer < 0) {
      this.resultsTimer = 3;
    }
    if (this.resultsTimer >= 0) {
      this.resultsTimer -= dt;
      if (this.resultsTimer <= 0) {
        window.__lastRaceResult = this.race.standings;
        void this.manager.switchTo("results");
      }
    }
  }

  dispose(): void {
    this.input?.dispose();
    this.ai?.dispose();
    this.powerups?.dispose();
    this.hud?.dispose();
    for (const car of this.cars) car.dispose();
    this.track?.dispose();
    this.cars = [];
  }
}
