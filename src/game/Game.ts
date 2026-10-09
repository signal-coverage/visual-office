import * as THREE from 'three'
import { moveWithCollisions } from './collision'
import { buildOffice } from './office'

const PLAYER_RADIUS = 0.4
const EYE_HEIGHT = 1.65
const WALK_SPEED = 4
const RUN_SPEED = 7
const MOUSE_SENSITIVITY = 0.002
const MAX_PITCH = Math.PI / 2 - 0.05

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly clock = new THREE.Clock()
  private readonly keys = new Set<string>()
  private readonly office = buildOffice()
  private position: { x: number; z: number }
  private yaw = 0
  private pitch = 0
  private frameId = 0

  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.shadowMap.enabled = true
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    this.position = { ...this.office.spawn }
    this.yaw = -Math.PI / 2

    this.scene.background = new THREE.Color(0x1b1d24)
    this.scene.add(this.office.group)
    this.addLights()

    this.resize()
    window.addEventListener('resize', this.resize)
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('click', this.requestLock)

    this.loop()
  }

  dispose() {
    cancelAnimationFrame(this.frameId)
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('click', this.requestLock)
    this.renderer.dispose()
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x666670, 0.9))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(4, 8, 3)
    sun.castShadow = true
    sun.shadow.camera.left = -12
    sun.shadow.camera.right = 12
    sun.shadow.camera.top = 12
    sun.shadow.camera.bottom = -12
    this.scene.add(sun)
  }

  private readonly requestLock = () => {
    void this.canvas.requestPointerLock()
  }

  private get isLocked() {
    return document.pointerLockElement === this.canvas
  }

  private readonly onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code)
  private readonly onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)

  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return
    this.yaw -= e.movementX * MOUSE_SENSITIVITY
    this.pitch -= e.movementY * MOUSE_SENSITIVITY
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch))
  }

  private readonly resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private update(dt: number) {
    if (this.isLocked) {
      const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'))
      const strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
      const length = Math.hypot(forward, strafe)
      if (length > 0) {
        const speed = this.keys.has('ShiftLeft') ? RUN_SPEED : WALK_SPEED
        const sin = Math.sin(this.yaw)
        const cos = Math.cos(this.yaw)
        // Camera looks toward (-sin, -cos) at yaw; right vector is (cos, -sin)
        const dx = (-sin * forward + cos * strafe) / length
        const dz = (-cos * forward - sin * strafe) / length
        this.position = moveWithCollisions(
          this.position,
          { x: dx * speed * dt, z: dz * speed * dt },
          this.office.colliders,
          PLAYER_RADIUS,
        )
      }
    }

    this.camera.position.set(this.position.x, EYE_HEIGHT, this.position.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  private readonly loop = () => {
    this.frameId = requestAnimationFrame(this.loop)
    this.update(Math.min(this.clock.getDelta(), 0.1))
    this.renderer.render(this.scene, this.camera)
  }
}
