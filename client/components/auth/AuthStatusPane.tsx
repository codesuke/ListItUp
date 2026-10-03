"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";

const TERRAIN_WIDTH = 18;
const TERRAIN_DEPTH = 14;
const COLUMNS = 112;
const ROWS = 84;
const SEGMENT_COUNT = (ROWS + 1) * COLUMNS + (COLUMNS + 1) * ROWS;
const SURFACE_COLOR = 0xc8d1d4;
const DEPTH_LAYER_COLOR = 0x6f7a80;
const ACCENT_COLOR = 0xc4581a;
const SCANNER_COLOR = 0xf06b2a;
const WORDMARK = "ListItUp";
const SCRAMBLE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

type GridLayer = {
  grid: THREE.LineSegments;
  gridGeometry: THREE.BufferGeometry;
  positions: Float32Array;
  heightScale: number;
};

export function scrambleWordmark(
  revealedCharacters: number,
  random = Math.random
): string {
  return WORDMARK.split("")
    .map((character, index) =>
      index < revealedCharacters
        ? character
        : SCRAMBLE_CHARACTERS[Math.floor(random() * SCRAMBLE_CHARACTERS.length)]
    )
    .join("");
}

function createSquareGrid(
  scene: THREE.Scene,
  color: number,
  opacity: number,
  verticalOffset = 0,
  heightScale = 1
): GridLayer {
  const positions = new Float32Array(SEGMENT_COUNT * 2 * 3);
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  const grid = new THREE.LineSegments(
    gridGeometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.set(0.2, -0.28 + verticalOffset, -0.45);
  scene.add(grid);
  return { grid, gridGeometry, positions, heightScale };
}

function hash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const smoothX = tx * tx * (3 - 2 * tx);
  const smoothY = ty * ty * (3 - 2 * ty);
  const bottom = THREE.MathUtils.lerp(hash(x0, y0), hash(x0 + 1, y0), smoothX);
  const top = THREE.MathUtils.lerp(
    hash(x0, y0 + 1),
    hash(x0 + 1, y0 + 1),
    smoothX
  );
  return THREE.MathUtils.lerp(bottom, top, smoothY);
}

function fbm(x: number, y: number, time: number): number {
  let sum = 0;
  let amplitude = 0.62;
  let frequency = 0.42;
  for (let octave = 0; octave < 4; octave++) {
    sum +=
      (valueNoise(
        (x - time * 0.36) * frequency,
        (y - time * 0.36) * frequency
      ) *
        2 -
        1) *
      amplitude;
    frequency *= 2.05;
    amplitude *= 0.5;
  }
  return sum;
}

function elevation(x: number, y: number, t: number): number {
  const time = t * 0.001;
  const ridgeA = 1.5 * Math.exp(-((x - 2.6) ** 2 / 17 + (y - 0.35) ** 2 / 3.2));
  const ridgeB = 1.1 * Math.exp(-((x + 3.7) ** 2 / 21 + (y + 1.2) ** 2 / 5.1));
  const ridgeC = 0.9 * Math.exp(-((x - 6.1) ** 2 / 8 + (y + 2.7) ** 2 / 5.8));
  const waterMotion = Math.sin((x + y) * 0.6 - time * 1.2) * 0.13;
  const flow = (time * 0.052) % 1;
  const travellingSwell =
    0.28 *
    Math.exp(
      -(
        (x - (-7.4 + flow * 14.8)) ** 2 / 8 +
        (y - (-5.7 + flow * 11.4)) ** 2 / 6
      )
    );
  return (
    ridgeA +
    ridgeB +
    ridgeC +
    fbm(x, y, time) * 0.95 +
    waterMotion +
    travellingSwell
  );
}

export function AuthStatusPane() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrambleFrameRef = useRef<number | null>(null);
  const [wordmark, setWordmark] = useState(WORDMARK);

  useEffect(() => {
    return () => {
      if (scrambleFrameRef.current) {
        window.cancelAnimationFrame(scrambleFrameRef.current);
      }
    };
  }, []);

  function scrambleWordmarkOnHover() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (scrambleFrameRef.current) {
      window.cancelAnimationFrame(scrambleFrameRef.current);
    }

    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / 700, 1);
      setWordmark(scrambleWordmark(Math.floor(progress * WORDMARK.length)));
      if (progress < 1) {
        scrambleFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        scrambleFrameRef.current = null;
      }
    };

    scrambleFrameRef.current = window.requestAnimationFrame(animate);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const surface = createSquareGrid(scene, SURFACE_COLOR, 0.3);
    const mesh = surface.grid;
    const depthLayer = createSquareGrid(
      scene,
      DEPTH_LAYER_COLOR,
      0.12,
      -0.22,
      0.72
    );
    const depthMesh = depthLayer.grid;
    depthMesh.position.y -= 0.22;

    const contours = [-2.7, -0.85, 1.05].map((contourY, index) => {
      const positions = new Float32Array((COLUMNS + 1) * 3);
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      const line = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({
          color: ACCENT_COLOR,
          transparent: true,
          opacity: index ? 0.52 : 0.82,
        })
      );
      line.rotation.copy(mesh.rotation);
      line.position.copy(mesh.position);
      scene.add(line);
      return { contourY, positions, lineGeometry, line };
    });

    const markerPositions = new Float32Array(42 * 3);
    for (let i = 0; i < 42; i++) {
      markerPositions[i * 3] = -8.2 + ((i * 2.93) % 16.4);
      markerPositions[i * 3 + 1] = -5.4 + ((i * 1.71) % 10.8);
    }
    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(markerPositions, 3)
    );
    const markers = new THREE.Points(
      markerGeometry,
      new THREE.PointsMaterial({
        color: ACCENT_COLOR,
        size: 2.25,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: false,
      })
    );
    markers.rotation.copy(mesh.rotation);
    markers.position.copy(mesh.position);
    scene.add(markers);

    const scanPositions = new Float32Array((COLUMNS + 1) * 3);
    const scanGeometry = new THREE.BufferGeometry();
    scanGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(scanPositions, 3)
    );
    const scanner = new THREE.Line(
      scanGeometry,
      new THREE.LineBasicMaterial({
        color: SCANNER_COLOR,
        transparent: true,
        opacity: 0.9,
      })
    );
    scanner.rotation.copy(mesh.rotation);
    scanner.position.copy(mesh.position);
    scene.add(scanner);

    let pointerX = 0;
    let pointerY = 0;
    let viewX = 0;
    let viewY = 0;

    function handlePointerMove(event: PointerEvent) {
      const bounds = canvas!.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    }

    function handlePointerLeave() {
      pointerX = 0;
      pointerY = 0;
    }

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    function writeGridPoint(
      primary: GridLayer,
      secondary: GridLayer,
      offset: number,
      x: number,
      y: number,
      t: number
    ): number {
      const height = elevation(x, y, t);
      primary.positions[offset] = x;
      secondary.positions[offset] = x;
      primary.positions[offset + 1] = y;
      secondary.positions[offset + 1] = y;
      primary.positions[offset + 2] = height * primary.heightScale;
      secondary.positions[offset + 2] = height * secondary.heightScale;
      return offset + 3;
    }

    function updateGrid(primary: GridLayer, secondary: GridLayer, t: number) {
      let offset = 0;
      for (let row = 0; row <= ROWS; row++) {
        const y = -TERRAIN_DEPTH / 2 + (row / ROWS) * TERRAIN_DEPTH;
        for (let column = 0; column < COLUMNS; column++) {
          offset = writeGridPoint(
            primary,
            secondary,
            offset,
            -TERRAIN_WIDTH / 2 + (column / COLUMNS) * TERRAIN_WIDTH,
            y,
            t
          );
          offset = writeGridPoint(
            primary,
            secondary,
            offset,
            -TERRAIN_WIDTH / 2 + ((column + 1) / COLUMNS) * TERRAIN_WIDTH,
            y,
            t
          );
        }
      }
      for (let column = 0; column <= COLUMNS; column++) {
        const x = -TERRAIN_WIDTH / 2 + (column / COLUMNS) * TERRAIN_WIDTH;
        for (let row = 0; row < ROWS; row++) {
          offset = writeGridPoint(
            primary,
            secondary,
            offset,
            x,
            -TERRAIN_DEPTH / 2 + (row / ROWS) * TERRAIN_DEPTH,
            t
          );
          offset = writeGridPoint(
            primary,
            secondary,
            offset,
            x,
            -TERRAIN_DEPTH / 2 + ((row + 1) / ROWS) * TERRAIN_DEPTH,
            t
          );
        }
      }
      primary.gridGeometry.attributes.position.needsUpdate = true;
      secondary.gridGeometry.attributes.position.needsUpdate = true;
    }

    function updateTerrain(t: number) {
      updateGrid(surface, depthLayer, t);

      contours.forEach(({ contourY, positions, lineGeometry }) => {
        for (let column = 0; column <= COLUMNS; column++) {
          const x = -TERRAIN_WIDTH / 2 + (column / COLUMNS) * TERRAIN_WIDTH;
          positions[column * 3] = x;
          positions[column * 3 + 1] = contourY;
          positions[column * 3 + 2] = elevation(x, contourY, t) + 0.045;
        }
        lineGeometry.attributes.position.needsUpdate = true;
      });

      for (let point = 0; point < markerPositions.length / 3; point++) {
        const x = markerPositions[point * 3];
        const y = markerPositions[point * 3 + 1];
        markerPositions[point * 3 + 2] = elevation(x, y, t) + 0.08;
      }
      markerGeometry.attributes.position.needsUpdate = true;

      const scanOffset = -16 + ((t * 0.000075) % 1) * 32;
      const scanStart = Math.max(
        -TERRAIN_WIDTH / 2,
        scanOffset - TERRAIN_DEPTH / 2
      );
      const scanEnd = Math.min(
        TERRAIN_WIDTH / 2,
        scanOffset + TERRAIN_DEPTH / 2
      );
      for (let column = 0; column <= COLUMNS; column++) {
        const x = scanStart + (column / COLUMNS) * (scanEnd - scanStart);
        const scanY = -x + scanOffset;
        scanPositions[column * 3] = x;
        scanPositions[column * 3 + 1] = scanY;
        scanPositions[column * 3 + 2] = elevation(x, scanY, t) + 0.11;
      }
      scanGeometry.attributes.position.needsUpdate = true;
      scanner.material.opacity = 0.48 + Math.sin(t * 0.0011) * 0.3;

      mesh.rotation.z = Math.sin(t * 0.00022) * 0.018;
      depthMesh.rotation.z = mesh.rotation.z;
      contours.forEach(({ line }) => {
        line.rotation.z = mesh.rotation.z;
      });
      markers.rotation.z = mesh.rotation.z;
      scanner.rotation.z = mesh.rotation.z;

      viewX += (pointerX - viewX) * 0.035;
      viewY += (pointerY - viewY) * 0.035;
      camera.position.x = viewX * 0.38;
      camera.position.y = 7.25 - viewY * 0.24;
      camera.lookAt(0.35 + viewX * 0.25, 0.35 - viewY * 0.14, -0.25);
    }

    function resizeTerrain() {
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.position.set(0, 7.25, 10.4);
      camera.lookAt(0.35, 0.35, -0.25);
    }

    let lastFrame = 0;
    let frame = 0;

    function render(now: number) {
      if (!document.hidden && now - lastFrame > 33) {
        updateTerrain(now);
        renderer.render(scene, camera);
        lastFrame = now;
      }
      frame = requestAnimationFrame(render);
    }

    resizeTerrain();
    updateTerrain(0);
    renderer.render(scene, camera);
    window.addEventListener("resize", resizeTerrain);
    if (!reduceMotion) frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resizeTerrain);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      surface.gridGeometry.dispose();
      depthLayer.gridGeometry.dispose();
      markerGeometry.dispose();
      scanGeometry.dispose();
      contours.forEach(({ lineGeometry }) => lineGeometry.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <aside
      className="auth-status-pane relative hidden min-h-screen overflow-hidden border-l border-white/[.065] bg-[#0b0d0f] lg:block"
      aria-label="ListItUp workspace status"
    >
      <canvas
        ref={canvasRef}
        className="auth-terrain-canvas absolute inset-0 z-0 size-full opacity-80"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_60%_30%,transparent_0,transparent_33%,#0b0d0fcc_100%)]"
        aria-hidden="true"
      />
      <div
        className="auth-terrain-grid pointer-events-none absolute inset-x-0 top-0 z-20 h-1/2"
        aria-hidden="true"
      />
      <div className="relative z-30 h-full">
        <div className="absolute bottom-24 left-6">
          <motion.p
            className="text-9xl font-extralight tracking-[-.04em] text-[#e6e6e6]"
            aria-label={WORDMARK}
            onHoverStart={scrambleWordmarkOnHover}
            whileHover={{ opacity: 0.88 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <span aria-hidden="true">{wordmark}</span>
          </motion.p>
        </div>
        <p className="absolute bottom-6 left-6 font-mono text-xs uppercase tracking-[.14em] text-[#a5aaaf]/70">
          2026 ListItUp
        </p>
      </div>
    </aside>
  );
}
