import * as THREE from 'three'
import type { Box } from './collision'

export interface Office {
  group: THREE.Group
  colliders: Box[]
  spawn: { x: number; z: number }
}

const WIDTH = 20
const DEPTH = 14
const HEIGHT = 3
const WALL = 0.3

function boxCollider(x: number, z: number, w: number, d: number): Box {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }
}

export function buildOffice(): Office {
  const group = new THREE.Group()
  const colliders: Box[] = []

  const add = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
    solid = true,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color }),
    )
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    if (solid) colliders.push(boxCollider(x, z, w, d))
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, DEPTH),
    new THREE.MeshStandardMaterial({ color: 0x8d8d92 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  group.add(floor)

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, DEPTH),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = HEIGHT
  group.add(ceiling)

  // Outer walls
  add(WIDTH, HEIGHT, WALL, 0, HEIGHT / 2, -DEPTH / 2, 0xe8e4da)
  add(WIDTH, HEIGHT, WALL, 0, HEIGHT / 2, DEPTH / 2, 0xe8e4da)
  add(WALL, HEIGHT, DEPTH, -WIDTH / 2, HEIGHT / 2, 0, 0xe8e4da)
  add(WALL, HEIGHT, DEPTH, WIDTH / 2, HEIGHT / 2, 0, 0xe8e4da)

  // Two rows of desks, each with a monitor
  for (const z of [-3, 3]) {
    for (const x of [-6, -2, 2, 6]) {
      add(1.8, 0.75, 0.9, x, 0.375, z, 0x9c6b3f)
      add(0.6, 0.4, 0.05, x, 1.0, z - 0.2, 0x222222, false)
    }
  }

  // Meeting room divider with a gap as a door
  add(0.2, HEIGHT, 4, 8.5, HEIGHT / 2, -5, 0xcfd8dc)
  add(0.2, HEIGHT, 4, 8.5, HEIGHT / 2, 5, 0xcfd8dc)
  add(2.4, 0.75, 1.2, 9.2, 0.375, 0, 0x6d4c41)

  return { group, colliders, spawn: { x: -8, z: 0 } }
}
