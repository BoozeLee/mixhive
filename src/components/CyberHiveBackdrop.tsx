'use client';

import { useEffect, useRef } from 'react';
// Type-only import is erased at compile time, so `three` (≈650 kB) stays out of
// the initial bundle. The runtime module is dynamically imported on mount below.
import type * as THREE from 'three';

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(context);
  } catch {
    return false;
  }
}

export function CyberHiveBackdrop() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !canUseWebGL())
      return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    void import('three').then(THREE => {
      if (cancelled || mountRef.current !== mount) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        55,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 72;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      } catch (error) {
        console.warn('CyberHiveBackdrop disabled: WebGL is unavailable.', error);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      mount.appendChild(renderer.domElement);

      const isCompact = window.matchMedia('(max-width: 767px)').matches;
      const count = isCompact ? 150 : 260;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 140;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xf6c400,
        size: 0.62,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      const hexShape = new THREE.Shape();
      const r = 10;
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) hexShape.moveTo(x, y);
        else hexShape.lineTo(x, y);
      }
      hexShape.closePath();
      const points = hexShape.getPoints(6);
      const hexGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const hexMaterial = new THREE.LineBasicMaterial({
        color: 0xf6c400,
        transparent: true,
        opacity: 0.12,
      });
      const hexes: THREE.Line[] = [];
      for (let i = 0; i < 18; i += 1) {
        const hex = new THREE.Line(hexGeometry, hexMaterial);
        hex.position.set(
          (Math.random() - 0.5) * 150,
          (Math.random() - 0.5) * 84,
          -25 - Math.random() * 35
        );
        hex.rotation.z = Math.random() * Math.PI;
        hex.scale.setScalar(0.6 + Math.random() * 1.8);
        scene.add(hex);
        hexes.push(hex);
      }

      let frame = 0;
      let raf = 0;
      const animate = () => {
        frame += 0.006;
        particles.rotation.y = frame;
        particles.rotation.x = Math.sin(frame * 0.7) * 0.08;
        hexes.forEach((hex, index) => {
          hex.rotation.z += 0.0008 + index * 0.00002;
        });
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      };

      window.addEventListener('resize', handleResize);
      animate();

      teardown = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        hexGeometry.dispose();
        hexMaterial.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div
      className="cyber-hive-backdrop"
      ref={mountRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.85,
      }}
    />
  );
}
