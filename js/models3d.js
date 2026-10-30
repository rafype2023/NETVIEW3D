import * as THREE from 'three';

const texLoader = new THREE.TextureLoader();
const textureCache = new Map();

function loadProductTexture(url) {
  if (textureCache.has(url)) return textureCache.get(url);
  const tex = texLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  textureCache.set(url, tex);
  return tex;
}

// Shared materials cache
const MAT = {
  darkChassis: new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.45, metalness: 0.65 }),
  anthracite: new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.4, metalness: 0.7 }),
  silverMetal: new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.3, metalness: 0.75 }),
  ciscoSilver: new THREE.MeshStandardMaterial({ color: 0xd4dae2, roughness: 0.32, metalness: 0.65 }),
  fortiWhite: new THREE.MeshStandardMaterial({ color: 0xf0f3f7, roughness: 0.32, metalness: 0.25 }),
  fortiRed: new THREE.MeshStandardMaterial({ color: 0xee3124, roughness: 0.3, metalness: 0.3, emissive: 0x440804 }),
  hpeGreen: new THREE.MeshStandardMaterial({ color: 0x01a982, roughness: 0.22, metalness: 0.2, emissive: 0x005944 }),
  pureOrange: new THREE.MeshStandardMaterial({ color: 0xfe5000, roughness: 0.2, metalness: 0.1, emissive: 0x992b00 }),
  pureBlack: new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.22, metalness: 0.5 }),
  nutanixGreen: new THREE.MeshStandardMaterial({ color: 0x78d64b, roughness: 0.3, metalness: 0.2, emissive: 0x204d0c }),
  ciscoCyan: new THREE.MeshStandardMaterial({ color: 0x00bceb, roughness: 0.25, metalness: 0.3, emissive: 0x003f52 }),
  ciscoBlue: new THREE.MeshStandardMaterial({ color: 0x049fd9, roughness: 0.3, metalness: 0.4, emissive: 0x012b3d }),
  dellBlue: new THREE.MeshStandardMaterial({ color: 0x007db8, roughness: 0.3, metalness: 0.4, emissive: 0x002d42 }),
  portDark: new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.6, metalness: 0.3 }),
  ledGreen: new THREE.MeshBasicMaterial({ color: 0x00e676 }),
  ledAmber: new THREE.MeshBasicMaterial({ color: 0xffab00 }),
  ledCyan: new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
  psuHandle: new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.4, metalness: 0.6 })
};

// Create Fortinet branded white top cover texture ("FORTINET" with red O bridge)
let fortinetTopMat = null;
function getFortinetTopMaterial() {
  if (fortinetTopMat) return fortinetTopMat;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f5f8';
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle metallicbrush lines
  ctx.strokeStyle = 'rgba(0,0,0,0.03)';
  for (let y = 0; y < 512; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Draw FORTINET wordmark across center of top lid
  ctx.fillStyle = '#111827';
  ctx.font = '900 78px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('F   R T I N E T', 512, 275);

  // Iconic Red Fortinet O (segmented pill box)
  const ox = 258;
  const oy = 216;
  ctx.fillStyle = '#ee3124';
  const blocks = [
    [0, 0, 22, 16], [28, 0, 24, 16], [58, 0, 22, 16],
    [0, 23, 22, 18], [58, 23, 22, 18],
    [0, 47, 22, 16], [28, 47, 24, 16], [58, 47, 22, 16]
  ];
  blocks.forEach(([bx, by, bw, bh]) => {
    ctx.beginPath();
    ctx.roundRect(ox + bx, oy + by, bw, bh, 4);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  fortinetTopMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.2 });
  return fortinetTopMat;
}

// Create Front Faceplate Canvas Texture for the 3 Virtual Server Cubes (Windows, Red Hat, Appliance)
function createVirtualServerFrontTexture(vmType, hostname) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  const palettes = {
    windows: {
      bgTop: 'rgba(6, 42, 94, 0.82)',
      bgBot: 'rgba(4, 22, 54, 0.90)',
      border: '#38bdf8',
      glow: '#00b4ff',
      title: 'Servidor Virtual',
      osLabel: 'Windows Server',
      subLabel: 'Aplicaciones'
    },
    redhat: {
      bgTop: 'rgba(88, 12, 18, 0.84)',
      bgBot: 'rgba(38, 6, 12, 0.92)',
      border: '#f87171',
      glow: '#ee0000',
      title: 'Servidor Virtual',
      osLabel: 'Linux Red Hat',
      subLabel: 'Aplicaciones'
    },
    appliance: {
      bgTop: 'rgba(6, 68, 52, 0.84)',
      bgBot: 'rgba(4, 32, 28, 0.92)',
      border: '#34d399',
      glow: '#10b981',
      title: 'Servidor Virtual',
      osLabel: 'Virtual Appliance',
      subLabel: 'Aplicaciones'
    }
  };
  const pal = palettes[vmType] || palettes.windows;

  // Translucent glossy card background
  const grad = ctx.createLinearGradient(0, 0, 0, 560);
  grad.addColorStop(0, pal.bgTop);
  grad.addColorStop(1, pal.bgBot);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(16, 16, 480, 528, 28);
  ctx.fill();

  // Outer glowing border
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.border;
  ctx.stroke();

  // Inner glass highlight line
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.roundRect(28, 28, 456, 504, 20);
  ctx.stroke();

  // Draw OS Logo Emblem at top center
  ctx.save();
  if (vmType === 'windows') {
    // 4-Pane Perspective Windows Logo in glowing cyan
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 18;
    // Left top pane
    ctx.beginPath();
    ctx.moveTo(188, 92);
    ctx.lineTo(248, 82);
    ctx.lineTo(248, 138);
    ctx.lineTo(188, 138);
    ctx.closePath();
    ctx.fill();
    // Right top pane
    ctx.beginPath();
    ctx.moveTo(258, 80);
    ctx.lineTo(328, 68);
    ctx.lineTo(328, 138);
    ctx.lineTo(258, 138);
    ctx.closePath();
    ctx.fill();
    // Left bottom pane
    ctx.beginPath();
    ctx.moveTo(188, 148);
    ctx.lineTo(248, 148);
    ctx.lineTo(248, 204);
    ctx.lineTo(188, 194);
    ctx.closePath();
    ctx.fill();
    // Right bottom pane
    ctx.beginPath();
    ctx.moveTo(258, 148);
    ctx.lineTo(328, 148);
    ctx.lineTo(328, 218);
    ctx.lineTo(258, 206);
    ctx.closePath();
    ctx.fill();
  } else if (vmType === 'redhat') {
    // Iconic Red Hat Fedora Emblem
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff2a2a';
    // Hat brim (ellipse)
    ctx.beginPath();
    ctx.ellipse(256, 174, 88, 26, -0.06, 0, Math.PI * 2);
    ctx.fill();
    // Hat crown
    ctx.beginPath();
    ctx.moveTo(192, 166);
    ctx.quadraticCurveTo(205, 86, 250, 94);
    ctx.quadraticCurveTo(280, 98, 294, 90);
    ctx.quadraticCurveTo(320, 110, 316, 166);
    ctx.closePath();
    ctx.fill();
    // Black hat ribbon band
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.ellipse(255, 162, 62, 11, -0.05, 0, Math.PI);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#111111';
    ctx.stroke();
  } else {
    // Virtual Appliance Emblem (Hexagonal Shield + Gear Core)
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#34d399';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    const cx = 256, cy = 142, r = 64;
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner gear / cube core
    ctx.fillStyle = '#a7f3d0';
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Text block matching "Servidor Virtual.png"
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
  ctx.fillText(pal.title, 256, 286);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 31px system-ui, -apple-system, sans-serif';
  ctx.fillText(pal.osLabel, 256, 334);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(pal.subLabel, 256, 378);

  // Bottom 3 Icons matching "Servidor Virtual.png": Database Cylinder | Network Globe | Gear
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 4;

  // 1. Database Icon (left, x=145, y=458)
  const dbX = 145, dbY = 435;
  ctx.beginPath();
  ctx.ellipse(dbX, dbY, 24, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    ctx.ellipse(dbX, dbY + k * 14, 24, 9, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(dbX - 24, dbY);
  ctx.lineTo(dbX - 24, dbY + 42);
  ctx.moveTo(dbX + 24, dbY);
  ctx.lineTo(dbX + 24, dbY + 42);
  ctx.stroke();

  // 2. Network Globe Icon (center, x=256, y=456)
  const gx = 256, gy = 456, gr = 26;
  ctx.beginPath();
  ctx.arc(gx, gy, gr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(gx, gy, 13, gr, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx - gr, gy);
  ctx.lineTo(gx + gr, gy);
  ctx.moveTo(gx - gr * 0.85, gy - 12);
  ctx.lineTo(gx + gr * 0.85, gy - 12);
  ctx.moveTo(gx - gr * 0.85, gy + 12);
  ctx.lineTo(gx + gr * 0.85, gy + 12);
  ctx.stroke();

  // 3. Settings Gear Icon (right, x=367, y=456)
  const sx = 367, sy = 456;
  ctx.beginPath();
  ctx.arc(sx, sy, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  ctx.stroke();
  for (let t = 0; t < 8; t++) {
    const a = (Math.PI / 4) * t;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * 18, sy + Math.sin(a) * 18);
    ctx.lineTo(sx + Math.cos(a) * 26, sy + Math.sin(a) * 26);
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHypervisorFrontTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 1024, 192);
  grad.addColorStop(0, 'rgba(6, 78, 138, 0.85)');
  grad.addColorStop(0.5, 'rgba(14, 116, 190, 0.90)');
  grad.addColorStop(1, 'rgba(6, 78, 138, 0.85)');
  ctx.fillStyle = grad;
  ctx.roundRect(6, 6, 1012, 180, 20);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();

  // Gear emblem on left of text
  const gx = 290, gy = 96;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(gx, gy, 28, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * 28, gy + Math.sin(a) * 28);
    ctx.lineTo(gx + Math.cos(a) * 42, gy + Math.sin(a) * 42);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px system-ui, -apple-system, sans-serif';
  ctx.fillText('Hypervisor', 355, 86);

  ctx.fillStyle = '#bae6fd';
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('Crea y gestiona servidores virtuales', 355, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addRackEars(group, w, h, d, earMat = MAT.silverMetal) {
  const earW = 0.065;
  const earGeom = new THREE.BoxGeometry(earW, h * 0.94, 0.03);
  const leftEar = new THREE.Mesh(earGeom, earMat);
  leftEar.position.set(-w / 2 - earW / 2 + 0.02, 0, d / 2 - 0.02);
  const rightEar = new THREE.Mesh(earGeom, earMat);
  rightEar.position.set(w / 2 + earW / 2 - 0.02, 0, d / 2 - 0.02);
  group.add(leftEar, rightEar);
}

function addPortGrid(group, startX, endX, y, z, cols, rows, portW = 0.032, portH = 0.028, accentMat = null) {
  const spanX = endX - startX;
  const stepX = cols > 1 ? spanX / (cols - 1) : 0;
  const stepY = rows > 1 ? portH * 1.45 : 0;
  const pGeom = new THREE.BoxGeometry(portW, portH, 0.02);
  const ledGeom = new THREE.BoxGeometry(portW * 0.35, 0.008, 0.022);

  for (let r = 0; r < rows; r++) {
    const py = y + (r - (rows - 1) / 2) * stepY;
    for (let c = 0; c < cols; c++) {
      const px = startX + c * stepX;
      const pMesh = new THREE.Mesh(pGeom, accentMat || MAT.portDark);
      pMesh.position.set(px, py, z);
      group.add(pMesh);

      if ((c + r) % 3 !== 2) {
        const led = new THREE.Mesh(ledGeom, c % 7 === 0 ? MAT.ledAmber : MAT.ledGreen);
        led.position.set(px, py + portH * 0.62, z + 0.002);
        group.add(led);
      }
    }
  }
}

function addDriveBays(group, w, h, z, cols, rows, accentMat) {
  const marginX = 0.14;
  const availW = w - marginX * 2;
  const availH = h * 0.78;
  const cellW = availW / cols;
  const cellH = availH / rows;
  const bayGeom = new THREE.BoxGeometry(cellW * 0.88, cellH * 0.82, 0.025);
  const ledGeom = new THREE.BoxGeometry(0.016, 0.012, 0.028);
  const stripeGeom = new THREE.BoxGeometry(cellW * 0.72, cellH * 0.16, 0.028);

  for (let r = 0; r < rows; r++) {
    const py = (r - (rows - 1) / 2) * cellH;
    for (let c = 0; c < cols; c++) {
      const px = -availW / 2 + cellW / 2 + c * cellW;
      const bay = new THREE.Mesh(bayGeom, MAT.anthracite);
      bay.position.set(px, py, z);
      group.add(bay);

      const stripe = new THREE.Mesh(stripeGeom, accentMat);
      stripe.position.set(px, py - cellH * 0.22, z + 0.002);
      group.add(stripe);

      const led = new THREE.Mesh(ledGeom, MAT.ledGreen);
      led.position.set(px + cellW * 0.3, py + cellH * 0.2, z + 0.003);
      group.add(led);
    }
  }
}

function addRearPSUsAndPorts(group, w, h, d) {
  const z = -d / 2 - 0.01;
  const psuW = 0.28;
  const psuH = Math.min(h * 0.75, 0.22);
  const psuGeom = new THREE.BoxGeometry(psuW, psuH, 0.025);

  for (let i = 0; i < 2; i++) {
    const psu = new THREE.Mesh(psuGeom, MAT.psuHandle);
    psu.position.set(w / 2 - 0.22 - i * (psuW + 0.05), 0, z);
    group.add(psu);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.03), MAT.ledGreen);
    led.position.set(psu.position.x - psuW * 0.32, psuH * 0.25, z - 0.004);
    group.add(led);
  }
  addPortGrid(group, -w / 2 + 0.2, 0.05, 0, z, 6, 1, 0.045, 0.035, MAT.portDark);
}

// Create crisp canvas texture for floating 3D label
export function createDeviceLabelSprite(hostname, ip, vendor, badgeColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(13, 18, 28, 0.88)';
  ctx.beginPath();
  ctx.roundRect(6, 6, 500, 132, 18);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = badgeColor || '#00e5ff';
  ctx.stroke();

  ctx.fillStyle = badgeColor || '#00e5ff';
  ctx.beginPath();
  ctx.roundRect(14, 16, 12, 112, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(hostname.slice(0, 22), 40, 58);

  ctx.fillStyle = '#90caf9';
  ctx.font = '600 24px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(`${vendor} • ${ip}`.slice(0, 34), 40, 104);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.75, 0.49, 1);
  sprite.name = 'deviceLabelSprite';
  return sprite;
}

export function buildHardwareMesh(spec, instanceData = {}) {
  const root = new THREE.Group();
  const { width: w, height: h, depth: d, id } = spec;

  // ================= 1. 3D VIRTUAL SERVER CUBES (WINDOWS, RED HAT, APPLIANCE) =================
  if (spec.isVirtualCube) {
    const vmColors = {
      windows: { glass: 0x0ea5e9, edge: 0x38bdf8, core: 0x082f49 },
      redhat: { glass: 0xdc2626, edge: 0xf87171, core: 0x450a0a },
      appliance: { glass: 0x10b981, edge: 0x34d399, core: 0x064e3b }
    };
    const palette = vmColors[spec.vmType] || vmColors.windows;

    // Outer translucent glass cube (like "Servidor Virtual.png")
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: palette.glass,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.45,
      depthWrite: false
    });
    const outerCube = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
    root.add(outerCube);

    // Glowing neon wireframe edges of the glass cube
    const edgeGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.006, h + 0.006, d + 0.006));
    const edgeLines = new THREE.LineSegments(
      edgeGeom,
      new THREE.LineBasicMaterial({ color: palette.edge })
    );
    root.add(edgeLines);

    // Internal 3D virtual server stack visible inside the translucent cube
    const innerW = w * 0.76;
    const innerD = d * 0.72;
    const sliceH = (h * 0.68) / 3;
    const coreMat = new THREE.MeshStandardMaterial({
      color: palette.core,
      roughness: 0.35,
      metalness: 0.7
    });
    for (let s = 0; s < 3; s++) {
      const slice = new THREE.Mesh(
        new THREE.BoxGeometry(innerW, sliceH * 0.78, innerD),
        coreMat
      );
      slice.position.set(0, (s - 1) * sliceH, -0.02);
      root.add(slice);

      // Glowing internal LED strip on each virtual blade slice
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(innerW * 0.85, 0.016, innerD + 0.01),
        new THREE.MeshBasicMaterial({ color: palette.edge })
      );
      ledStrip.position.set(0, (s - 1) * sliceH, -0.02);
      root.add(ledStrip);
    }

    // Front Glass Faceplate with OS Logo (Windows / Red Hat / Appliance), Labels & 3 Icons
    const frontTex = createVirtualServerFrontTexture(spec.vmType, instanceData.hostname || spec.defaultHostname);
    const frontMat = new THREE.MeshBasicMaterial({
      map: frontTex,
      transparent: true
    });
    const frontPlane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.94), frontMat);
    frontPlane.position.set(0, 0, d / 2 + 0.008);
    root.add(frontPlane);

    const hostname = instanceData.hostname || spec.defaultHostname;
    const ip = instanceData.ip || spec.defaultIp;
    const labelSprite = createDeviceLabelSprite(hostname, ip, spec.vendor, spec.badgeColor);
    labelSprite.position.set(0, h / 2 + 0.32, 0);
    root.add(labelSprite);
    return root;
  }

  // ================= 2. 3D HYPERVISOR LAYER SLAB =================
  if (spec.isHypervisor) {
    const hypGlass = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.42,
      roughness: 0.15,
      metalness: 0.2
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hypGlass);
    root.add(slab);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.008, h + 0.008, d + 0.008));
    root.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x38bdf8 })));

    const frontTex = createHypervisorFrontTexture();
    const frontBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.96, h * 0.88),
      new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
    );
    frontBanner.position.set(0, 0, d / 2 + 0.008);
    root.add(frontBanner);

    const hostname = instanceData.hostname || spec.defaultHostname;
    const ip = instanceData.ip || spec.defaultIp;
    const labelSprite = createDeviceLabelSprite(hostname, ip, spec.vendor, spec.badgeColor);
    labelSprite.position.set(0, h / 2 + 0.34, 0);
    root.add(labelSprite);
    return root;
  }

  // ================= 3. 42U RACK CONTAINER =================
  if (spec.isRackContainer) {
    const postW = 0.08;
    const postGeom = new THREE.BoxGeometry(postW, h, postW);
    const corners = [
      [-w / 2 + postW / 2, 0, d / 2 - postW / 2],
      [w / 2 - postW / 2, 0, d / 2 - postW / 2],
      [-w / 2 + postW / 2, 0, -d / 2 + postW / 2],
      [w / 2 - postW / 2, 0, -d / 2 + postW / 2]
    ];
    corners.forEach(([x, y, z]) => {
      const post = new THREE.Mesh(postGeom, MAT.darkChassis);
      post.position.set(x, y, z);
      post.castShadow = true;
      root.add(post);
    });

    const capGeom = new THREE.BoxGeometry(w, 0.12, d);
    const topCap = new THREE.Mesh(capGeom, MAT.anthracite);
    topCap.position.set(0, h / 2 - 0.06, 0);
    const botCap = new THREE.Mesh(capGeom, MAT.anthracite);
    botCap.position.set(0, -h / 2 + 0.06, 0);
    root.add(topCap, botCap);

    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.22,
      roughness: 0.2
    });
    const sideGeom = new THREE.BoxGeometry(0.02, h - 0.24, d - 0.2);
    const leftSide = new THREE.Mesh(sideGeom, sideMat);
    leftSide.position.set(-w / 2 + 0.02, 0, 0);
    const rightSide = new THREE.Mesh(sideGeom, sideMat);
    rightSide.position.set(w / 2 - 0.02, 0, 0);
    root.add(leftSide, rightSide);

    const uStep = (h - 0.32) / 42;
    const tickGeom = new THREE.BoxGeometry(0.03, 0.012, 0.02);
    for (let u = 1; u <= 42; u += 2) {
      const uy = -h / 2 + 0.16 + (u - 0.5) * uStep;
      const tickL = new THREE.Mesh(tickGeom, MAT.ledCyan);
      tickL.position.set(-w / 2 + 0.09, uy, d / 2 + 0.005);
      const tickR = new THREE.Mesh(tickGeom, MAT.ledCyan);
      tickR.position.set(w / 2 - 0.09, uy, d / 2 + 0.005);
      root.add(tickL, tickR);
    }
  } else if (spec.isZone) {
    const zoneColor = new THREE.Color(instanceData.customColor || spec.badgeColor || '#3d5afe');
    const plateMat = new THREE.MeshStandardMaterial({
      color: zoneColor,
      transparent: true,
      opacity: 0.24,
      roughness: 0.3,
      metalness: 0.2
    });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plateMat);
    plate.receiveShadow = true;
    root.add(plate);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h + 0.01, d));
    root.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: zoneColor })));
  } else if (id === 'cloud-wan') {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x0288d1,
      emissive: 0x013a59,
      roughness: 0.25,
      metalness: 0.4
    });
    const spheres = [
      [0, 0.08, 0, 0.52],
      [-0.52, -0.04, 0.05, 0.38],
      [0.52, -0.04, -0.05, 0.40],
      [-0.22, 0.22, -0.12, 0.36],
      [0.26, 0.20, 0.12, 0.35]
    ];
    spheres.forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), cloudMat);
      m.position.set(x, y, z);
      root.add(m);
    });
  } else {
    // ================= 4. ENTERPRISE HARDWARE CHASSIS MODELS =================
    const isForti = id.startsWith('fortigate-');
    const isCiscoChassis = id === 'cisco-nexus-9508' || id === 'cisco-catalyst-9410r';
    const isPure = id.startsWith('pure-');
    const isSynergy = id === 'hpe-synergy-12000';

    let bodyMat = MAT.darkChassis;
    if (isForti) bodyMat = MAT.fortiWhite;
    else if (isCiscoChassis || isSynergy) bodyMat = MAT.ciscoSilver;
    else if (isPure) bodyMat = MAT.pureBlack;

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    root.add(chassis);

    // If Fortinet FortiGate, add branded "FORTINET" white top lid cover (matching fortigate1800.jpeg & fortigate600.png)
    if (isForti) {
      const topLid = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.98, d * 0.96),
        getFortinetTopMaterial()
      );
      topLid.rotation.x = -Math.PI / 2;
      topLid.position.set(0, h / 2 + 0.002, 0);
      root.add(topLid);
    }

    addRackEars(root, w, h, d, isForti ? MAT.fortiWhite : MAT.silverMetal);
    if (id !== 'cisco-nexus-9508') {
      addRearPSUsAndPorts(root, w, h, d);
    }

    const fz = d / 2 + 0.008;

    if (id === 'hpe-synergy-12000') {
      // Real HPE Synergy 12000 Frame front texture from Sinergy.jpg + 3D extruded blade handles & bezels
      const synTex = loadProductTexture('./assets/textures/synergy_front.jpg');
      const frontFace = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.99, h * 0.98),
        new THREE.MeshStandardMaterial({ map: synTex, roughness: 0.35, metalness: 0.25 })
      );
      frontFace.position.set(0, 0, fz);
      root.add(frontFace);

      // 3D extruded vertical silver blade handles for the 12 compute bays (6 top, 6 bottom)
      const bayAreaW = w * 0.74;
      const bayStepX = bayAreaW / 6;
      for (let row = 0; row < 2; row++) {
        const ry = row === 0 ? h * 0.23 : -h * 0.24;
        for (let col = 0; col < 6; col++) {
          const bx = -bayAreaW / 2 + col * bayStepX + 0.02;
          const handleBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.022, h * 0.42, 0.026),
            MAT.silverMetal
          );
          handleBar.position.set(bx, ry, fz + 0.012);
          root.add(handleBar);
        }
      }
      // Top-right HPE green rectangular hollow badge
      const hpeBadge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.024, 0.02), MAT.hpeGreen);
      hpeBadge.position.set(w / 2 - 0.045, h / 2 - 0.06, fz + 0.01);
      root.add(hpeBadge);
    } else if (id.startsWith('hpe-alletra-')) {
      // Real HPE Alletra front texture from Alletra.webp + 3D sculpted silver frame & central HPE green hollow badge
      const allTex = loadProductTexture('./assets/textures/alletra_front.jpg');
      const frontFace = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.99, h * 0.96),
        new THREE.MeshStandardMaterial({ map: allTex, roughness: 0.32, metalness: 0.3 })
      );
      frontFace.position.set(0, 0, fz);
      root.add(frontFace);

      // 3D Sculpted Silver Outer Frame (top, bottom, left, right pillars)
      const railTop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.022, 0.032), MAT.silverMetal);
      railTop.position.set(0, h / 2 - 0.015, fz + 0.012);
      const railBot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.022, 0.032), MAT.silverMetal);
      railBot.position.set(0, -h / 2 + 0.015, fz + 0.012);
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.055, h * 0.95, 0.035), MAT.silverMetal);
      pillarL.position.set(-w * 0.41, 0, fz + 0.012);
      const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.055, h * 0.95, 0.035), MAT.silverMetal);
      pillarR.position.set(w * 0.41, 0, fz + 0.012);
      root.add(railTop, railBot, pillarL, pillarR);

      // 3D Central HPE Green Hollow Rectangular Emblem
      const badgeOuter = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.068, 0.032), MAT.hpeGreen);
      badgeOuter.position.set(0, 0, fz + 0.012);
      const badgeInner = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.032, 0.036), MAT.darkChassis);
      badgeInner.position.set(0, 0, fz + 0.014);
      root.add(badgeOuter, badgeInner);

      // 3D cylindrical thumbscrews on left (B) and right (A) black ears
      const knobGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.04, 16);
      knobGeom.rotateX(Math.PI / 2);
      const knobL = new THREE.Mesh(knobGeom, MAT.silverMetal);
      knobL.position.set(-w / 2 + 0.03, -h * 0.08, fz + 0.018);
      const knobR = new THREE.Mesh(knobGeom, MAT.silverMetal);
      knobR.position.set(w / 2 - 0.03, -h * 0.08, fz + 0.018);
      root.add(knobL, knobR);
    } else if (id === 'cisco-catalyst-9410r') {
      // Real Cisco Catalyst 9410R front texture from Catalyst 9410.jpeg + 3D top 8 PSUs + left vertical handle + 3 side vent strips
      const c9410Tex = loadProductTexture('./assets/textures/c9410_front.jpg');
      const frontFace = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.98, h * 0.98),
        new THREE.MeshStandardMaterial({ map: c9410Tex, roughness: 0.35, metalness: 0.3 })
      );
      frontFace.position.set(0, 0, fz);
      root.add(frontFace);

      // 3D protruding 2x4 black AC Power Supplies at the TOP of the Catalyst 9410R
      const psuW = (w * 0.92) / 4;
      for (let r = 0; r < 2; r++) {
        const py = h / 2 - 0.14 - r * 0.13;
        for (let c = 0; c < 4; c++) {
          const px = -w * 0.46 + psuW / 2 + c * psuW;
          const psu = new THREE.Mesh(
            new THREE.BoxGeometry(psuW * 0.94, 0.11, 0.038),
            MAT.darkChassis
          );
          psu.position.set(px, py, fz + 0.014);
          root.add(psu);
        }
      }

      // 3D Left Vertical Silver Handle (characteristic of Catalyst 9410R)
      const handleV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.06), MAT.silverMetal);
      handleV.position.set(-w / 2 + 0.06, -0.12, fz + 0.045);
      const handleTop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.05), MAT.silverMetal);
      handleTop.position.set(-w / 2 + 0.06, 0.08, fz + 0.022);
      const handleBot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.05), MAT.silverMetal);
      handleBot.position.set(-w / 2 + 0.06, -0.32, fz + 0.022);
      root.add(handleV, handleTop, handleBot);

      // 3 vertical perforated ventilation grille strips on the side panels
      for (let v = 0; v < 3; v++) {
        const vz = d * 0.25 - v * (d * 0.26);
        const ventR = new THREE.Mesh(
          new THREE.BoxGeometry(0.008, h * 0.72, d * 0.18),
          MAT.anthracite
        );
        ventR.position.set(w / 2 + 0.002, -0.12, vz);
        root.add(ventR);
      }
    } else if (id === 'cisco-nexus-9508') {
      // Real Cisco Nexus 9508 Front AND Rear views from Nexus 9508.jpeg + 3D line cards, Sup engines, 3kW PSUs & Rear Fan Trays
      const n9508FrontTex = loadProductTexture('./assets/textures/n9508_front.jpg');
      const frontFace = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.98, h * 0.98),
        new THREE.MeshStandardMaterial({ map: n9508FrontTex, roughness: 0.35, metalness: 0.35 })
      );
      frontFace.position.set(0, 0, fz);
      root.add(frontFace);

      // 3D protruding ejector levers for the 8 Line Card slots on the upper front
      for (let s = 0; s < 8; s++) {
        const sy = h / 2 - 0.13 - s * 0.135;
        const levL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.028, 0.03), MAT.silverMetal);
        levL.position.set(-w / 2 + 0.08, sy, fz + 0.012);
        const levR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.028, 0.03), MAT.silverMetal);
        levR.position.set(w / 2 - 0.08, sy, fz + 0.012);
        root.add(levL, levR);
      }

      // Rear View of Nexus 9508: 3 Fan Trays (2x3 circular fans with diagonal handles) + Fabric Modules
      const n9508RearTex = loadProductTexture('./assets/textures/n9508_rear.jpg');
      const rearFace = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.98, h * 0.98),
        new THREE.MeshStandardMaterial({ map: n9508RearTex, roughness: 0.38, metalness: 0.35 })
      );
      rearFace.rotation.y = Math.PI;
      rearFace.position.set(0, 0, -d / 2 - 0.008);
      root.add(rearFace);

      // 3D diagonal silver handles on the rear fan trays
      const rz = -d / 2 - 0.025;
      [-0.48, 0.02].forEach((fx) => {
        [0.52, -0.32].forEach((fy) => {
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 0.03), MAT.silverMetal);
          handle.rotation.z = Math.PI / 4;
          handle.position.set(fx, fy, rz);
          root.add(handle);
        });
      });
    } else if (id === 'fortigate-1800f' || id === 'fortigate-3000f') {
      // Real FortiGate 1800F white faceplate from fortigate1800.jpeg + 3D recessed port cages
      const fg1800Tex = loadProductTexture('./assets/textures/fg1800_front.jpg');
      const frontFace = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.99, h * 0.96),
        new THREE.MeshStandardMaterial({ map: fg1800Tex, roughness: 0.32, metalness: 0.15 })
      );
      frontFace.position.set(0, 0, fz);
      root.add(frontFace);
    } else if (id === 'fortigate-600f' || id === 'fortigate-200f') {
      // Real FortiGate 600E/600F white faceplate from fortigate600.png
      const fg600Tex = loadProductTexture('./assets/textures/fg600_front.jpg');
      const frontFace = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.99, h * 0.96),
        new THREE.MeshStandardMaterial({ map: fg600Tex, roughness: 0.32, metalness: 0.15 })
      );
      frontFace.position.set(0, 0, fz);
      root.add(frontFace);
    } else if (id.startsWith('nutanix-')) {
      const accent = id.includes('3060') ? MAT.nutanixGreen : MAT.dellBlue;
      addDriveBays(root, w, h, fz, 12, 2, accent);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.85, 0.035), accent);
      badge.position.set(-w / 2 + 0.06, 0, fz);
      root.add(badge);
    } else if (id.startsWith('pure-')) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, h * 0.86, 0.028), MAT.pureBlack);
      panel.position.set(0, 0, fz);
      root.add(panel);

      const slash = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.032, 0.036), MAT.pureOrange);
      slash.position.set(0, 0, fz + 0.006);
      root.add(slash);

      const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(Math.min(h * 0.25, 0.09), 0), MAT.pureOrange);
      emblem.position.set(-w * 0.34, 0, fz + 0.02);
      root.add(emblem);

      if (id === 'pure-flashblade-s') {
        for (let b = 0; b < 10; b++) {
          const bx = -w * 0.2 + b * (w * 0.062);
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, h * 0.76, 0.034), MAT.anthracite);
          fin.position.set(bx, 0, fz + 0.004);
          root.add(fin);
        }
      }
    } else if (id.startsWith('cisco-catalyst-9300') || id.startsWith('cisco-nexus-93180')) {
      const is24 = id.includes('24t');
      const accent = id.includes('nexus') ? MAT.ciscoCyan : MAT.ciscoBlue;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.78, 0.03), accent);
      stripe.position.set(-w / 2 + 0.09, 0, fz);
      root.add(stripe);

      const cols = is24 ? 12 : 24;
      addPortGrid(root, -w / 2 + 0.22, w / 2 - 0.42, 0, fz, cols, 2, 0.034, 0.026, MAT.portDark);
      addPortGrid(root, w / 2 - 0.32, w / 2 - 0.08, 0, fz, 4, 2, 0.038, 0.028, accent);
    } else {
      const accent = id.startsWith('dell') ? MAT.dellBlue : MAT.hpeGreen;
      const rows = h > 0.2 ? 2 : 1;
      addDriveBays(root, w, h, fz, 10, rows, accent);
    }
  }

  // Add Floating 3D Label Sprite above object
  const hostname = instanceData.hostname || spec.defaultHostname;
  const ip = instanceData.ip || spec.defaultIp;
  const labelSprite = createDeviceLabelSprite(hostname, ip, spec.vendor, spec.badgeColor);
  labelSprite.position.set(0, h / 2 + (spec.isRackContainer ? 0.42 : 0.36), 0);
  root.add(labelSprite);

  return root;
}
