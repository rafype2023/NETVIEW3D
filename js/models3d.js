import * as THREE from 'three';

// Shared materials cache for performance
const MAT = {
  darkChassis: new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.45, metalness: 0.65 }),
  anthracite: new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.4, metalness: 0.7 }),
  silverMetal: new THREE.MeshStandardMaterial({ color: 0x9ea7b3, roughness: 0.3, metalness: 0.8 }),
  fortiWhite: new THREE.MeshStandardMaterial({ color: 0xdce1e8, roughness: 0.35, metalness: 0.45 }),
  fortiRed: new THREE.MeshStandardMaterial({ color: 0xee3124, roughness: 0.3, metalness: 0.3, emissive: 0x440804 }),
  hpeGreen: new THREE.MeshStandardMaterial({ color: 0x01a982, roughness: 0.25, metalness: 0.2, emissive: 0x004d3b }),
  pureOrange: new THREE.MeshStandardMaterial({ color: 0xfe5000, roughness: 0.2, metalness: 0.1, emissive: 0x992b00 }),
  pureBlack: new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.22, metalness: 0.5 }),
  nutanixGreen: new THREE.MeshStandardMaterial({ color: 0x78d64b, roughness: 0.3, metalness: 0.2, emissive: 0x204d0c }),
  ciscoCyan: new THREE.MeshStandardMaterial({ color: 0x00bceb, roughness: 0.25, metalness: 0.3, emissive: 0x003f52 }),
  ciscoBlue: new THREE.MeshStandardMaterial({ color: 0x049fd9, roughness: 0.3, metalness: 0.4, emissive: 0x012b3d }),
  dellBlue: new THREE.MeshStandardMaterial({ color: 0x007db8, roughness: 0.3, metalness: 0.4, emissive: 0x002d42 }),
  portDark: new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.6, metalness: 0.3 }),
  goldPins: new THREE.MeshStandardMaterial({ color: 0xffc107, roughness: 0.25, metalness: 0.9 }),
  ledGreen: new THREE.MeshBasicMaterial({ color: 0x00e676 }),
  ledAmber: new THREE.MeshBasicMaterial({ color: 0xffab00 }),
  ledCyan: new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
  psuHandle: new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.4, metalness: 0.6 })
};

function addRackEars(group, w, h, d) {
  const earW = 0.07;
  const earGeom = new THREE.BoxGeometry(earW, h * 0.94, 0.03);
  const leftEar = new THREE.Mesh(earGeom, MAT.silverMetal);
  leftEar.position.set(-w / 2 - earW / 2 + 0.02, 0, d / 2 - 0.02);
  const rightEar = new THREE.Mesh(earGeom, MAT.silverMetal);
  rightEar.position.set(w / 2 + earW / 2 - 0.02, 0, d / 2 - 0.02);
  group.add(leftEar, rightEar);
}

function addPortGrid(group, startX, endX, y, z, cols, rows, portW = 0.032, portH = 0.028, accentMat = null) {
  const spanX = endX - startX;
  const stepX = cols > 1 ? spanX / (cols - 1) : 0;
  const stepY = rows > 1 ? (portH * 1.45) : 0;
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
        const led = new THREE.Mesh(ledGeom, (c % 7 === 0) ? MAT.ledAmber : MAT.ledGreen);
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

// Create crisp canvas texture for floating 3D label and front silkscreen badge
export function createDeviceLabelSprite(hostname, ip, vendor, badgeColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');

  // Rounded dark glass background
  ctx.fillStyle = 'rgba(13, 18, 28, 0.88)';
  ctx.beginPath();
  ctx.roundRect(6, 6, 500, 132, 18);
  ctx.fill();

  // Accent border
  ctx.lineWidth = 4;
  ctx.strokeStyle = badgeColor || '#00e5ff';
  ctx.stroke();

  // Left color bar
  ctx.fillStyle = badgeColor || '#00e5ff';
  ctx.beginPath();
  ctx.roundRect(14, 16, 12, 112, 6);
  ctx.fill();

  // Hostname
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(hostname.slice(0, 22), 40, 58);

  // Subtext (Vendor + IP)
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

  if (spec.isRackContainer) {
    // 42U Enterprise Rack Frame with U markers and transparent side panels
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

    // Top & Bottom Cabinet Caps
    const capGeom = new THREE.BoxGeometry(w, 0.12, d);
    const topCap = new THREE.Mesh(capGeom, MAT.anthracite);
    topCap.position.set(0, h / 2 - 0.06, 0);
    const botCap = new THREE.Mesh(capGeom, MAT.anthracite);
    botCap.position.set(0, -h / 2 + 0.06, 0);
    root.add(topCap, botCap);

    // Semi-transparent smoked glass sides so mounted 3D servers remain visible from all 3 axes
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

    // Subtle U-slot guide ticks every 2U on front rails
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
    // Visio-style 3D Zone Platform
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
    const lineMat = new THREE.LineBasicMaterial({ color: zoneColor });
    root.add(new THREE.LineSegments(edges, lineMat));
  } else if (id === 'cloud-wan') {
    // 3D Cloud / Core WAN Node
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
    // Standard 3D Hardware Chassis
    const isForti200 = id === 'fortigate-200f' || id === 'fortigate-600f';
    const isPure = id.startsWith('pure-');
    const bodyMat = isForti200 ? MAT.fortiWhite : (isPure ? MAT.pureBlack : MAT.darkChassis);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    root.add(chassis);

    addRackEars(root, w, h, d);
    addRearPSUsAndPorts(root, w, h, d);

    const fz = d / 2 + 0.012;

    // Model-specific front panel detailing
    if (id === 'hpe-synergy-12000') {
      // 10U Blade Enclosure: 12 vertical half-height compute bays in 2 rows of 6 + Composer drawers
      const bayW = (w - 0.28) / 6;
      const bayH = h * 0.36;
      for (let row = 0; row < 2; row++) {
        const ry = row === 0 ? h * 0.20 : -h * 0.20;
        for (let col = 0; col < 6; col++) {
          const rx = -w / 2 + 0.14 + bayW / 2 + col * bayW;
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(bayW * 0.90, bayH * 0.90, 0.03),
            MAT.anthracite
          );
          blade.position.set(rx, ry, fz);
          root.add(blade);

          const hpeTab = new THREE.Mesh(
            new THREE.BoxGeometry(bayW * 0.65, 0.025, 0.036),
            MAT.hpeGreen
          );
          hpeTab.position.set(rx, ry - bayH * 0.32, fz + 0.004);
          root.add(hpeTab);

          const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.038), MAT.ledCyan);
          led.position.set(rx + bayW * 0.3, ry + bayH * 0.3, fz + 0.004);
          root.add(led);
        }
      }
      // Top & Bottom HPE Synergy Green Accent Bars
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.035, 0.035), MAT.hpeGreen);
      bar.position.set(0, h / 2 - 0.04, fz);
      root.add(bar);
    } else if (id.startsWith('nutanix-')) {
      // Nutanix 2U 24-bay NVMe + green/blue Nutanix left ear bezel
      const accent = id.includes('3060') ? MAT.nutanixGreen : MAT.dellBlue;
      addDriveBays(root, w, h, fz, 12, 2, accent);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.85, 0.035), accent);
      badge.position.set(-w / 2 + 0.06, 0, fz);
      root.add(badge);
    } else if (id.startsWith('hpe-alletra-')) {
      // HPE Alletra Storage: Sculpted dark bezel with glowing HPE green light bar
      const rows = id.includes('9000') ? 4 : 2;
      addDriveBays(root, w, h, fz, 12, rows, MAT.hpeGreen);
      const glowBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.42, 0.032, 0.042), MAT.hpeGreen);
      glowBar.position.set(-w * 0.2, 0, fz + 0.008);
      root.add(glowBar);
    } else if (id.startsWith('pure-')) {
      // Pure Storage FlashArray / FlashBlade: Sleek obsidian bezel with glowing orange Pure slash
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, h * 0.86, 0.028), MAT.pureBlack);
      panel.position.set(0, 0, fz);
      root.add(panel);

      // Iconic Pure Storage Orange Glowing Slash & Vertical Blade Fin Lines
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
    } else if (id === 'cisco-nexus-9508' || id === 'cisco-catalyst-9410r') {
      // 13U Modular Chassis: 8 Line Card slots + 2 Supervisor Engine slots + bottom Power Supply bay
      const isNexus = id === 'cisco-nexus-9508';
      const accent = isNexus ? MAT.ciscoCyan : MAT.ciscoBlue;
      const slotCount = 10;
      const slotAreaH = h * 0.72;
      const slotH = slotAreaH / slotCount;

      for (let s = 0; s < slotCount; s++) {
        const sy = h / 2 - 0.12 - s * slotH;
        const isSup = s === 4 || s === 5;
        const lc = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.92, slotH * 0.86, 0.03),
          isSup ? accent : MAT.anthracite
        );
        lc.position.set(0, sy, fz);
        root.add(lc);

        addPortGrid(root, -w * 0.38, w * 0.38, sy, fz + 0.012, isSup ? 8 : 16, 1, 0.03, 0.024, MAT.portDark);
      }

      // Bottom PSU Bay (8 PSUs)
      const psuY = -h / 2 + 0.16;
      for (let p = 0; p < 8; p++) {
        const px = -w * 0.41 + p * (w * 0.82 / 7);
        const psu = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.035), MAT.psuHandle);
        psu.position.set(px, psuY, fz);
        root.add(psu);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.04), MAT.ledGreen);
        led.position.set(px, psuY + 0.05, fz + 0.005);
        root.add(led);
      }
    } else if (id.startsWith('cisco-catalyst-9300') || id.startsWith('cisco-nexus-93180')) {
      // 1U Switch (24 or 48 ports + SFP28 Uplinks on the right)
      const is24 = id.includes('24t');
      const accent = id.includes('nexus') ? MAT.ciscoCyan : MAT.ciscoBlue;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.78, 0.03), accent);
      stripe.position.set(-w / 2 + 0.09, 0, fz);
      root.add(stripe);

      const cols = is24 ? 12 : 24;
      addPortGrid(root, -w / 2 + 0.22, w / 2 - 0.42, 0, fz, cols, 2, 0.034, 0.026, MAT.portDark);
      // Uplink module on right
      addPortGrid(root, w / 2 - 0.32, w / 2 - 0.08, 0, fz, 4, 2, 0.038, 0.028, accent);
    } else if (id.startsWith('fortigate-')) {
      // Fortinet FortiGate Series (1800F, 600F, 200F, 3000F) with signature Fortinet Red Stripe & QSFP/SFP cages
      const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, h * 0.82, 0.034), MAT.fortiRed);
      redBar.position.set(-w / 2 + 0.12, 0, fz);
      root.add(redBar);

      const topTrim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.018, 0.032), MAT.fortiRed);
      topTrim.position.set(0, h / 2 - 0.015, fz);
      root.add(topTrim);

      const is2U = h > 0.2;
      addPortGrid(root, -w / 2 + 0.28, w / 2 - 0.42, 0, fz, 12, is2U ? 2 : 2, 0.038, 0.028, MAT.portDark);
      // High-speed FortiLink / QSFP28 cages on right
      addPortGrid(root, w / 2 - 0.34, w / 2 - 0.08, 0, fz, 4, 2, 0.044, 0.032, MAT.fortiRed);
    } else {
      // HPE ProLiant DL380 / DL360 / Dell R760
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

