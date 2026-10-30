import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CATEGORIES, CABLE_TYPES, HARDWARE_CATALOG } from './catalog.js';
import {
  buildHardwareMesh,
  createDeviceLabelSprite,
  createTitle3DTexture,
  createProcessPanelTexture
} from './models3d.js';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

class NetVisio3DApp {
  constructor() {
    this.nodes = new Map();
    this.links = new Map();
    this.selectedNodeId = null;
    this.selectedLinkId = null;

    this.interactionMode = 'select';
    this.connectSourceNodeId = null;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.showLabels = true;
    this.animateTraffic = true;
    this.autoRotateScene = false;
    this.snapToGrid = true;

    this.initScene();
    this.initUI();
    this.loadEnterpriseSampleArchitecture();
    this.animate();
  }

  initScene() {
    this.viewportEl = document.getElementById('viewport-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b101b);
    this.scene.fog = new THREE.FogExp2(0x0b101b, 0.011);

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.viewportEl.clientWidth / this.viewportEl.clientHeight,
      0.1,
      300
    );
    this.camera.position.set(11.5, 9.2, 16.5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.viewportEl.clientWidth, this.viewportEl.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.viewportEl.appendChild(this.renderer.domElement);

    // OrbitControls allowing full 3-axis spherical freedom
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.06;
    this.orbit.minPolarAngle = 0;
    this.orbit.maxPolarAngle = Math.PI;
    this.orbit.target.set(-0.5, 1.8, 0.8);

    // TransformControls for 3-axis Translation, 3-axis Rotation (X, Y, Z), and Scaling
    this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControl.setSize(1.05);
    this.transformHelper = this.transformControl.getHelper
      ? this.transformControl.getHelper()
      : this.transformControl;
    this.scene.add(this.transformHelper);

    this.transformControl.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
    });
    this.transformControl.addEventListener('change', () => {
      if (this.selectedNodeId && this.transformControl.dragging) {
        const node = this.nodes.get(this.selectedNodeId);
        if (node) {
          // If moved manually with 3D arrows, detach from fixed rack U lock so it can move freely
          if (this.transformControl.getMode() === 'translate' && node.data.rackId) {
            node.data.rackId = '';
          }
          if (this.snapToGrid && this.transformControl.getMode() === 'translate') {
            node.group.position.x = Math.round(node.group.position.x * 10) / 10;
            node.group.position.y = Math.max(0.04, Math.round(node.group.position.y * 20) / 20);
            node.group.position.z = Math.round(node.group.position.z * 10) / 10;
          }
          this.syncNodeDataFromTransform(node);
          this.rebuildConnectedLinks(node.id);
          this.updateInspectorTransformInputs(node);
          this.updateSelectionHudBanner();
        }
      }
    });

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 1.25);
    this.scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.55);
    dirLight1.position.set(14, 24, 18);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.set(2048, 2048);
    dirLight1.shadow.camera.left = -22;
    dirLight1.shadow.camera.right = 22;
    dirLight1.shadow.camera.top = 22;
    dirLight1.shadow.camera.bottom = -22;
    this.scene.add(dirLight1);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-16, 12, -14);
    this.scene.add(rimLight);

    // Datacenter Raised Floor Grid + 3-Axis Reference Lines
    this.gridHelper = new THREE.GridHelper(38, 38, 0x0ea5e9, 0x1e293b);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(3.5);
    this.axesHelper.position.set(-18.5, 0.02, -18.5);
    this.scene.add(this.axesHelper);

    // Selection Box Helper
    this.selectionBox = new THREE.BoxHelper(new THREE.Mesh(), 0x00e5ff);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.setupViewportEvents();
  }

  setupViewportEvents() {
    let pointerDownPos = { x: 0, y: 0 };
    let isDirectDraggingNode = false;
    let directDragNode = null;
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragOffset = new THREE.Vector3();
    const dragIntersect = new THREE.Vector3();

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      if (e.button !== 0 || this.interactionMode === 'connect' || this.transformControl.axis) return;

      // If user clicks directly on the currently selected node in Translate mode, allow direct mouse drag!
      if (this.selectedNodeId && this.transformControl.getMode() === 'translate') {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const selNode = this.nodes.get(this.selectedNodeId);
        if (selNode && !selNode.spec.isZone) {
          const hits = this.raycaster.intersectObject(selNode.group, true);
          if (hits.length > 0) {
            isDirectDraggingNode = true;
            directDragNode = selNode;
            this.orbit.enabled = false;
            dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), selNode.group.position);
            if (this.raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
              dragOffset.copy(selNode.group.position).sub(dragIntersect);
            }
          }
        }
      }
    });

    this.renderer.domElement.addEventListener('pointermove', (e) => {
      if (!isDirectDraggingNode || !directDragNode) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      if (this.raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
        const targetPos = dragIntersect.add(dragOffset);
        directDragNode.data.rackId = '';
        directDragNode.group.position.x = Math.round(targetPos.x * 10) / 10;
        directDragNode.group.position.z = Math.round(targetPos.z * 10) / 10;
        this.syncNodeDataFromTransform(directDragNode);
        this.rebuildConnectedLinks(directDragNode.id);
        this.updateInspectorTransformInputs(directDragNode);
        this.updateSelectionHudBanner();
      }
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (isDirectDraggingNode) {
        isDirectDraggingNode = false;
        directDragNode = null;
        this.orbit.enabled = true;
      }
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      this.handleCanvasClick(e);
    });

    // Drag & Drop from Stencil Library onto 3D Floor / Racks / Hypervisor
    this.viewportEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.viewportEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const specId = e.dataTransfer.getData('text/plain');
      if (!specId) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const spec = HARDWARE_CATALOG.find((s) => s.id === specId);
      if (!spec) return;

      // If dropping a Virtual Server Cube, check if dropped onto a Hypervisor or Physical Server
      if (spec.isVirtualCube) {
        const hostMeshes = [];
        this.nodes.forEach((n) => {
          if (n.spec.isHypervisor || n.spec.category === 'compute') hostMeshes.push(n.group);
        });
        const hostHits = this.raycaster.intersectObjects(hostMeshes, true);
        if (hostHits.length > 0) {
          const hitHost = this.findNodeFromObject(hostHits[0].object);
          if (hitHost) {
            const topY = hitHost.group.position.y + hitHost.spec.height / 2 + spec.height / 2 + 0.02;
            const offsetX = Math.max(-0.75, Math.min(0.75, hostHits[0].point.x - hitHost.group.position.x));
            const created = this.addHardwareNode(specId, {
              position: [
                Number((hitHost.group.position.x + offsetX).toFixed(2)),
                Number(topY.toFixed(2)),
                Number(hitHost.group.position.z.toFixed(2))
              ]
            });
            this.selectNode(created.id);
            this.showToast(`Desplegado ${spec.name} sobre ${hitHost.data.hostname}`);
            return;
          }
        }
      }

      // Check if dropped onto an existing 42U Rack
      const rackMeshes = [];
      this.nodes.forEach((n) => {
        if (n.spec.isRackContainer) rackMeshes.push(n.group);
      });
      const rackHits = this.raycaster.intersectObjects(rackMeshes, true);

      if (rackHits.length > 0 && !spec.isRackContainer && !spec.isZone && spec.uHeight > 0) {
        const hitRackNode = this.findNodeFromObject(rackHits[0].object);
        if (hitRackNode) {
          const localY = rackHits[0].point.y - (hitRackNode.group.position.y - hitRackNode.spec.height / 2 + 0.16);
          const uStep = (hitRackNode.spec.height - 0.32) / 42;
          const targetU = Math.max(1, Math.min(42 - spec.uHeight + 1, Math.round(localY / uStep) + 1));
          const created = this.addHardwareNode(specId, {
            rackId: hitRackNode.id,
            uSlot: targetU
          });
          this.selectNode(created.id);
          this.showToast(`Montado ${spec.name} en ${hitRackNode.data.hostname} (U${targetU})`);
          return;
        }
      }

      // Otherwise drop onto 3D floor plane
      const hitPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.floorPlane, hitPoint)) {
        const x = Math.round(hitPoint.x * 2) / 2;
        const z = Math.round(hitPoint.z * 2) / 2;
        const created = this.addHardwareNode(specId, {
          position: [x, spec.height / 2, z]
        });
        this.selectNode(created.id);
        this.showToast(`Agregado ${spec.name} en (${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    });

    window.addEventListener('resize', () => {
      if (!this.viewportEl) return;
      this.camera.aspect = this.viewportEl.clientWidth / this.viewportEl.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.viewportEl.clientWidth, this.viewportEl.clientHeight);
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'w' || e.key === 'W') {
        this.setTransformMode('translate');
        this.showToast(
          this.selectedNodeId
            ? 'Modo Mover (W): Arrastra las flechas Roja/Verde/Azul, arrastra el equipo con el mouse o usa las flechas del teclado ←↑↓→'
            : 'Modo Mover (W) activo: Haz clic primero sobre cualquier equipo 3D para seleccionarlo y moverlo'
        );
      }
      if (e.key === 'e' || e.key === 'E') {
        this.setTransformMode('rotate');
        this.showToast(
          this.selectedNodeId
            ? 'Modo Rotar 3 Ejes (E): Arrastra los aros Rojo (X), Verde (Y) o Azul (Z) alrededor del equipo'
            : 'Modo Rotar (E) activo: Haz clic primero sobre un equipo 3D para rotarlo'
        );
      }
      if (e.key === 'r' || e.key === 'R') {
        this.setTransformMode('scale');
        this.showToast('Modo Escalar (R): Arrastra los cubos del gizmo para cambiar el tamaño');
      }
      if (e.key === 'c' || e.key === 'C') this.toggleConnectMode();
      if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
      if (e.key === 'Escape') {
        this.connectSourceNodeId = null;
        this.setInteractionMode('select');
      }

      // Keyboard Arrow Keys & +/- to move selected object directly
      if (this.selectedNodeId && this.nodes.has(this.selectedNodeId)) {
        const step = e.shiftKey ? 0.6 : 0.2;
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.nudgeSelectedNode(-step, 0, 0); }
        if (e.key === 'ArrowRight') { e.preventDefault(); this.nudgeSelectedNode(step, 0, 0); }
        if (e.key === 'ArrowUp') { e.preventDefault(); this.nudgeSelectedNode(0, 0, -step); }
        if (e.key === 'ArrowDown') { e.preventDefault(); this.nudgeSelectedNode(0, 0, step); }
        if (e.key === '+' || e.key === '=' || e.key === 'PageUp') { e.preventDefault(); this.nudgeSelectedNode(0, 0.14, 0); }
        if (e.key === '-' || e.key === '_' || e.key === 'PageDown') { e.preventDefault(); this.nudgeSelectedNode(0, -0.14, 0); }
      }
    });
  }

  nudgeSelectedNode(dx, dy, dz) {
    if (!this.selectedNodeId) return;
    const node = this.nodes.get(this.selectedNodeId);
    if (!node) return;
    node.data.rackId = '';
    node.group.position.x = Number((node.group.position.x + dx).toFixed(2));
    node.group.position.y = Math.max(0.04, Number((node.group.position.y + dy).toFixed(2)));
    node.group.position.z = Number((node.group.position.z + dz).toFixed(2));
    this.syncNodeDataFromTransform(node);
    this.rebuildConnectedLinks(node.id);
    this.updateInspectorTransformInputs(node);
    this.updateSelectionHudBanner();
  }

  findNodeFromObject(obj) {
    let curr = obj;
    while (curr) {
      if (curr.userData && curr.userData.nodeId) {
        return this.nodes.get(curr.userData.nodeId);
      }
      curr = curr.parent;
    }
    return null;
  }

  handleCanvasClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const pickables = [];
    this.nodes.forEach((n) => pickables.push(n.group));
    const hits = this.raycaster.intersectObjects(pickables, true);

    if (hits.length > 0) {
      let chosenNode = null;
      for (const hit of hits) {
        const candidate = this.findNodeFromObject(hit.object);
        if (candidate && !candidate.spec.isZone && !candidate.spec.isRackContainer) {
          chosenNode = candidate;
          break;
        }
      }
      if (!chosenNode) {
        chosenNode = this.findNodeFromObject(hits[0].object);
      }

      if (chosenNode) {
        if (this.interactionMode === 'connect') {
          this.handleConnectClick(chosenNode);
        } else {
          this.selectNode(chosenNode.id);
        }
        return;
      }
    }

    const linkMeshes = [];
    this.links.forEach((l) => {
      if (l.mesh) linkMeshes.push(l.mesh);
    });
    const linkHits = this.raycaster.intersectObjects(linkMeshes, false);
    if (linkHits.length > 0) {
      const linkId = linkHits[0].object.userData.linkId;
      if (linkId) {
        this.selectLink(linkId);
        return;
      }
    }

    this.selectNode(null);
  }

  handleConnectClick(node) {
    if (!this.connectSourceNodeId) {
      this.connectSourceNodeId = node.id;
      this.selectNode(node.id);
      this.showToast(`Origen seleccionado: ${node.data.hostname}. Ahora haz clic en el equipo destino.`);
      this.updateConnectBanner();
    } else if (this.connectSourceNodeId === node.id) {
      this.connectSourceNodeId = null;
      this.showToast('Conexión cancelada.');
      this.updateConnectBanner();
    } else {
      const fromNode = this.nodes.get(this.connectSourceNodeId);
      const cableSelect = document.getElementById('toolbar-cable-type');
      const routeSelect = document.getElementById('toolbar-route-style');
      const cableType = cableSelect ? cableSelect.value : 'om4-aqua';
      const routeStyle = routeSelect ? routeSelect.value : 'manhattan';

      const link = this.addCableLink({
        fromId: fromNode.id,
        toId: node.id,
        fromPort: fromNode.spec.ports?.[0] || 'Port-1',
        toPort: node.spec.ports?.[0] || 'Port-1',
        cableType,
        routeStyle
      });

      this.connectSourceNodeId = null;
      this.setInteractionMode('select');
      this.selectLink(link.id);
      this.showToast(`Cable 3D conectado: ${fromNode.data.hostname} ⇄ ${node.data.hostname}`);
    }
  }

  addHardwareNode(specId, customData = {}) {
    const spec = HARDWARE_CATALOG.find((s) => s.id === specId);
    if (!spec) throw new Error(`Unknown hardware spec: ${specId}`);

    const id = customData.id || `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const countOfSameType = Array.from(this.nodes.values()).filter((n) => n.spec.id === specId).length + 1;

    const data = {
      hostname: customData.hostname || `${spec.defaultHostname}-${String(countOfSameType).padStart(2, '0')}`,
      ip: customData.ip || spec.defaultIp,
      rackId: customData.rackId || '',
      uSlot: customData.uSlot || 1,
      notes: customData.notes || spec.specs,
      customColor: customData.customColor || spec.badgeColor,
      position: customData.position ? [...customData.position] : [0, spec.height / 2, 0],
      rotation: customData.rotation ? [...customData.rotation] : [0, 0, 0],
      scale: customData.scale ? [...customData.scale] : [1, 1, 1]
    };

    const group = buildHardwareMesh(spec, data);
    group.userData.nodeId = id;

    if (data.rackId && this.nodes.has(data.rackId)) {
      this.positionNodeInRack(group, spec, data);
    } else {
      group.position.set(data.position[0], data.position[1], data.position[2]);
      group.rotation.set(
        data.rotation[0] * DEG2RAD,
        data.rotation[1] * DEG2RAD,
        data.rotation[2] * DEG2RAD
      );
    }
    group.scale.set(data.scale[0], data.scale[1], data.scale[2]);

    const label = group.getObjectByName('deviceLabelSprite');
    if (label) label.visible = this.showLabels;

    this.scene.add(group);
    const nodeObj = { id, spec, group, data };
    this.nodes.set(id, nodeObj);
    this.updateStatsBar();
    return nodeObj;
  }

  positionNodeInRack(group, spec, data) {
    const rack = this.nodes.get(data.rackId);
    if (!rack) return;
    const uStep = (rack.spec.height - 0.32) / 42;
    const uSlot = Math.max(1, Math.min(42 - (spec.uHeight || 1) + 1, Number(data.uSlot) || 1));
    data.uSlot = uSlot;

    const localY = -rack.spec.height / 2 + 0.16 + (uSlot - 1 + (spec.uHeight || 1) / 2) * uStep;
    const localOffset = new THREE.Vector3(0, localY, 0.08);
    localOffset.applyEuler(rack.group.rotation);

    group.position.copy(rack.group.position).add(localOffset);
    group.rotation.copy(rack.group.rotation);
    data.position = [group.position.x, group.position.y, group.position.z];
    data.rotation = [
      Math.round(group.rotation.x * RAD2DEG),
      Math.round(group.rotation.y * RAD2DEG),
      Math.round(group.rotation.z * RAD2DEG)
    ];
  }

  syncNodeDataFromTransform(node) {
    node.data.position = [
      Number(node.group.position.x.toFixed(2)),
      Number(node.group.position.y.toFixed(2)),
      Number(node.group.position.z.toFixed(2))
    ];
    node.data.rotation = [
      Math.round(node.group.rotation.x * RAD2DEG),
      Math.round(node.group.rotation.y * RAD2DEG),
      Math.round(node.group.rotation.z * RAD2DEG)
    ];
    node.data.scale = [
      Number(node.group.scale.x.toFixed(2)),
      Number(node.group.scale.y.toFixed(2)),
      Number(node.group.scale.z.toFixed(2))
    ];

    if (node.spec.isRackContainer) {
      this.nodes.forEach((child) => {
        if (child.data.rackId === node.id) {
          this.positionNodeInRack(child.group, child.spec, child.data);
          this.rebuildConnectedLinks(child.id);
        }
      });
    }
  }

  buildCableCurve(fromNode, toNode, routeStyle = 'manhattan') {
    const p1 = fromNode.group.position.clone();
    const p2 = toNode.group.position.clone();

    const start = p1.clone().add(new THREE.Vector3(0, fromNode.spec.height * 0.25, -fromNode.spec.depth * 0.35));
    const end = p2.clone().add(new THREE.Vector3(0, toNode.spec.height * 0.25, -toNode.spec.depth * 0.35));

    if (routeStyle === 'overhead') {
      const trayY = Math.max(start.y, end.y, 4.2) + 1.1;
      const c1 = new THREE.Vector3(start.x, trayY, start.z);
      const c2 = new THREE.Vector3(end.x, trayY, end.z);
      return new THREE.CatmullRomCurve3([start, c1, c2, end], false, 'catmullrom', 0.18);
    } else if (routeStyle === 'bezier') {
      const mid = start.clone().lerp(end, 0.5);
      mid.y += Math.max(1.0, start.distanceTo(end) * 0.22);
      return new THREE.QuadraticBezierCurve3(start, mid, end);
    } else {
      const trayY = Math.max(start.y, end.y) + 0.65;
      const midZ = (start.z + end.z) / 2 - 0.45;
      const pts = [
        start,
        new THREE.Vector3(start.x, trayY, start.z),
        new THREE.Vector3(start.x, trayY, midZ),
        new THREE.Vector3(end.x, trayY, midZ),
        new THREE.Vector3(end.x, trayY, end.z),
        end
      ];
      return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.08);
    }
  }

  addCableLink({ id, fromId, toId, fromPort, toPort, cableType = 'om4-aqua', routeStyle = 'manhattan', label = '' }) {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    if (!fromNode || !toNode) return null;

    const linkId = id || `link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cableSpec = CABLE_TYPES.find((c) => c.id === cableType) || CABLE_TYPES[0];
    const curve = this.buildCableCurve(fromNode, toNode, routeStyle);

    const geom = new THREE.TubeGeometry(curve, 48, cableSpec.radius, 10, false);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cableSpec.color),
      emissive: new THREE.Color(cableSpec.color).multiplyScalar(0.28),
      roughness: 0.25,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.linkId = linkId;
    this.scene.add(mesh);

    const pulses = [];
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 2; i++) {
      const pMesh = new THREE.Mesh(new THREE.SphereGeometry(cableSpec.radius * 1.65, 10, 10), pulseMat);
      this.scene.add(pMesh);
      pulses.push({ mesh: pMesh, t: i * 0.5 });
    }

    const linkObj = {
      id: linkId,
      fromId,
      toId,
      fromPort: fromPort || 'Port-1',
      toPort: toPort || 'Port-1',
      cableType,
      routeStyle,
      label: label || cableSpec.speed,
      curve,
      mesh,
      pulses
    };

    this.links.set(linkId, linkObj);
    this.updateStatsBar();
    return linkObj;
  }

  rebuildConnectedLinks(nodeId) {
    this.links.forEach((link) => {
      if (link.fromId === nodeId || link.toId === nodeId) {
        const fromNode = this.nodes.get(link.fromId);
        const toNode = this.nodes.get(link.toId);
        if (!fromNode || !toNode) return;
        const cableSpec = CABLE_TYPES.find((c) => c.id === link.cableType) || CABLE_TYPES[0];
        link.curve = this.buildCableCurve(fromNode, toNode, link.routeStyle);
        link.mesh.geometry.dispose();
        link.mesh.geometry = new THREE.TubeGeometry(link.curve, 48, cableSpec.radius, 10, false);
        link.mesh.material.color.set(cableSpec.color);
        link.mesh.material.emissive.set(cableSpec.color).multiplyScalar(0.28);
      }
    });
  }

  selectNode(nodeId) {
    this.selectedLinkId = null;
    this.selectedNodeId = nodeId;

    if (!nodeId || !this.nodes.has(nodeId)) {
      this.transformControl.detach();
      this.selectionBox.visible = false;
      this.updateSelectionHudBanner();
      this.renderInspector();
      return;
    }

    const node = this.nodes.get(nodeId);
    this.transformControl.attach(node.group);
    this.selectionBox.setFromObject(node.group);
    this.selectionBox.visible = true;
    this.updateSelectionHudBanner();
    this.renderInspector();
  }

  selectLink(linkId) {
    this.selectedNodeId = null;
    this.selectedLinkId = linkId;
    this.transformControl.detach();
    this.selectionBox.visible = false;
    this.updateSelectionHudBanner();
    this.renderInspector();
  }

  updateSelectionHudBanner() {
    const hud = document.getElementById('selection-hud-banner');
    if (!hud) return;
    if (!this.selectedNodeId || !this.nodes.has(this.selectedNodeId) || this.interactionMode === 'connect') {
      hud.hidden = true;
      return;
    }
    const node = this.nodes.get(this.selectedNodeId);
    const mode = this.transformControl.getMode();
    const modeText =
      mode === 'rotate'
        ? 'Arrastra los aros Rojo (X), Verde (Y), Azul (Z) para rotar'
        : mode === 'scale'
        ? 'Arrastra los cubos del gizmo para escalar'
        : 'Arrastra las flechas Roja (X), Verde (Y), Azul (Z), arrastra el equipo con el mouse o usa el teclado ←↑↓→';

    hud.hidden = false;
    hud.innerHTML = `
      <div class="selection-hud-top">
        <span><strong>${node.data.hostname}</strong> <code>(${node.data.position.join(', ')})</code></span>
        <span style="color:#38bdf8; font-size:11px;">${modeText}</span>
      </div>
      <div class="selection-hud-btns">
        <button class="btn-mini" data-nudge="-0.3,0,0">⬅ Izq (X-)</button>
        <button class="btn-mini" data-nudge="0.3,0,0">Der (X+) ➡</button>
        <button class="btn-mini" data-nudge="0,0,-0.3">⬆ Fondo (Z-)</button>
        <button class="btn-mini" data-nudge="0,0,0.3">⬇ Frente (Z+)</button>
        <button class="btn-mini" data-nudge="0,0.14,0">🔼 Subir (Y+)</button>
        <button class="btn-mini" data-nudge="0,-0.14,0">🔽 Bajar (Y-)</button>
        <button class="btn-mini" id="hud-btn-rot90">↻ Girar 90°</button>
      </div>
    `;

    hud.querySelectorAll('[data-nudge]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [dx, dy, dz] = btn.dataset.nudge.split(',').map(Number);
        this.nudgeSelectedNode(dx, dy, dz);
      });
    });

    hud.querySelector('#hud-btn-rot90')?.addEventListener('click', () => {
      node.group.rotation.y += Math.PI / 2;
      this.syncNodeDataFromTransform(node);
      this.rebuildConnectedLinks(node.id);
      this.updateInspectorTransformInputs(node);
      this.updateSelectionHudBanner();
    });
  }

  deleteSelected() {
    if (this.selectedNodeId) {
      const id = this.selectedNodeId;
      const node = this.nodes.get(id);
      if (!node) return;
      this.transformControl.detach();
      this.selectionBox.visible = false;
      this.scene.remove(node.group);
      this.nodes.delete(id);

      Array.from(this.links.values()).forEach((l) => {
        if (l.fromId === id || l.toId === id) {
          this.scene.remove(l.mesh);
          l.pulses.forEach((p) => this.scene.remove(p.mesh));
          this.links.delete(l.id);
        }
      });

      this.selectedNodeId = null;
      this.renderInspector();
      this.updateStatsBar();
      this.showToast(`Eliminado ${node.data.hostname}`);
    } else if (this.selectedLinkId) {
      const link = this.links.get(this.selectedLinkId);
      if (!link) return;
      this.scene.remove(link.mesh);
      link.pulses.forEach((p) => this.scene.remove(p.mesh));
      this.links.delete(this.selectedLinkId);
      this.selectedLinkId = null;
      this.renderInspector();
      this.updateStatsBar();
      this.showToast('Cable 3D eliminado');
    }
  }

  duplicateSelectedNode() {
    if (!this.selectedNodeId) return;
    const orig = this.nodes.get(this.selectedNodeId);
    if (!orig) return;

    const dup = this.addHardwareNode(orig.spec.id, {
      hostname: `${orig.data.hostname}-COPY`,
      ip: orig.data.ip,
      position: [orig.group.position.x + 1.4, orig.group.position.y, orig.group.position.z],
      rotation: [...orig.data.rotation],
      scale: [...orig.data.scale]
    });
    this.selectNode(dup.id);
    this.showToast(`Duplicado: ${dup.data.hostname}`);
  }

  setTransformMode(mode) {
    this.transformControl.setMode(mode);
    document.querySelectorAll('[data-transform-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.transformMode === mode);
    });
    this.updateSelectionHudBanner();
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
    if (mode !== 'connect') this.connectSourceNodeId = null;
    document.getElementById('btn-mode-select')?.classList.toggle('active', mode === 'select');
    document.getElementById('btn-mode-connect')?.classList.toggle('active', mode === 'connect');
    this.updateConnectBanner();
  }

  toggleConnectMode() {
    this.setInteractionMode(this.interactionMode === 'connect' ? 'select' : 'connect');
  }

  updateConnectBanner() {
    const banner = document.getElementById('connect-mode-banner');
    if (!banner) return;
    if (this.interactionMode !== 'connect') {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    const srcNode = this.connectSourceNodeId ? this.nodes.get(this.connectSourceNodeId) : null;
    banner.innerHTML = srcNode
      ? `<strong>Modo Cable 3D Activo:</strong> Origen <code>${srcNode.data.hostname}</code> seleccionado → Haz clic en el equipo Destino (o presiona Esc para cancelar)`
      : `<strong>Modo Cable 3D Activo:</strong> Haz clic en el primer equipo 3D (Origen) para iniciar el tendido de fibra/red`;
  }

  setCameraPreset(preset) {
    const target = new THREE.Vector3(-0.5, 1.8, 0.8);
    if (this.selectedNodeId && this.nodes.has(this.selectedNodeId)) {
      target.copy(this.nodes.get(this.selectedNodeId).group.position);
    }
    this.orbit.target.copy(target);

    const dist = 16;
    switch (preset) {
      case 'iso':
        this.camera.position.set(target.x + 11.5, target.y + 8.5, target.z + 15.0);
        break;
      case 'front':
        this.camera.position.set(target.x, target.y + 1.2, target.z + dist);
        break;
      case 'rear':
        this.camera.position.set(target.x, target.y + 1.2, target.z - dist);
        break;
      case 'top':
        this.camera.position.set(target.x, target.y + dist * 1.25, target.z + 0.01);
        break;
      case 'left':
        this.camera.position.set(target.x - dist, target.y + 1.5, target.z);
        break;
      case 'right':
        this.camera.position.set(target.x + dist, target.y + 1.5, target.z);
        break;
    }
    this.orbit.update();
  }

  setCameraSphericalAngles(azimuthDeg, polarDeg, rollDeg) {
    const offset = this.camera.position.clone().sub(this.orbit.target);
    const radius = Math.max(4, offset.length());
    const phi = THREE.MathUtils.clamp(polarDeg * DEG2RAD, 0.05, Math.PI - 0.05);
    const theta = azimuthDeg * DEG2RAD;

    this.camera.position.set(
      this.orbit.target.x + radius * Math.sin(phi) * Math.sin(theta),
      this.orbit.target.y + radius * Math.cos(phi),
      this.orbit.target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.up.set(Math.sin(rollDeg * DEG2RAD), Math.cos(rollDeg * DEG2RAD), 0).normalize();
    this.camera.lookAt(this.orbit.target);
  }

  initUI() {
    const catContainer = document.getElementById('category-tabs');
    catContainer.innerHTML = CATEGORIES.map(
      (c) => `
      <button class="cat-pill ${c.id === this.activeCategory ? 'active' : ''}" data-cat="${c.id}">
        <span aria-hidden="true">${c.icon}</span> ${c.name}
      </button>`
    ).join('');

    catContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      this.activeCategory = btn.dataset.cat;
      catContainer.querySelectorAll('.cat-pill').forEach((b) => b.classList.toggle('active', b === btn));
      this.renderStencilCatalog();
    });

    const searchInput = document.getElementById('catalog-search');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderStencilCatalog();
    });

    const cableSelect = document.getElementById('toolbar-cable-type');
    cableSelect.innerHTML = CABLE_TYPES.map(
      (c) => `<option value="${c.id}">${c.name}</option>`
    ).join('');

    this.renderStencilCatalog();
    this.bindToolbarButtons();
    this.renderInspector();
  }

  renderStencilCatalog() {
    const listEl = document.getElementById('catalog-list');
    const filtered = HARDWARE_CATALOG.filter((item) => {
      const matchesCat = this.activeCategory === 'all' || item.category === this.activeCategory;
      const matchesSearch =
        !this.searchQuery ||
        item.name.toLowerCase().includes(this.searchQuery) ||
        item.vendor.toLowerCase().includes(this.searchQuery) ||
        item.specs.toLowerCase().includes(this.searchQuery);
      return matchesCat && matchesSearch;
    });

    listEl.innerHTML = filtered
      .map(
        (item) => `
      <div class="stencil-card" draggable="true" data-spec-id="${item.id}" title="Arrastra al lienzo 3D o haz clic en + Añadir">
        <div class="stencil-accent" style="background:${item.badgeColor}"></div>
        <div class="stencil-body">
          <div class="stencil-top">
            <span class="stencil-vendor" style="color:${item.badgeColor}">${item.vendor}</span>
            <span class="stencil-u">${item.uHeight ? `${item.uHeight}U` : item.isVirtualCube ? 'VM 3D' : '3D'}</span>
          </div>
          <div class="stencil-title">${item.name}</div>
          <div class="stencil-specs">${item.specs}</div>
        </div>
        <button class="btn-quick-add" data-add-spec="${item.id}" aria-label="Añadir ${item.name}">+</button>
      </div>`
      )
      .join('');

    listEl.querySelectorAll('.stencil-card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.specId);
      });
    });

    listEl.querySelectorAll('[data-add-spec]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const specId = btn.dataset.addSpec;
        const spec = HARDWARE_CATALOG.find((s) => s.id === specId);
        const selectedNode = this.selectedNodeId ? this.nodes.get(this.selectedNodeId) : null;

        if (selectedNode && selectedNode.spec.isRackContainer && !spec.isRackContainer && !spec.isZone && spec.uHeight > 0) {
          const nextU = this.findNextAvailableUSlot(selectedNode.id, spec.uHeight || 1);
          const created = this.addHardwareNode(specId, {
            rackId: selectedNode.id,
            uSlot: nextU
          });
          this.selectNode(created.id);
          this.showToast(`Instalado ${spec.name} en ${selectedNode.data.hostname} (U${nextU})`);
        } else if (selectedNode && (selectedNode.spec.isHypervisor || selectedNode.spec.category === 'compute') && spec.isVirtualCube) {
          // Place Virtual Server Cube right on top of the selected Hypervisor or Server
          const topY = selectedNode.group.position.y + selectedNode.spec.height / 2 + spec.height / 2 + 0.02;
          const jitterX = (Math.random() - 0.5) * 1.1;
          const created = this.addHardwareNode(specId, {
            position: [
              Number((selectedNode.group.position.x + jitterX).toFixed(2)),
              Number(topY.toFixed(2)),
              Number(selectedNode.group.position.z.toFixed(2))
            ]
          });
          this.selectNode(created.id);
          this.showToast(`Añadido ${spec.name} sobre ${selectedNode.data.hostname}`);
        } else {
          const jitterX = (Math.random() - 0.5) * 3;
          const jitterZ = (Math.random() - 0.5) * 3;
          const created = this.addHardwareNode(specId, {
            position: [Math.round(jitterX * 2) / 2, spec.height / 2, Math.round(jitterZ * 2) / 2]
          });
          this.selectNode(created.id);
          this.showToast(`Añadido ${spec.name} al diagrama 3D`);
        }
      });
    });
  }

  findNextAvailableUSlot(rackId, uHeight) {
    const occupied = new Set();
    this.nodes.forEach((n) => {
      if (n.data.rackId === rackId) {
        const start = n.data.uSlot || 1;
        const h = n.spec.uHeight || 1;
        for (let u = start; u < start + h; u++) occupied.add(u);
      }
    });
    for (let u = 1; u <= 42 - uHeight + 1; u++) {
      let fits = true;
      for (let k = 0; k < uHeight; k++) {
        if (occupied.has(u + k)) {
          fits = false;
          break;
        }
      }
      if (fits) return u;
    }
    return 1;
  }

  bindToolbarButtons() {
    document.getElementById('btn-mode-select')?.addEventListener('click', () => this.setInteractionMode('select'));
    document.getElementById('btn-mode-connect')?.addEventListener('click', () => this.setInteractionMode('connect'));

    // Quick-Add Toolbar Buttons for 3D Title, 3D Process Text Panel, and 3D Flow Arrow
    document.getElementById('btn-add-title3d')?.addEventListener('click', () => {
      const node = this.addHardwareNode('title-3d-banner', {
        position: [0, 5.4, -5.2]
      });
      this.selectNode(node.id);
      this.showToast('Título 3D añadido — Puedes arrastrarlo, rotarlo o editar su texto en el Inspector');
    });

    document.getElementById('btn-add-textpanel')?.addEventListener('click', () => {
      const jitterX = Math.round((Math.random() - 0.5) * 6 * 2) / 2;
      const node = this.addHardwareNode('text-panel-3d', {
        position: [jitterX, 2.8, 2.2]
      });
      this.selectNode(node.id);
      this.showToast('Panel de Proceso 3D añadido — Edita el texto multilínea en el Inspector derecho');
    });

    document.getElementById('btn-add-arrow3d')?.addEventListener('click', () => {
      const jitterX = Math.round((Math.random() - 0.5) * 4 * 2) / 2;
      const node = this.addHardwareNode('arrow-3d-straight', {
        position: [jitterX, 1.8, 3.2]
      });
      this.selectNode(node.id);
      this.showToast('Flecha de Flujo 3D añadida — Usa E para rotarla o elige otras formas en la librería');
    });

    document.querySelectorAll('[data-transform-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setInteractionMode('select');
        this.setTransformMode(btn.dataset.transformMode);
      });
    });

    document.querySelectorAll('[data-cam-preset]').forEach((btn) => {
      btn.addEventListener('click', () => this.setCameraPreset(btn.dataset.camPreset));
    });

    const sliderYaw = document.getElementById('scene-rot-y');
    const sliderPitch = document.getElementById('scene-rot-x');
    const sliderRoll = document.getElementById('scene-rot-z');
    const updateSceneRot = () => {
      const yaw = Number(sliderYaw.value);
      const pitch = Number(sliderPitch.value);
      const roll = Number(sliderRoll.value);
      document.getElementById('val-scene-y').textContent = `${yaw}°`;
      document.getElementById('val-scene-x').textContent = `${pitch}°`;
      document.getElementById('val-scene-z').textContent = `${roll}°`;
      this.setCameraSphericalAngles(yaw, pitch, roll);
    };
    sliderYaw?.addEventListener('input', updateSceneRot);
    sliderPitch?.addEventListener('input', updateSceneRot);
    sliderRoll?.addEventListener('input', updateSceneRot);

    document.getElementById('btn-reset-axes')?.addEventListener('click', () => {
      if (sliderYaw) sliderYaw.value = 38;
      if (sliderPitch) sliderPitch.value = 58;
      if (sliderRoll) sliderRoll.value = 0;
      this.camera.up.set(0, 1, 0);
      this.setCameraPreset('iso');
      document.getElementById('val-scene-y').textContent = '38°';
      document.getElementById('val-scene-x').textContent = '58°';
      document.getElementById('val-scene-z').textContent = '0°';
    });

    document.getElementById('btn-toggle-labels')?.addEventListener('click', (e) => {
      this.showLabels = !this.showLabels;
      e.currentTarget.classList.toggle('active', this.showLabels);
      this.nodes.forEach((n) => {
        const sp = n.group.getObjectByName('deviceLabelSprite');
        if (sp) sp.visible = this.showLabels;
      });
    });

    document.getElementById('btn-toggle-autorotate')?.addEventListener('click', (e) => {
      this.autoRotateScene = !this.autoRotateScene;
      this.orbit.autoRotate = this.autoRotateScene;
      this.orbit.autoRotateSpeed = 1.6;
      e.currentTarget.classList.toggle('active', this.autoRotateScene);
    });

    document.getElementById('btn-load-demo')?.addEventListener('click', () => {
      this.loadEnterpriseSampleArchitecture();
      this.showToast('Arquitectura Enterprise Datacenter 3D cargada');
    });

    document.getElementById('btn-clear-scene')?.addEventListener('click', () => {
      this.clearScene();
      this.showToast('Lienzo 3D limpio');
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => this.exportDiagramJSON());
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      document.getElementById('file-import-json')?.click();
    });
    document.getElementById('file-import-json')?.addEventListener('change', (e) => this.importDiagramJSON(e));

    // Export to PNG Modal & Quick PNG Download
    document.getElementById('btn-export-png')?.addEventListener('click', () => this.openPNGExportDialog());
    document.getElementById('btn-quick-png')?.addEventListener('click', () => this.openPNGExportDialog());
    document.getElementById('btn-close-png-dialog')?.addEventListener('click', () => {
      document.getElementById('png-export-dialog')?.close();
    });
    document.getElementById('btn-cancel-png')?.addEventListener('click', () => {
      document.getElementById('png-export-dialog')?.close();
    });
    document.getElementById('btn-download-png-confirm')?.addEventListener('click', () => {
      this.downloadConfiguredPNG();
    });

    ['png-scale-select', 'png-bg-select', 'png-include-header', 'png-title-input'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => this.refreshPNGDialogPreview());
      document.getElementById(id)?.addEventListener('change', () => this.refreshPNGDialogPreview());
    });

    document.getElementById('btn-export-bom')?.addEventListener('click', () => this.exportBOMCSV());
  }

  // ================= HIGH-RESOLUTION PNG EXPORT ENGINE =================
  generateCompositePNGCanvas({ scale = 2, bgMode = 'dark', includeHeader = true, titleText = '' } = {}) {
    const prevGizmoVisible = this.transformHelper ? this.transformHelper.visible : true;
    const prevBoxVisible = this.selectionBox.visible;
    const prevBg = this.scene.background;
    const prevFog = this.scene.fog;
    const prevPixelRatio = this.renderer.getPixelRatio();

    // Hide gizmos during clean PNG render
    if (this.transformHelper) this.transformHelper.visible = false;
    this.selectionBox.visible = false;

    if (bgMode === 'transparent') {
      this.scene.background = null;
      this.scene.fog = null;
    } else if (bgMode === 'light') {
      this.scene.background = new THREE.Color(0xf8fafc);
      this.scene.fog = null;
    } else {
      this.scene.background = new THREE.Color(0x0b101b);
    }

    this.renderer.setPixelRatio(scale);
    this.renderer.render(this.scene, this.camera);

    const glCanvas = this.renderer.domElement;
    const headerH = includeHeader ? Math.round(68 * scale) : 0;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = glCanvas.width;
    outCanvas.height = glCanvas.height + headerH;
    const ctx = outCanvas.getContext('2d');

    if (bgMode === 'light') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    } else if (bgMode === 'dark') {
      ctx.fillStyle = '#0b101b';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    }

    if (includeHeader) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, outCanvas.width, headerH);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(0, headerH - 3 * scale, outCanvas.width, 3 * scale);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${20 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(
        titleText || 'NetVisio 3D Studio — Diagrama de Infraestructura 3D',
        20 * scale,
        28 * scale
      );

      const devCount = Array.from(this.nodes.values()).filter((n) => !n.spec.isZone).length;
      const vmCount = Array.from(this.nodes.values()).filter((n) => n.spec.isVirtualCube).length;
      const linkCount = this.links.size;
      const dateStr = new Date().toLocaleDateString('es-ES');

      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 ${13 * scale}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillText(
        `${devCount} Equipos Totales • ${vmCount} Servidores Virtuales • ${linkCount} Enlaces 3D • Exportado: ${dateStr}`,
        20 * scale,
        51 * scale
      );
    }

    ctx.drawImage(glCanvas, 0, headerH);

    // Restore scene & renderer state
    this.renderer.setPixelRatio(prevPixelRatio);
    this.scene.background = prevBg;
    this.scene.fog = prevFog;
    if (this.transformHelper) this.transformHelper.visible = prevGizmoVisible;
    this.selectionBox.visible = prevBoxVisible;
    this.renderer.render(this.scene, this.camera);

    return outCanvas;
  }

  openPNGExportDialog() {
    const dialog = document.getElementById('png-export-dialog');
    this.refreshPNGDialogPreview();
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      this.downloadConfiguredPNG();
    }
  }

  refreshPNGDialogPreview() {
    const previewImg = document.getElementById('png-preview-img');
    if (!previewImg) return;
    const bgMode = document.getElementById('png-bg-select')?.value || 'dark';
    const includeHeader = document.getElementById('png-include-header')?.checked ?? true;
    const titleText = document.getElementById('png-title-input')?.value || '';

    const canvas = this.generateCompositePNGCanvas({
      scale: 1,
      bgMode,
      includeHeader,
      titleText
    });
    previewImg.src = canvas.toDataURL('image/png');
  }

  downloadConfiguredPNG() {
    const scale = parseInt(document.getElementById('png-scale-select')?.value || '2', 10);
    const bgMode = document.getElementById('png-bg-select')?.value || 'dark';
    const includeHeader = document.getElementById('png-include-header')?.checked ?? true;
    const titleText = document.getElementById('png-title-input')?.value || '';

    const outCanvas = this.generateCompositePNGCanvas({
      scale,
      bgMode,
      includeHeader,
      titleText
    });

    const filename = `netview3d-diagrama-${Date.now()}.png`;
    if (outCanvas.toBlob) {
      outCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        document.getElementById('png-export-dialog')?.close();
        this.showToast(`Imagen PNG (${outCanvas.width}×${outCanvas.height}px) descargada`);
      }, 'image/png');
    } else {
      const a = document.createElement('a');
      a.href = outCanvas.toDataURL('image/png');
      a.download = filename;
      a.click();
      document.getElementById('png-export-dialog')?.close();
      this.showToast('Imagen PNG descargada');
    }
  }

  updateInspectorTransformInputs(node) {
    const fields = {
      'inp-pos-x': node.data.position[0],
      'inp-pos-y': node.data.position[1],
      'inp-pos-z': node.data.position[2],
      'inp-rot-x': node.data.rotation[0],
      'inp-rot-y': node.data.rotation[1],
      'inp-rot-z': node.data.rotation[2]
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = val;
    });
    this.selectionBox.setFromObject(node.group);
  }

  renderInspector() {
    const container = document.getElementById('inspector-content');
    if (!container) return;

    if (this.selectedNodeId && this.nodes.has(this.selectedNodeId)) {
      const node = this.nodes.get(this.selectedNodeId);
      const { spec, data } = node;

      const availableRacks = Array.from(this.nodes.values()).filter(
        (n) => n.spec.isRackContainer && n.id !== node.id
      );

      const nodeLinks = Array.from(this.links.values()).filter(
        (l) => l.fromId === node.id || l.toId === node.id
      );

      container.innerHTML = `
        <div class="insp-section">
          <div class="insp-badge" style="background:${spec.badgeColor}22; color:${spec.badgeColor}; border:1px solid ${spec.badgeColor}">
            ${spec.vendor} • ${spec.uHeight ? `${spec.uHeight}U` : spec.isVirtualCube ? 'Servidor Virtual 3D' : 'Topología 3D'}
          </div>
          <h3 class="insp-title">${spec.name}</h3>
          <p class="insp-sub">${spec.specs}</p>

          <label class="insp-label">${
            spec.isTitle3D
              ? 'Texto del Título Principal 3D'
              : spec.isTextPanel3D
              ? 'Encabezado del Panel de Proceso'
              : spec.isFlowArrow
              ? 'Etiqueta de la Flecha de Flujo'
              : 'Hostname / Etiqueta 3D'
          }</label>
          <input type="text" id="inp-hostname" class="insp-input" value="${data.hostname}" />

          ${
            spec.isTextPanel3D
              ? `
          <label class="insp-label">Explicación del Proceso / Pasos (Multilínea)</label>
          <textarea id="inp-ip" class="insp-input" rows="5" style="resize:vertical; font-family:inherit; line-height:1.4;">${data.ip}</textarea>`
              : `
          <label class="insp-label">${
            spec.isTitle3D
              ? 'Subtítulo del Diagrama 3D'
              : spec.isFlowArrow
              ? 'Detalle / Protocolo del Flujo'
              : 'IP de Gestión / Sistema Operativo / Rol'
          }</label>
          <input type="text" id="inp-ip" class="insp-input" value="${data.ip}" />`
          }
        </div>

        ${
          spec.isZone || spec.isTitle3D || spec.isTextPanel3D || spec.isFlowArrow
            ? `
        <div class="insp-section">
          <div class="insp-section-title">Color 3D (Azul / Rojo / Verde / Cian / Ámbar / Morado)</div>
          <div class="quick-rot-row" style="flex-wrap:wrap;">
            <button class="btn-mini" data-zone-color="#00e5ff" style="border-color:#00e5ff; color:#67e8f9;">💎 Cian</button>
            <button class="btn-mini" data-zone-color="#2979ff" style="border-color:#2979ff; color:#60a5fa;">🟦 Azul</button>
            <button class="btn-mini" data-zone-color="#ee3124" style="border-color:#ee3124; color:#f87171;">🟥 Rojo</button>
            <button class="btn-mini" data-zone-color="#00c853" style="border-color:#00c853; color:#4ade80;">🟩 Verde</button>
            <button class="btn-mini" data-zone-color="#ffab00" style="border-color:#ffab00; color:#fcd34d;">🟨 Ámbar</button>
            <button class="btn-mini" data-zone-color="#d500f9" style="border-color:#d500f9; color:#e879f9;">🟪 Morado</button>
          </div>
        </div>`
            : ''
        }

        ${
          !spec.isRackContainer && !spec.isZone && spec.uHeight > 0
            ? `
        <div class="insp-section">
          <div class="insp-section-title">Montaje en Rack 42U</div>
          <div class="insp-grid-2">
            <div>
              <label class="insp-label">Gabinete Rack</label>
              <select id="inp-rack-id" class="insp-input">
                <option value="">Libre en espacio 3D</option>
                ${availableRacks
                  .map(
                    (r) =>
                      `<option value="${r.id}" ${data.rackId === r.id ? 'selected' : ''}>${r.data.hostname}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div>
              <label class="insp-label">Unidad U (1-42)</label>
              <input type="number" id="inp-u-slot" class="insp-input" min="1" max="42" value="${data.uSlot || 1}" />
            </div>
          </div>
        </div>`
            : ''
        }

        <div class="insp-section">
          <div class="insp-section-title">Rotación 3D del Objeto (3 Ejes X, Y, Z)</div>
          <div class="insp-grid-3">
            <div>
              <label class="insp-label">Eje X (Pitch °)</label>
              <input type="number" id="inp-rot-x" class="insp-input" step="5" min="-180" max="180" value="${data.rotation[0]}" />
            </div>
            <div>
              <label class="insp-label">Eje Y (Yaw °)</label>
              <input type="number" id="inp-rot-y" class="insp-input" step="15" min="-180" max="180" value="${data.rotation[1]}" />
            </div>
            <div>
              <label class="insp-label">Eje Z (Roll °)</label>
              <input type="number" id="inp-rot-z" class="insp-input" step="5" min="-180" max="180" value="${data.rotation[2]}" />
            </div>
          </div>
          <div class="quick-rot-row">
            <button class="btn-mini" id="btn-rot-y90">Girar 90° Y</button>
            <button class="btn-mini" id="btn-rot-x45">Inclinar 45° X</button>
            <button class="btn-mini" id="btn-rot-reset">Reset 0°</button>
          </div>
        </div>

        <div class="insp-section">
          <div class="insp-section-title">Posición Coordenadas 3D (X, Y, Z)</div>
          <div class="insp-grid-3">
            <div>
              <label class="insp-label">X</label>
              <input type="number" id="inp-pos-x" class="insp-input" step="0.2" value="${data.position[0]}" />
            </div>
            <div>
              <label class="insp-label">Y (Altura)</label>
              <input type="number" id="inp-pos-y" class="insp-input" step="0.14" value="${data.position[1]}" />
            </div>
            <div>
              <label class="insp-label">Z</label>
              <input type="number" id="inp-pos-z" class="insp-input" step="0.2" value="${data.position[2]}" />
            </div>
          </div>
        </div>

        <div class="insp-section">
          <div class="insp-section-title">Puertos & Enlaces (${nodeLinks.length})</div>
          <div class="port-chips">
            ${(spec.ports || []).map((p) => `<span class="port-chip">${p}</span>`).join('')}
          </div>
          <div class="node-links-list">
            ${
              nodeLinks.length === 0
                ? `<div class="empty-muted">Sin cables conectados aún. Usa el botón "Conectar Cable 3D".</div>`
                : nodeLinks
                    .map((l) => {
                      const peerId = l.fromId === node.id ? l.toId : l.fromId;
                      const peer = this.nodes.get(peerId);
                      return `<div class="link-item" data-select-link="${l.id}">
                        <span>⇄ ${peer ? peer.data.hostname : 'Nodo'}</span>
                        <code>${l.fromPort} → ${l.toPort}</code>
                      </div>`;
                    })
                    .join('')
            }
          </div>
        </div>

        <div class="insp-actions">
          <button class="btn-secondary" id="btn-dup-node">Duplicar Equipo</button>
          <button class="btn-danger" id="btn-del-node">Eliminar</button>
        </div>
      `;

      const refreshLabel = () => {
        const accent = node.data.customColor || spec.badgeColor;

        // If 3D Title Banner, update its front and back 3D canvas textures
        if (spec.isTitle3D) {
          const newTex = createTitle3DTexture(node.data.hostname, node.data.ip, accent);
          ['title3DFaceFront', 'title3DFaceBack'].forEach((faceName) => {
            const face = node.group.getObjectByName(faceName);
            if (face && face.material) {
              face.material.map = newTex;
              face.material.needsUpdate = true;
            }
          });
          return;
        }

        // If 3D Process Explanation Panel, update its multi-line canvas texture
        if (spec.isTextPanel3D) {
          const newTex = createProcessPanelTexture(node.data.hostname, node.data.ip, accent);
          ['processPanelFront', 'processPanelBack'].forEach((faceName) => {
            const face = node.group.getObjectByName(faceName);
            if (face && face.material) {
              face.material.map = newTex;
              face.material.needsUpdate = true;
            }
          });
          return;
        }

        const oldSprite = node.group.getObjectByName('deviceLabelSprite');
        if (oldSprite) node.group.remove(oldSprite);
        const newSprite = createDeviceLabelSprite(
          node.data.hostname,
          node.data.ip,
          spec.isFlowArrow ? 'Flujo 3D' : spec.vendor,
          accent
        );
        newSprite.position.set(0, spec.height / 2 + (spec.isRackContainer ? 0.42 : 0.36), 0);
        newSprite.visible = this.showLabels;
        node.group.add(newSprite);
      };

      document.getElementById('inp-hostname')?.addEventListener('input', (e) => {
        node.data.hostname = e.target.value;
        refreshLabel();
      });

      document.getElementById('inp-ip')?.addEventListener('input', (e) => {
        node.data.ip = e.target.value;
        node.data.notes = e.target.value;
        refreshLabel();
      });

      container.querySelectorAll('[data-zone-color]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const newCol = btn.dataset.zoneColor;
          node.data.customColor = newCol;
          node.group.traverse((child) => {
            if (child.isLineSegments && child.material) {
              child.material.color.set(newCol);
            } else if (child.isMesh && child.material && (spec.isZone || spec.isFlowArrow)) {
              child.material.color.set(newCol);
              if (child.material.emissive) {
                child.material.emissive.set(newCol).multiplyScalar(0.32);
              }
            }
          });
          refreshLabel();
        });
      });

      const applyTransformFromInputs = () => {
        const px = parseFloat(document.getElementById('inp-pos-x')?.value) || 0;
        const py = parseFloat(document.getElementById('inp-pos-y')?.value) || 0;
        const pz = parseFloat(document.getElementById('inp-pos-z')?.value) || 0;
        const rx = parseFloat(document.getElementById('inp-rot-x')?.value) || 0;
        const ry = parseFloat(document.getElementById('inp-rot-y')?.value) || 0;
        const rz = parseFloat(document.getElementById('inp-rot-z')?.value) || 0;

        node.group.position.set(px, py, pz);
        node.group.rotation.set(rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
        this.syncNodeDataFromTransform(node);
        this.rebuildConnectedLinks(node.id);
        this.selectionBox.setFromObject(node.group);
      };

      ['inp-pos-x', 'inp-pos-y', 'inp-pos-z', 'inp-rot-x', 'inp-rot-y', 'inp-rot-z'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', applyTransformFromInputs);
      });

      document.getElementById('btn-rot-y90')?.addEventListener('click', () => {
        node.group.rotation.y += Math.PI / 2;
        this.syncNodeDataFromTransform(node);
        this.rebuildConnectedLinks(node.id);
        this.updateInspectorTransformInputs(node);
      });

      document.getElementById('btn-rot-x45')?.addEventListener('click', () => {
        node.group.rotation.x += Math.PI / 4;
        this.syncNodeDataFromTransform(node);
        this.rebuildConnectedLinks(node.id);
        this.updateInspectorTransformInputs(node);
      });

      document.getElementById('btn-rot-reset')?.addEventListener('click', () => {
        node.group.rotation.set(0, 0, 0);
        this.syncNodeDataFromTransform(node);
        this.rebuildConnectedLinks(node.id);
        this.updateInspectorTransformInputs(node);
      });

      const applyRackMount = () => {
        const rackId = document.getElementById('inp-rack-id')?.value || '';
        const uSlot = parseInt(document.getElementById('inp-u-slot')?.value, 10) || 1;
        node.data.rackId = rackId;
        node.data.uSlot = uSlot;
        if (rackId && this.nodes.has(rackId)) {
          this.positionNodeInRack(node.group, spec, node.data);
          this.rebuildConnectedLinks(node.id);
          this.updateInspectorTransformInputs(node);
        }
      };
      document.getElementById('inp-rack-id')?.addEventListener('change', applyRackMount);
      document.getElementById('inp-u-slot')?.addEventListener('input', applyRackMount);

      container.querySelectorAll('[data-select-link]').forEach((el) => {
        el.addEventListener('click', () => this.selectLink(el.dataset.selectLink));
      });

      document.getElementById('btn-dup-node')?.addEventListener('click', () => this.duplicateSelectedNode());
      document.getElementById('btn-del-node')?.addEventListener('click', () => this.deleteSelected());
      return;
    }

    if (this.selectedLinkId && this.links.has(this.selectedLinkId)) {
      const link = this.links.get(this.selectedLinkId);
      const fromNode = this.nodes.get(link.fromId);
      const toNode = this.nodes.get(link.toId);

      container.innerHTML = `
        <div class="insp-section">
          <div class="insp-badge" style="background:#00e5ff22; color:#00e5ff; border:1px solid #00e5ff">
            CONECTOR / CABLE 3D
          </div>
          <h3 class="insp-title">${fromNode?.data.hostname || 'Origen'} ⇄ ${toNode?.data.hostname || 'Destino'}</h3>

          <label class="insp-label">Tipo de Fibra / Medio Físico</label>
          <select id="inp-link-type" class="insp-input">
            ${CABLE_TYPES.map((c) => `<option value="${c.id}" ${c.id === link.cableType ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>

          <label class="insp-label">Enrutamiento 3D</label>
          <select id="inp-link-route" class="insp-input">
            <option value="manhattan" ${link.routeStyle === 'manhattan' ? 'selected' : ''}>Ortogonal 3D (Visio X/Y/Z)</option>
            <option value="overhead" ${link.routeStyle === 'overhead' ? 'selected' : ''}>Escalerilla Aérea Superior</option>
            <option value="bezier" ${link.routeStyle === 'bezier' ? 'selected' : ''}>Curva Directa</option>
          </select>

          <div class="insp-grid-2">
            <div>
              <label class="insp-label">Puerto Origen</label>
              <select id="inp-from-port" class="insp-input">
                ${(fromNode?.spec.ports || ['Port-1']).map((p) => `<option value="${p}" ${p === link.fromPort ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="insp-label">Puerto Destino</label>
              <select id="inp-to-port" class="insp-input">
                ${(toNode?.spec.ports || ['Port-1']).map((p) => `<option value="${p}" ${p === link.toPort ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="insp-actions">
          <button class="btn-danger" id="btn-del-link">Eliminar Cable 3D</button>
        </div>
      `;

      const updateLink = () => {
        link.cableType = document.getElementById('inp-link-type').value;
        link.routeStyle = document.getElementById('inp-link-route').value;
        link.fromPort = document.getElementById('inp-from-port').value;
        link.toPort = document.getElementById('inp-to-port').value;
        this.rebuildConnectedLinks(link.fromId);
      };
      document.getElementById('inp-link-type')?.addEventListener('change', updateLink);
      document.getElementById('inp-link-route')?.addEventListener('change', updateLink);
      document.getElementById('inp-from-port')?.addEventListener('change', updateLink);
      document.getElementById('inp-to-port')?.addEventListener('change', updateLink);
      document.getElementById('btn-del-link')?.addEventListener('click', () => this.deleteSelected());
      return;
    }

    container.innerHTML = `
      <div class="insp-empty">
        <div class="insp-empty-icon">◈</div>
        <h3>Inspector 3D</h3>
        <p>Selecciona cualquier <strong>Servidor Virtual (Windows, Red Hat, Appliance)</strong>, <strong>HPE Synergy</strong>, <strong>Alletra</strong>, <strong>Cisco Nexus 9508</strong>, <strong>Catalyst 9410R</strong> o <strong>FortiGate</strong> para editar propiedades o rotarlo en los <strong>3 ejes (X, Y, Z)</strong>.</p>
        <div class="shortcut-list">
          <div><kbd>Clic + Arrastrar</kbd><span>Rotar diagrama 3D (3 ejes)</span></div>
          <div><kbd>Clic Derecho</kbd><span>Desplazar cámara (Pan)</span></div>
          <div><kbd>Scroll</kbd><span>Zoom 3D</span></div>
          <div><kbd>W</kbd> / <kbd>E</kbd> / <kbd>R</kbd><span>Mover / Rotar 3 Ejes / Escalar</span></div>
          <div><kbd>C</kbd><span>Conectar Cable 3D entre equipos</span></div>
          <div><kbd>📸 Exportar PNG</kbd><span>Guardar imagen en Alta Resolución</span></div>
        </div>
      </div>
    `;
  }

  clearScene() {
    this.selectNode(null);
    this.nodes.forEach((n) => this.scene.remove(n.group));
    this.links.forEach((l) => {
      this.scene.remove(l.mesh);
      l.pulses.forEach((p) => this.scene.remove(p.mesh));
    });
    this.nodes.clear();
    this.links.clear();
    this.updateStatsBar();
  }

  loadEnterpriseSampleArchitecture() {
    this.clearScene();

    // 0. Título 3D Flotante (Relocalizable) + Paneles de Explicación de Procesos + Flechas de Flujo 3D
    this.addHardwareNode('title-3d-banner', {
      hostname: 'ARQUITECTURA DATA CENTER & REDES 3D',
      ip: 'Seguridad Perimetral FortiGate • Core Cisco • Virtualización • Synergy & Storage NVMe',
      customColor: '#00e5ff',
      position: [-0.8, 6.8, -5.8]
    });

    this.addHardwareNode('text-panel-3d', {
      hostname: 'ETAPA 1: INGRESO & SEGURIDAD',
      ip: '1. Tráfico WAN entra por Fibra Oscura 100G\n2. Inspección NGFW en Cluster FortiGate 1800F HA\n3. Balanceo SSL/WAF en Kemp LoadMaster X3',
      customColor: '#ee3124',
      position: [-8.8, 4.2, 5.2]
    });

    this.addHardwareNode('text-panel-3d', {
      hostname: 'ETAPA 2: PROCESAMIENTO & SAN',
      ip: '1. Distribución Core Nexus 9508 & Catalyst 9410R\n2. Cómputo en VMs (Windows/RHEL) y HPE Synergy\n3. Almacenamiento NVMe en Alletra 9000 y Pure X90',
      customColor: '#00c853',
      position: [3.2, 7.1, -3.2]
    });

    // Flechas 3D explicando el flujo entre zonas
    this.addHardwareNode('arrow-3d-straight', {
      hostname: '1. FLUJO INSPECCIONADO ➔',
      ip: '100G hacia Core Cisco',
      customColor: '#ff1744',
      position: [-5.2, 2.2, 5.5]
    });

    this.addHardwareNode('arrow-3d-curved', {
      hostname: '2. TRÁFICO A CÓMPUTO & VMs ↷',
      ip: 'Fabric 100G / vSwitch',
      customColor: '#00e5ff',
      position: [-3.5, 3.2, 1.2],
      rotation: [0, -55, 0]
    });

    this.addHardwareNode('arrow-3d-double', {
      hostname: '3. REPLICACIÓN SAN ACTIVA ⟷',
      ip: '64G Fibre Channel / NVMe-oF',
      customColor: '#00e676',
      position: [2.9, 3.8, -1.2]
    });

    // 1. Zonas 3D en ROJO, AZUL y VERDE
    this.addHardwareNode('zone-platform-red', {
      hostname: 'ZONA ROJA — SEGURIDAD FORTINET & KEMP LB',
      ip: 'VLAN 10 / Perímetro, WAF & Balanceo ADC',
      customColor: '#ee3124',
      position: [-8.8, 0.04, 5.2],
      scale: [0.95, 1, 0.90]
    });

    this.addHardwareNode('zone-platform', {
      hostname: 'ZONA AZUL — CORE CISCO & VIRTUALIZACIÓN 3D',
      ip: 'Nexus 9508 + Catalyst 9410R + VMs (Win / RHEL / vApp)',
      customColor: '#2979ff',
      position: [-2.2, 0.04, 1.2],
      scale: [1.35, 1, 1.85]
    });

    this.addHardwareNode('zone-platform-green', {
      hostname: 'ZONA VERDE — SYNERGY, STORAGE, ATMs & ALL-IN-ONE',
      ip: 'HPE Synergy + Alletra/Pure + ATM 24/7 + Estaciones',
      customColor: '#00c853',
      position: [5.2, 0.04, 0.8],
      scale: [1.55, 1, 1.95]
    });

    // External WAN Dark Fiber Cloud
    const wanCloud = this.addHardwareNode('cloud-wan', {
      hostname: 'RED / INTERNET WAN',
      ip: '100G Dark Fiber Ring',
      position: [-12.5, 2.8, 5.2]
    });

    // ================= NEW ENDPOINTS: ATM 24/7, ALL-IN-ONE PC, KEMP LB & RACK SERVER =================
    const atm247 = this.addHardwareNode('atm-kiosk-24-7', {
      hostname: 'ATM-247-AIRPORT-01',
      ip: '10.40.10.11 (Bank Your Way 24/7)',
      position: [6.4, 0.92, 4.6]
    });

    const aioPc = this.addHardwareNode('all-in-one-pc', {
      hostname: 'AIO-EJECUTIVO-01',
      ip: '10.40.20.15 (Windows 11 Enterprise)',
      position: [3.6, 0.50, 4.6]
    });

    const kempLb = this.addHardwareNode('kemp-loadmaster-x3', {
      hostname: 'KEMP-LOADMASTER-X3',
      ip: '10.20.5.10 (VIP Load Balancer)',
      position: [-8.8, 2.65, 4.2]
    });

    const rackSrvPro = this.addHardwareNode('rack-server-pro', {
      hostname: 'SRV-RACK-PROLIANT-01',
      ip: '10.20.20.10 (Bezel HPE 1U)',
      position: [-4.2, 0.95, 5.2]
    });

    // ================= VIRTUALIZATION STACK (MATCHING "Servidor Virtual.png") =================
    const physHost = this.addHardwareNode('hpe-dl380-gen11', {
      hostname: 'SERVIDOR-FISICO-HV01',
      ip: '10.20.50.10 (Hardware Real 2U)',
      position: [-7.2, 0.22, -2.8],
      scale: [1.26, 1.25, 1.0]
    });

    const hypervisor = this.addHardwareNode('hypervisor-layer', {
      hostname: 'HYPERVISOR-ESXI-AHV',
      ip: 'Crea y gestiona servidores virtuales',
      position: [-7.2, 0.62, -2.8]
    });

    const vmWin = this.addHardwareNode('vm-windows-server', {
      hostname: 'Servidor Virtual 1',
      ip: 'Windows Server • AD/SQL',
      position: [-8.0, 1.22, -2.8]
    });

    const vmRhel = this.addHardwareNode('vm-linux-redhat', {
      hostname: 'Servidor Virtual 2',
      ip: 'Linux Red Hat (RHEL 9)',
      position: [-7.2, 1.22, -2.8]
    });

    const vmApp = this.addHardwareNode('vm-appliance', {
      hostname: 'Servidor Virtual 3',
      ip: 'Virtual Appliance (vApp)',
      position: [-6.4, 1.22, -2.8]
    });

    // ================= SECURITY PERIMETER (FORTIGATE 1800F, 600F, 200F) =================
    const fg1800A = this.addHardwareNode('fortigate-1800f', {
      hostname: 'FG-1800F-CORE-A',
      ip: '10.20.0.1 (HA Primary)',
      position: [-8.8, 2.2, 6.2]
    });
    const fg1800B = this.addHardwareNode('fortigate-1800f', {
      hostname: 'FG-1800F-CORE-B',
      ip: '10.20.0.2 (HA Secondary)',
      position: [-8.8, 1.5, 6.2]
    });
    const fg600 = this.addHardwareNode('fortigate-600f', {
      hostname: 'FG-600F-SEGMENT',
      ip: '10.20.0.11 (Internal FW)',
      position: [-8.8, 0.9, 4.2]
    });
    const fg200 = this.addHardwareNode('fortigate-200f', {
      hostname: 'FG-200F-SDWAN',
      ip: '10.20.0.21 (Branch/DMZ)',
      position: [-8.8, 0.4, 4.2]
    });

    // ================= CISCO CORE & SWITCHING (NEXUS 9508, CATALYST 9410R, 9300 48p/24p) =================
    const n9508 = this.addHardwareNode('cisco-nexus-9508', {
      hostname: 'CORE-NEXUS-9508',
      ip: '10.20.1.1 (Spine Core)',
      position: [-1.6, 1.1, 5.2]
    });

    const c9410 = this.addHardwareNode('cisco-catalyst-9410r', {
      hostname: 'DIST-CAT-9410R',
      ip: '10.20.2.1 (10-Slot Chassis)',
      position: [1.4, 1.1, 5.2]
    });

    const c9300_48 = this.addHardwareNode('cisco-catalyst-9300-48p', {
      hostname: 'SW-C9300-48P-01',
      ip: '10.20.3.11 (48x PoE+)',
      position: [1.4, 2.55, 5.2]
    });

    const c9300_24 = this.addHardwareNode('cisco-catalyst-9300-24t', {
      hostname: 'SW-C9300-24T-02',
      ip: '10.20.3.12 (24x RJ45)',
      position: [1.4, 2.95, 5.2]
    });

    // ================= RACK 1: COMPUTE & HCI (HPE SYNERGY 12000 + NUTANIX + PROLIANT) =================
    const rackCompute = this.addHardwareNode('rack-42u', {
      hostname: 'RACK-COMPUTE-A01',
      ip: 'Fila A - Gabinete 01 (Synergy & HCI)',
      position: [0.2, 3.1, -3.2]
    });

    const synergy = this.addHardwareNode('hpe-synergy-12000', {
      hostname: 'HPE-SYNERGY-12000',
      ip: '10.20.10.10 (12 Blades)',
      rackId: rackCompute.id,
      uSlot: 4
    });

    const nutanix1 = this.addHardwareNode('nutanix-nx-3060-g8', {
      hostname: 'NTNX-NX3060-BLK01',
      ip: '10.20.30.11 (4-Node HCI)',
      rackId: rackCompute.id,
      uSlot: 18
    });

    const nutanix2 = this.addHardwareNode('nutanix-nx-8155-g8', {
      hostname: 'NTNX-NX8155-BLK02',
      ip: '10.20.30.12 (HCI Storage)',
      rackId: rackCompute.id,
      uSlot: 21
    });

    const dl380 = this.addHardwareNode('hpe-dl380-gen11', {
      hostname: 'HPE-DL380-GEN11-01',
      ip: '10.20.20.21 (VMware/K8s)',
      rackId: rackCompute.id,
      uSlot: 26
    });

    const torCompute = this.addHardwareNode('cisco-nexus-93180yc-fx3', {
      hostname: 'TOR-LEAF-N93180-A',
      ip: '10.20.1.11 (25G/100G ToR)',
      rackId: rackCompute.id,
      uSlot: 40
    });

    // ================= RACK 2: ALL-FLASH SAN STORAGE (HPE ALLETRA + PURE STORAGE) =================
    const rackStorage = this.addHardwareNode('rack-42u', {
      hostname: 'RACK-STORAGE-B01',
      ip: 'Fila B - Gabinete 02 (Alletra & Pure)',
      position: [5.6, 3.1, -3.2]
    });

    const alletra9k = this.addHardwareNode('hpe-alletra-9000', {
      hostname: 'HPE-ALLETRA-9000',
      ip: '10.20.40.10 (NVMe SAN)',
      rackId: rackStorage.id,
      uSlot: 6
    });

    const alletra6k = this.addHardwareNode('hpe-alletra-6000', {
      hostname: 'HPE-ALLETRA-6000',
      ip: '10.20.40.12 (Cloud Native)',
      rackId: rackStorage.id,
      uSlot: 12
    });

    const pureX90 = this.addHardwareNode('pure-flasharray-x90', {
      hostname: 'PURE-FLASHARRAY-X90',
      ip: '10.20.40.20 (DirectFlash)',
      rackId: rackStorage.id,
      uSlot: 18
    });

    const pureBlade = this.addHardwareNode('pure-flashblade-s', {
      hostname: 'PURE-FLASHBLADE-S500',
      ip: '10.20.40.25 (Fast File/Object)',
      rackId: rackStorage.id,
      uSlot: 24
    });

    const torStorage = this.addHardwareNode('cisco-nexus-93180yc-fx3', {
      hostname: 'TOR-LEAF-N93180-B',
      ip: '10.20.1.12 (Storage Fabric)',
      rackId: rackStorage.id,
      uSlot: 40
    });

    // ================= 3D INTERCONNECTIONS (CABLES) =================
    this.addCableLink({
      fromId: wanCloud.id,
      toId: fg1800A.id,
      fromPort: 'DarkFiber-1',
      toPort: 'port37-100G',
      cableType: 'os2-yellow',
      routeStyle: 'bezier'
    });
    this.addCableLink({
      fromId: fg1800A.id,
      toId: fg1800B.id,
      fromPort: 'HA1',
      toPort: 'HA1',
      cableType: 'ha-red',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: fg1800A.id,
      toId: n9508.id,
      fromPort: 'port38-100G',
      toPort: 'LC1-400G-1',
      cableType: 'om4-aqua',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: fg600.id,
      toId: c9410.id,
      fromPort: 'X1-SFP+ (Uplink)',
      toPort: 'Sup5-40G-1',
      cableType: 'om4-aqua',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: fg200.id,
      toId: fg600.id,
      fromPort: 'X1-10G',
      toPort: 'X2-SFP+ (Uplink)',
      cableType: 'ha-red',
      routeStyle: 'manhattan'
    });

    // Virtualization cluster uplinks to Core Nexus 9508 and WAN
    this.addCableLink({
      fromId: physHost.id,
      toId: n9508.id,
      fromPort: 'OCP-25G-1',
      toPort: 'LC4-25G-1',
      cableType: 'om4-aqua',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: vmRhel.id,
      toId: wanCloud.id,
      fromPort: 'eth0 (vSwitch)',
      toPort: 'Carrier-A (100G)',
      cableType: 'om4-aqua',
      routeStyle: 'overhead'
    });
    this.addCableLink({
      fromId: vmApp.id,
      toId: wanCloud.id,
      fromPort: 'vPort-Data',
      toPort: 'Carrier-B (100G)',
      cableType: 'om4-aqua',
      routeStyle: 'overhead'
    });

    // Nexus 9508 Core to Catalyst 9410R & Access Switches
    this.addCableLink({
      fromId: n9508.id,
      toId: c9410.id,
      fromPort: 'LC2-100G-1',
      toPort: 'Sup5-40G-2',
      cableType: 'dac-purple',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: c9410.id,
      toId: c9300_48.id,
      fromPort: 'Slot7-Ten7/0/1',
      toPort: 'Te1/1/1 (Uplink)',
      cableType: 'om4-aqua',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: c9300_48.id,
      toId: c9300_24.id,
      fromPort: 'Stack-1',
      toPort: 'Stack-1',
      cableType: 'cat6a-blue',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: c9300_48.id,
      toId: atm247.id,
      fromPort: 'Gi1/0/1-12',
      toPort: 'LAN-Primary (RJ45)',
      cableType: 'cat6a-blue',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: c9300_24.id,
      toId: aioPc.id,
      fromPort: 'Gi1/0/1-12',
      toPort: 'eth0-1GbE (RJ45)',
      cableType: 'cat6a-blue',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: kempLb.id,
      toId: fg600.id,
      fromPort: 'eth0 (WAN/VIP)',
      toPort: 'port1-RJ45',
      cableType: 'cat6a-blue',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: kempLb.id,
      toId: rackSrvPro.id,
      fromPort: 'eth2 (Backend-1)',
      toPort: 'OCP-25G-1',
      cableType: 'om4-aqua',
      routeStyle: 'manhattan'
    });

    // Core Nexus 9508 Spine to Rack Top-of-Rack Leaf Switches
    this.addCableLink({
      fromId: n9508.id,
      toId: torCompute.id,
      fromPort: 'LC1-400G-2',
      toPort: 'Eth1/49 (100G)',
      cableType: 'om4-aqua',
      routeStyle: 'overhead'
    });
    this.addCableLink({
      fromId: n9508.id,
      toId: torStorage.id,
      fromPort: 'LC3-100G-1',
      toPort: 'Eth1/49 (100G)',
      cableType: 'om4-aqua',
      routeStyle: 'overhead'
    });

    // Compute & Storage Connections inside and across racks
    this.addCableLink({
      fromId: torCompute.id,
      toId: synergy.id,
      fromPort: 'Eth1/50 (100G)',
      toPort: 'ICM-1 (100G)',
      cableType: 'dac-purple',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: torCompute.id,
      toId: nutanix1.id,
      fromPort: 'Eth1/1-24 (25G)',
      toPort: 'NodeA-25G-1',
      cableType: 'om4-aqua',
      routeStyle: 'manhattan'
    });
    this.addCableLink({
      fromId: synergy.id,
      toId: alletra9k.id,
      fromPort: 'ICM-3 (FC)',
      toPort: 'N0-FC1',
      cableType: 'san-orange',
      routeStyle: 'overhead'
    });
    this.addCableLink({
      fromId: dl380.id,
      toId: pureX90.id,
      fromPort: 'FC-HBA-1',
      toPort: 'CT0-FC0',
      cableType: 'san-orange',
      routeStyle: 'overhead'
    });
    this.addCableLink({
      fromId: torStorage.id,
      toId: pureBlade.id,
      fromPort: 'Eth1/51 (100G)',
      toPort: 'XFM1-100G-1',
      cableType: 'om4-aqua',
      routeStyle: 'manhattan'
    });

    this.updateStatsBar();
  }

  updateStatsBar() {
    const devCount = Array.from(this.nodes.values()).filter((n) => !n.spec.isZone).length;
    const vmCount = Array.from(this.nodes.values()).filter((n) => n.spec.isVirtualCube).length;
    const linkCount = this.links.size;
    const totalU = Array.from(this.nodes.values())
      .filter((n) => !n.spec.isRackContainer && !n.spec.isZone)
      .reduce((acc, n) => acc + (n.spec.uHeight || 0), 0);

    const el = document.getElementById('status-counts');
    if (el) {
      el.textContent = `${devCount} Equipos 3D (${vmCount} VMs) • ${linkCount} Enlaces • ${totalU}U instalados`;
    }
  }

  exportDiagramJSON() {
    const payload = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      nodes: Array.from(this.nodes.values()).map((n) => ({
        id: n.id,
        specId: n.spec.id,
        ...n.data
      })),
      links: Array.from(this.links.values()).map((l) => ({
        id: l.id,
        fromId: l.fromId,
        toId: l.toId,
        fromPort: l.fromPort,
        toPort: l.toPort,
        cableType: l.cableType,
        routeStyle: l.routeStyle
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visio3d-datacenter-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Diagrama 3D exportado en JSON');
  }

  importDiagramJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        this.clearScene();
        const sortedNodes = [...(data.nodes || [])].sort((a, b) => (a.rackId ? 1 : -1));
        sortedNodes.forEach((n) => this.addHardwareNode(n.specId, n));
        (data.links || []).forEach((l) => this.addCableLink(l));
        this.showToast('Diagrama 3D importado correctamente');
      } catch (err) {
        this.showToast('Error al leer el archivo JSON');
      }
    };
    reader.readAsText(file);
  }

  exportBOMCSV() {
    const rows = [
      ['Hostname', 'Fabricante', 'Modelo', 'Altura U / Tipo', 'IP / Gestión', 'Rack Asignado', 'Slot U', 'Coordenadas 3D (X,Y,Z)']
    ];
    this.nodes.forEach((n) => {
      if (n.spec.isZone) return;
      const rackName = n.data.rackId && this.nodes.has(n.data.rackId) ? this.nodes.get(n.data.rackId).data.hostname : 'Libre';
      rows.push([
        n.data.hostname,
        n.spec.vendor,
        n.spec.name,
        n.spec.uHeight ? `${n.spec.uHeight}U` : 'Virtual / 3D',
        n.data.ip,
        rackName,
        n.data.rackId ? `U${n.data.uSlot}` : '-',
        `"(${n.data.position.join(', ')})"`
      ]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visio3d-inventario-bom.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Inventario BOM (CSV) descargado');
  }

  showToast(msg) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.orbit.update();

    if (this.animateTraffic) {
      this.links.forEach((link) => {
        if (!link.curve) return;
        link.pulses.forEach((p) => {
          p.t = (p.t + 0.0045) % 1;
          const pos = link.curve.getPointAt(p.t);
          p.mesh.position.copy(pos);
        });
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.netVisioApp = new NetVisio3DApp();
});
