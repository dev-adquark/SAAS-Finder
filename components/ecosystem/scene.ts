import * as THREE from "three";
import type { EcoNode } from "@/components/ecosystem/types";

// Three.js ecosystem: glowing core, orbiting category nodes with their real products as
// satellites, connecting lines and ambient particles. The HTML category links are projected
// onto the node positions every frame, so text and links stay real DOM (accessible, crawlable).

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountEcosystem(host: HTMLElement, nodes: EcoNode[]): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.2, 13);
  const glow = glowTexture();
  const disposables: { dispose: () => void }[] = [glow];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  const root = new THREE.Group();
  root.rotation.x = 0.32;
  scene.add(root);

  // Core
  const coreGeo = track(new THREE.IcosahedronGeometry(1.15, 1));
  const core = new THREE.LineSegments(track(new THREE.EdgesGeometry(coreGeo)), track(new THREE.LineBasicMaterial({ color: 0xa08fff, transparent: true, opacity: 0.75 })));
  const coreFill = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.95, 2)), track(new THREE.MeshBasicMaterial({ color: 0x5b4bff, transparent: true, opacity: 0.35 })));
  const coreGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: 0x8f7fff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  coreGlow.scale.setScalar(5.2);
  root.add(coreGlow, coreFill, core);

  // Orbit ring
  const ringPts = new THREE.EllipseCurve(0, 0, 3.3, 3.3).getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y));
  root.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(ringPts)), track(new THREE.LineBasicMaterial({ color: 0x8d96b8, transparent: true, opacity: 0.18 }))));

  // Category nodes + product satellites
  type N = { group: THREE.Group; dot: THREE.Mesh; halo: THREE.Sprite; sats: THREE.Mesh[]; line: THREE.Line; base: number; el: HTMLElement | null; hover: number };
  const els = Array.from(host.querySelectorAll<HTMLElement>("[data-eco-node]"));
  const ns: N[] = nodes.map((n, i) => {
    const color = new THREE.Color(n.color);
    const group = new THREE.Group();
    const dot = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 24, 24)), track(new THREE.MeshBasicMaterial({ color })));
    const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
    halo.scale.setScalar(1.6);
    group.add(halo, dot);
    const satMat = track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    const satGeo = track(new THREE.SphereGeometry(0.09, 14, 14));
    const sats = n.products.map((prod) => {
      const s = new THREE.Mesh(satGeo, satMat.clone());
      s.userData = { href: prod.href, name: prod.name, categorySlug: n.slug };
      track(s.material as THREE.Material);
      group.add(s);
      return s;
    });
    const lineGeo = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
    const line = new THREE.Line(lineGeo, track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 })));
    root.add(group, line);
    const el = els[i] ?? null;
    const node: N = { group, dot, halo, sats, line, base: (i / nodes.length) * Math.PI * 2, el, hover: 0 };
    el?.addEventListener("pointerenter", () => (node.hover = 1));
    el?.addEventListener("pointerleave", () => (node.hover = 0));
    el?.addEventListener("focusin", () => (node.hover = 1));
    el?.addEventListener("focusout", () => (node.hover = 0));
    return node;
  });

  // Ambient particles
  const count = 700;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 5 + Math.random() * 9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const pGeo = track(new THREE.BufferGeometry());
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const particles = new THREE.Points(pGeo, track(new THREE.PointsMaterial({ color: 0xb9c4ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false })));
  scene.add(particles);

  // Sizing
  let w = 1;
  let h = 1;
  const resize = () => {
    w = host.clientWidth;
    h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Interaction: pointer parallax + scroll-driven camera
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  // Product satellites: hover shows the product name, click opens its review.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(2, 2);
  const allSats = ns.flatMap((n) => n.sats);
  let hovered: THREE.Mesh | null = null;
  const tip = document.createElement("div");
  tip.className = "eco-tip";
  tip.hidden = true;
  host.appendChild(tip);
  const onCanvasMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const onCanvasLeave = () => ndc.set(2, 2);
  const onCanvasClick = () => {
    if (hovered?.userData.href) window.location.assign(hovered.userData.href as string);
  };
  canvas.addEventListener("pointermove", onCanvasMove);
  canvas.addEventListener("pointerleave", onCanvasLeave);
  canvas.addEventListener("click", onCanvasClick);

  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0 });
  io.observe(host);

  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const scroll = Math.min(Math.max(window.scrollY / Math.max(host.offsetHeight, 1), 0), 1);

    camera.position.x = pointer.x * 1.1;
    camera.position.y = 1.2 - pointer.y * 0.7 + scroll * 2.2;
    camera.position.z = 13 + scroll * 4;
    camera.lookAt(0, 0, 0);

    core.rotation.set(t * 0.12, t * 0.18, 0);
    coreFill.rotation.set(-t * 0.08, t * 0.1, 0);
    coreGlow.material.opacity = 0.75 + Math.sin(t * 1.6) * 0.12;
    particles.rotation.y = t * 0.012;

    let anyHover = false;
    for (const n of ns) {
      const a = n.base + t * 0.06;
      n.group.position.set(Math.cos(a) * 3.3, Math.sin(t * 0.6 + n.base) * 0.25, Math.sin(a) * 3.3);
      const k = 1 + n.hover * 0.45;
      n.dot.scale.lerp(tmp.set(k, k, k), 0.15);
      n.halo.material.opacity = 0.55 + n.hover * 0.45;
      (n.line.material as THREE.LineBasicMaterial).opacity = 0.22 + n.hover * 0.55;
      n.sats.forEach((s, j) => {
        const sa = t * (0.45 + j * 0.05) + (j / n.sats.length) * Math.PI * 2;
        s.position.set(Math.cos(sa) * 0.62, Math.sin(sa * 1.3) * 0.18, Math.sin(sa) * 0.62);
      });
      const lp = n.line.geometry.attributes.position as THREE.BufferAttribute;
      lp.setXYZ(1, n.group.position.x, n.group.position.y, n.group.position.z);
      lp.needsUpdate = true;
      if (n.hover) anyHover = true;
    }
    root.rotation.y = pointer.x * 0.12;

    raycaster.setFromCamera(ndc, camera);
    const hit = (raycaster.intersectObjects(allSats, false)[0]?.object as THREE.Mesh | undefined) ?? null;
    if (hit !== hovered) {
      if (hovered) hovered.scale.setScalar(1);
      hovered = hit;
      host.classList.toggle("hovering", Boolean(hit));
      tip.hidden = !hit;
      if (hit) tip.textContent = `${hit.userData.name} — open review`;
    }
    if (hovered) {
      hovered.scale.setScalar(2.2);
      const hp = hovered.getWorldPosition(tmp).project(camera);
      tip.style.left = `${((hp.x + 1) / 2) * w}px`;
      tip.style.top = `${((1 - hp.y) / 2) * h}px`;
    }
    for (const n of ns) {
      const lit = n.hover || n.sats.includes(hovered as THREE.Mesh);
      (n.line.material as THREE.LineBasicMaterial).opacity = 0.22 + (lit ? 0.6 : 0);
    }
    renderer.render(scene, camera);

    // Project node positions onto their HTML labels.
    for (const n of ns) {
      if (!n.el) continue;
      const p = n.group.getWorldPosition(tmp).project(camera);
      const x = (p.x * w) / 2;
      const y = (-p.y * h) / 2 - 30;
      const s = Math.min(Math.max(1.15 - p.z * 0.25, 0.82), 1.08);
      n.el.style.setProperty("--x", `${x.toFixed(1)}px`);
      n.el.style.setProperty("--y", `${y.toFixed(1)}px`);
      n.el.style.setProperty("--s", s.toFixed(3));
      n.el.style.zIndex = String(Math.round((1 - p.z) * 1000));
      n.el.style.opacity = anyHover && !n.hover ? "0.7" : "1";
    }
  };
  host.classList.add("is-3d");
  frame();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onPointer);
    canvas.removeEventListener("pointermove", onCanvasMove);
    canvas.removeEventListener("pointerleave", onCanvasLeave);
    canvas.removeEventListener("click", onCanvasClick);
    tip.remove();
    host.classList.remove("is-3d");
    for (const el of els) {
      el.style.removeProperty("--x");
      el.style.removeProperty("--y");
      el.style.removeProperty("--s");
    }
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    canvas.remove();
  };
}
